import { verifyWebhook as verifyClerkWebhook } from "@clerk/backend/webhooks";
import type {
  InvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
  WorkspaceRole
} from "@the-platform/shared";

import type { AppSession, WorkspaceRepository } from "./types";
import { WorkspaceError } from "./core.ts";

export { WorkspaceError } from "./core.ts";

const roleRank: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};

export interface WorkspaceDetails {
  workspace: WorkspaceRecord;
  currentRole: WorkspaceRole;
  invitations: InvitationRecord[];
  members: WorkspaceMemberRecord[];
}

export interface SyncClerkWebhookRequestOptions {
  verifyWebhook?: (request: Request) => Promise<{
    data: unknown;
    type: string;
  }>;
}

function requireNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkspaceError(400, `${field} is required.`);
  }

  return value.trim();
}

function normalizeEmail(value: unknown) {
  return requireNonEmptyString(value, "email").toLowerCase();
}

export function slugifyWorkspaceName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function hasMinimumRole(
  currentRole: WorkspaceRole,
  minimumRole: WorkspaceRole
) {
  return roleRank[currentRole] >= roleRank[minimumRole];
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status
  });
}

export async function createWorkspaceForUser(
  repository: WorkspaceRepository,
  session: AppSession,
  input: {
    name?: unknown;
    slug?: unknown;
  }
) {
  const name = requireNonEmptyString(input.name, "name");
  const slugInput = typeof input.slug === "string" ? input.slug.trim() : "";
  const slug = slugifyWorkspaceName(slugInput || name);

  if (!slug) {
    throw new WorkspaceError(400, "slug is invalid.");
  }

  const existing = await repository.findWorkspaceBySlug(slug);
  if (existing) {
    throw new WorkspaceError(409, "workspace slug already exists.");
  }

  const workspace = await repository.createWorkspace({
    name,
    slug
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: session.userId,
    role: "owner"
  });

  return workspace;
}

export async function listWorkspacesForUser(
  repository: WorkspaceRepository,
  session: AppSession
) {
  await syncInvitationsForUser(repository, session);
  return repository.listWorkspacesForUser(session.userId);
}

export async function requireWorkspaceMembership(
  repository: WorkspaceRepository,
  session: AppSession,
  workspaceId: string,
  minimumRole: WorkspaceRole = "viewer"
) {
  const membership = await repository.getMembership(workspaceId, session.userId);
  if (!membership) {
    throw new WorkspaceError(403, "workspace access denied.");
  }

  if (!hasMinimumRole(membership.role, minimumRole)) {
    throw new WorkspaceError(403, "insufficient workspace permissions.");
  }

  return membership;
}

export async function getWorkspaceDetailsForUser(
  repository: WorkspaceRepository,
  session: AppSession,
  workspaceId: string
): Promise<WorkspaceDetails> {
  const membership = await requireWorkspaceMembership(repository, session, workspaceId, "viewer");
  const workspace = await repository.getWorkspaceById(workspaceId);

  if (!workspace) {
    throw new WorkspaceError(404, "workspace not found.");
  }

  const [members, invitations] = await Promise.all([
    repository.listMembers(workspaceId),
    repository.listPendingInvitations(workspaceId)
  ]);

  return {
    workspace,
    currentRole: membership.role,
    invitations,
    members
  };
}

export async function updateWorkspaceForUser(
  repository: WorkspaceRepository,
  session: AppSession,
  workspaceId: string,
  input: {
    name?: unknown;
    slug?: unknown;
  }
) {
  await requireWorkspaceMembership(repository, session, workspaceId, "admin");

  const updates: { name?: string; slug?: string } = {};

  if (input.name !== undefined) {
    updates.name = requireNonEmptyString(input.name, "name");
  }

  if (input.slug !== undefined) {
    const normalized = slugifyWorkspaceName(requireNonEmptyString(input.slug, "slug"));
    if (!normalized) {
      throw new WorkspaceError(400, "slug is invalid.");
    }

    const existing = await repository.findWorkspaceBySlug(normalized);
    if (existing && existing.id !== workspaceId) {
      throw new WorkspaceError(409, "workspace slug already exists.");
    }

    updates.slug = normalized;
  }

  const updated = await repository.updateWorkspace(workspaceId, updates);
  if (!updated) {
    throw new WorkspaceError(404, "workspace not found.");
  }

  return updated;
}

export async function createInvitationForUser(
  repository: WorkspaceRepository,
  session: AppSession,
  workspaceId: string,
  input: {
    email?: unknown;
    role?: unknown;
  }
) {
  await requireWorkspaceMembership(repository, session, workspaceId, "admin");

  const email = normalizeEmail(input.email);
  const role = requireWorkspaceRole(input.role);

  return repository.createInvitation({
    workspaceId,
    email,
    role,
    invitedBy: session.userId
  });
}

