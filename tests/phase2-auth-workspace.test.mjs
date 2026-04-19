import assert from "node:assert/strict";
import test from "node:test";

import * as workspaceService from "../apps/web/src/server/workspaces/service.ts";
import {
  createInvitationForUser,
  createWorkspaceForUser,
  getWorkspaceDetailsForUser,
  removeWorkspaceMemberForUser,
  syncInvitationsFromClerkUserCreated,
  updateWorkspaceMemberRoleForUser,
  WorkspaceError
} from "../apps/web/src/server/workspaces/service.ts";

class MemoryWorkspaceRepository {
  workspaceCounter = 0;
  invitationCounter = 0;
  workspaces = new Map();
  memberships = new Map();
  invitations = new Map();

  async createWorkspace(input) {
    const id = `workspace-${++this.workspaceCounter}`;
    const record = {
      id,
      name: input.name,
      slug: input.slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(id, record);
    return record;
  }

  async findWorkspaceBySlug(slug) {
    return Array.from(this.workspaces.values()).find((workspace) => workspace.slug === slug) ?? null;
  }

  async listWorkspacesForUser(userId) {
    const summaries = [];

    for (const membership of this.memberships.values()) {
      if (membership.userId !== userId) {
        continue;
      }

      const workspace = this.workspaces.get(membership.workspaceId);
      if (!workspace) {
        continue;
      }

      summaries.push({
        ...workspace,
        role: membership.role
      });
    }

    return summaries;
  }

  async getWorkspaceById(workspaceId) {
    return this.workspaces.get(workspaceId) ?? null;
  }

  async updateWorkspace(workspaceId, updates) {
    const current = this.workspaces.get(workspaceId);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      name: updates.name ?? current.name,
      slug: updates.slug ?? current.slug,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, updated);
    return updated;
  }

  async addMembership(input) {
    const record = {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      invitedAt: input.invitedAt ?? new Date().toISOString(),
      joinedAt: input.joinedAt ?? new Date().toISOString()
    };

    this.memberships.set(`${input.workspaceId}:${input.userId}`, record);
    return record;
  }

  async getMembership(workspaceId, userId) {
    return this.memberships.get(`${workspaceId}:${userId}`) ?? null;
  }

  async listMembers(workspaceId) {
    return Array.from(this.memberships.values()).filter((membership) => membership.workspaceId === workspaceId);
  }

  async updateMembershipRole(workspaceId, userId, role) {
    const current = this.memberships.get(`${workspaceId}:${userId}`);
    if (!current) {
      return null;
    }

    if (current.role === "owner" && role !== "owner") {
      const ownerCount = Array.from(this.memberships.values()).filter(
        (membership) => membership.workspaceId === workspaceId && membership.role === "owner"
      ).length;

      if (ownerCount <= 1) {
        return null;
      }
    }

    const updated = {
      ...current,
      role
    };

    this.memberships.set(`${workspaceId}:${userId}`, updated);
    return updated;
  }

  async removeMembership(workspaceId, userId) {
    const current = this.memberships.get(`${workspaceId}:${userId}`);
    if (!current) {
      return false;
    }

    if (current.role === "owner") {
      const ownerCount = Array.from(this.memberships.values()).filter(
        (membership) => membership.workspaceId === workspaceId && membership.role === "owner"
      ).length;

      if (ownerCount <= 1) {
        return false;
      }
    }

    return this.memberships.delete(`${workspaceId}:${userId}`);
  }

  async createInvitation(input) {
    const id = `invite-${++this.invitationCounter}`;
    const record = {
      id,
      workspaceId: input.workspaceId,
      email: input.email,
      role: input.role,
      status: "pending",
      invitedBy: input.invitedBy,
      createdAt: new Date().toISOString()
    };

    this.invitations.set(id, record);
    return record;
  }

  async listPendingInvitations(workspaceId) {
    return Array.from(this.invitations.values()).filter(
      (invitation) => invitation.workspaceId === workspaceId && invitation.status === "pending"
    );
  }

  async findPendingInvitationsByEmail(email) {
    return Array.from(this.invitations.values()).filter(
      (invitation) => invitation.email === email && invitation.status === "pending"
    );
  }

  async updateInvitationStatus(invitationId, status) {
    const current = this.invitations.get(invitationId);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      status
    };

    this.invitations.set(invitationId, updated);
    return updated;
  }
}

class InterleavingOwnerMutationRepository extends MemoryWorkspaceRepository {
  demoteDifferentOwner(workspaceId, userId) {
    for (const [key, membership] of this.memberships.entries()) {
      if (membership.workspaceId !== workspaceId || membership.userId === userId || membership.role !== "owner") {
        continue;
      }

      this.memberships.set(key, {
        ...membership,
        role: "admin"
      });
      return;
    }
  }

  removeDifferentOwner(workspaceId, userId) {
    for (const [key, membership] of this.memberships.entries()) {
      if (membership.workspaceId !== workspaceId || membership.userId === userId || membership.role !== "owner") {
        continue;
      }

      this.memberships.delete(key);
      return;
    }
  }

  async updateMembershipRole(workspaceId, userId, role) {
    this.demoteDifferentOwner(workspaceId, userId);
    return super.updateMembershipRole(workspaceId, userId, role);
  }

  async removeMembership(workspaceId, userId) {
    this.removeDifferentOwner(workspaceId, userId);
    return super.removeMembership(workspaceId, userId);
  }
}

