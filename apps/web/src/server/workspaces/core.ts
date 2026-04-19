import type { WorkspaceRole } from "@the-platform/shared";

import type { AppSession, WorkspaceRepository } from "./types";

const roleRank: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};

export class WorkspaceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WorkspaceError";
    this.status = status;
  }
}

export function hasMinimumRole(currentRole: WorkspaceRole, minimumRole: WorkspaceRole) {
  return roleRank[currentRole] >= roleRank[minimumRole];
}

export async function requireWorkspaceMembership(
  repository: Pick<WorkspaceRepository, "getMembership">,
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

export function requireWorkspaceRole(role: unknown): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "member" || role === "viewer") {
    return role;
  }

  throw new WorkspaceError(400, "role is invalid.");
}