export async function updateWorkspaceMemberRoleForUser(
  repository: WorkspaceRepository,
  session: AppSession,
  workspaceId: string,
  memberUserId: string,
  role: WorkspaceRole
) {
  const actorMembership = await requireWorkspaceMembership(repository, session, workspaceId, "admin");
  const targetMembership = await repository.getMembership(workspaceId, memberUserId);

  if (!targetMembership) {
    throw new WorkspaceError(404, "workspace member not found.");
  }

  if (targetMembership.role === "owner" && actorMembership.role !== "owner") {
    throw new WorkspaceError(403, "only owners can modify other owners.");
  }

  if (role === "owner" && actorMembership.role !== "owner") {
    throw new WorkspaceError(403, "only owners can assign owner role.");
  }

  const updated = await repository.updateMembershipRole(workspaceId, memberUserId, role);
  if (!updated) {
    const currentMembership = await repository.getMembership(workspaceId, memberUserId);

    if (currentMembership?.role === "owner" && role !== "owner") {
      throw new WorkspaceError(409, "workspace must retain at least one owner.");
    }

    throw new WorkspaceError(404, "workspace member not found.");
  }

  return updated;
}

export async function removeWorkspaceMemberForUser(
  repository: WorkspaceRepository,
  session: AppSession,
  workspaceId: string,
  memberUserId: string
) {
  const actorMembership = await requireWorkspaceMembership(repository, session, workspaceId, "admin");
  const targetMembership = await repository.getMembership(workspaceId, memberUserId);

  if (!targetMembership) {
    throw new WorkspaceError(404, "workspace member not found.");
  }

  if (targetMembership.role === "owner" && actorMembership.role !== "owner") {
    throw new WorkspaceError(403, "only owners can remove other owners.");
  }

  const deleted = await repository.removeMembership(workspaceId, memberUserId);
  if (!deleted) {
    const currentMembership = await repository.getMembership(workspaceId, memberUserId);

    if (currentMembership?.role === "owner") {
      throw new WorkspaceError(409, "workspace must retain at least one owner.");
    }

    throw new WorkspaceError(404, "workspace member not found.");
  }
}

export async function syncInvitationsForUser(
  repository: WorkspaceRepository,
  session: AppSession
) {
  if (!session.email) {
    return [];
  }

  const invitations = await repository.findPendingInvitationsByEmail(session.email.toLowerCase());

  for (const invitation of invitations) {
    const existingMembership = await repository.getMembership(invitation.workspaceId, session.userId);

    if (!existingMembership) {
      await repository.addMembership({
        workspaceId: invitation.workspaceId,
        userId: session.userId,
        role: invitation.role,
        invitedAt: invitation.createdAt
      });
    }

    await repository.updateInvitationStatus(invitation.id, "accepted");
  }

  return invitations;
}

export async function syncInvitationsFromClerkUserCreated(
  repository: WorkspaceRepository,
  payload: {
    userId?: unknown;
    email?: unknown;
  }
) {
  const userId = requireNonEmptyString(payload.userId, "userId");
  const email = normalizeEmail(payload.email);

  return syncInvitationsForUser(repository, {
    userId,
    email,
    displayName: null,
    provider: "clerk"
  });
}

export async function syncInvitationsFromClerkWebhookRequest(
  repository: WorkspaceRepository,
  request: Request,
  options: SyncClerkWebhookRequestOptions = {}
) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  const verifyWebhook =
    options.verifyWebhook ??
    ((incomingRequest: Request) =>
      signingSecret
        ? verifyClerkWebhook(incomingRequest, { signingSecret })
        : verifyClerkWebhook(incomingRequest));

  let event;

  try {
    event = await verifyWebhook(request);
  } catch {
    return json(
      {
        error: "webhook verification failed."
      },
      400
    );
  }

  if (event.type !== "user.created" || typeof event.data !== "object" || !event.data) {
    return json({ ignored: true });
  }

  const data = event.data as {
    email_addresses?: Array<{ email_address?: string }>;
    id?: string;
  };

  const email = data.email_addresses?.[0]?.email_address;

  await syncInvitationsFromClerkUserCreated(repository, {
    userId: data.id,
    email
  });

  return json({ synced: true });
}

export function requireWorkspaceRole(role: unknown): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "member" || role === "viewer") {
    return role;
  }

  throw new WorkspaceError(400, "role is invalid.");
}