function createSession(userId, email) {
  return {
    userId,
    email,
    displayName: email,
    provider: "demo"
  };
}

test("workspace creation creates an owner membership", async () => {
  const repository = new MemoryWorkspaceRepository();
  const workspace = await createWorkspaceForUser(repository, createSession("user_owner", "owner@example.com"), {
    name: "Alpha Workspace"
  });

  assert.equal(workspace.slug, "alpha-workspace");

  const memberships = await repository.listMembers(workspace.id);
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0]?.role, "owner");
});

test("cross-tenant workspace access returns 403", async () => {
  const repository = new MemoryWorkspaceRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner",
    role: "owner"
  });

  await assert.rejects(
    getWorkspaceDetailsForUser(repository, createSession("user_other", "other@example.com"), workspace.id),
    (error) => error instanceof WorkspaceError && error.status === 403
  );
});

test("viewer role cannot create invitations", async () => {
  const repository = new MemoryWorkspaceRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_viewer",
    role: "viewer"
  });

  await assert.rejects(
    createInvitationForUser(repository, createSession("user_viewer", "viewer@example.com"), workspace.id, {
      email: "invitee@example.com",
      role: "member"
    }),
    (error) => error instanceof WorkspaceError && error.status === 403
  );
});

test("user.created webhook accepts matching pending invitations", async () => {
  const repository = new MemoryWorkspaceRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner",
    role: "owner"
  });

  await repository.createInvitation({
    workspaceId: workspace.id,
    email: "invitee@example.com",
    role: "member",
    invitedBy: "user_owner"
  });

  await syncInvitationsFromClerkUserCreated(repository, {
    userId: "user_invited",
    email: "invitee@example.com"
  });

  const membership = await repository.getMembership(workspace.id, "user_invited");
  assert.ok(membership);
  assert.equal(membership.role, "member");

  const invitations = await repository.findPendingInvitationsByEmail("invitee@example.com");
  assert.equal(invitations.length, 0);
});

test("webhook rejects unsigned payloads before syncing invitations", async () => {
  const repository = new MemoryWorkspaceRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner",
    role: "owner"
  });

  await repository.createInvitation({
    workspaceId: workspace.id,
    email: "invitee@example.com",
    role: "member",
    invitedBy: "user_owner"
  });

  const request = new Request("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      type: "user.created",
      data: {
        id: "user_invited",
        email_addresses: [{ email_address: "invitee@example.com" }]
      }
    })
  });

  const response = await workspaceService.syncInvitationsFromClerkWebhookRequest(repository, request, {
    verifyWebhook: async () => {
      throw new Error("invalid signature");
    }
  });

  assert.equal(response.status, 400);
  assert.equal(await repository.getMembership(workspace.id, "user_invited"), null);

  const invitations = await repository.findPendingInvitationsByEmail("invitee@example.com");
  assert.equal(invitations.length, 1);
});

test("last workspace owner cannot demote themselves", async () => {
  const repository = new MemoryWorkspaceRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner",
    role: "owner"
  });

  await assert.rejects(
    updateWorkspaceMemberRoleForUser(
      repository,
      createSession("user_owner", "owner@example.com"),
      workspace.id,
      "user_owner",
      "admin"
    ),
    (error) =>
      error instanceof WorkspaceError &&
      error.status === 409 &&
      error.message === "workspace must retain at least one owner."
  );
});

test("last workspace owner cannot be removed", async () => {
  const repository = new MemoryWorkspaceRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner",
    role: "owner"
  });

  await assert.rejects(
    removeWorkspaceMemberForUser(
      repository,
      createSession("user_owner", "owner@example.com"),
      workspace.id,
      "user_owner"
    ),
    (error) =>
      error instanceof WorkspaceError &&
      error.status === 409 &&
      error.message === "workspace must retain at least one owner."
  );
});

test("owner demotion stays blocked if another owner changes between check and write", async () => {
  const repository = new InterleavingOwnerMutationRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner_a",
    role: "owner"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner_b",
    role: "owner"
  });

  await assert.rejects(
    updateWorkspaceMemberRoleForUser(
      repository,
      createSession("user_owner_a", "owner-a@example.com"),
      workspace.id,
      "user_owner_a",
      "admin"
    ),
    (error) =>
      error instanceof WorkspaceError &&
      error.status === 409 &&
      error.message === "workspace must retain at least one owner."
  );

  const members = await repository.listMembers(workspace.id);
  assert.equal(
    members.filter((member) => member.role === "owner").length,
    1
  );
});

test("owner removal stays blocked if another owner changes between check and delete", async () => {
  const repository = new InterleavingOwnerMutationRepository();
  const workspace = await repository.createWorkspace({
    name: "Alpha Workspace",
    slug: "alpha-workspace"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner_a",
    role: "owner"
  });

  await repository.addMembership({
    workspaceId: workspace.id,
    userId: "user_owner_b",
    role: "owner"
  });

  await assert.rejects(
    removeWorkspaceMemberForUser(
      repository,
      createSession("user_owner_a", "owner-a@example.com"),
      workspace.id,
      "user_owner_a"
    ),
    (error) =>
      error instanceof WorkspaceError &&
      error.status === 409 &&
      error.message === "workspace must retain at least one owner."
  );

  const members = await repository.listMembers(workspace.id);
  assert.equal(
    members.filter((member) => member.role === "owner").length,
    1
  );
});
