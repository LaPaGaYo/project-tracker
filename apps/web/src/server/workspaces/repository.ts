import { and, desc, eq } from "drizzle-orm";

import { db } from "@the-platform/db";
import {
  invitations,
  workspaces,
  workspaceMembers
} from "@the-platform/db";
import type { InvitationRecord, WorkspaceMemberRecord, WorkspaceRecord } from "@the-platform/shared";

import type { WorkspaceRepository } from "./types";

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function serializeWorkspace(row: typeof workspaces.$inferSelect): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeMember(row: typeof workspaceMembers.$inferSelect): WorkspaceMemberRecord {
  return {
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role,
    invitedAt: row.invitedAt.toISOString(),
    joinedAt: toIso(row.joinedAt)
  };
}

function serializeInvitation(row: typeof invitations.$inferSelect): InvitationRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invitedBy,
    createdAt: row.createdAt.toISOString()
  };
}

export function createWorkspaceRepository(): WorkspaceRepository {
  return {
    async createWorkspace(input) {
      const [workspace] = await db
        .insert(workspaces)
        .values({
          name: input.name,
          slug: input.slug
        })
        .returning();

      if (!workspace) {
        throw new Error("Failed to create workspace.");
      }

      return serializeWorkspace(workspace);
    },

    async findWorkspaceBySlug(slug) {
      const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
      return workspace ? serializeWorkspace(workspace) : null;
    },

    async listWorkspacesForUser(userId) {
      const rows = await db
        .select({
          workspace: workspaces,
          role: workspaceMembers.role
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(workspaceMembers.userId, userId))
        .orderBy(desc(workspaces.updatedAt));

      return rows.map((row) => ({
        ...serializeWorkspace(row.workspace),
        role: row.role
      }));
    },

    async getWorkspaceById(workspaceId) {
      const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
      return workspace ? serializeWorkspace(workspace) : null;
    },

    async updateWorkspace(workspaceId, updates) {
      const [workspace] = await db
        .update(workspaces)
        .set({
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.slug ? { slug: updates.slug } : {}),
          updatedAt: new Date()
        })
        .where(eq(workspaces.id, workspaceId))
        .returning();

      return workspace ? serializeWorkspace(workspace) : null;
    },

    async addMembership(input) {
      const [membership] = await db
        .insert(workspaceMembers)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          role: input.role,
          invitedAt: input.invitedAt ? new Date(input.invitedAt) : new Date(),
          joinedAt: input.joinedAt ? new Date(input.joinedAt) : new Date()
        })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: {
            role: input.role,
            invitedAt: input.invitedAt ? new Date(input.invitedAt) : new Date(),
            joinedAt: input.joinedAt ? new Date(input.joinedAt) : new Date()
          }
        })
        .returning();

      if (!membership) {
        throw new Error("Failed to save workspace membership.");
      }

      return serializeMember(membership);
    },

    async getMembership(workspaceId, userId) {
      const [membership] = await db
        .select()
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
        .limit(1);

      return membership ? serializeMember(membership) : null;
    },

    async listMembers(workspaceId) {
      const rows = await db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .orderBy(desc(workspaceMembers.joinedAt), desc(workspaceMembers.invitedAt));

      return rows.map(serializeMember);
    },

    async updateMembershipRole(workspaceId, userId, role) {
      return db.transaction(async (tx) => {
        const [workspace] = await tx
          .select({
            id: workspaces.id
          })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .limit(1)
          .for("update");

        if (!workspace) {
          return null;
        }

        const [currentMembership] = await tx
          .select()
          .from(workspaceMembers)
          .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
          .limit(1);

        if (!currentMembership) {
          return null;
        }

        if (currentMembership.role === "owner" && role !== "owner") {
          const owners = await tx
            .select({
              userId: workspaceMembers.userId
            })
            .from(workspaceMembers)
            .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner")));

          if (owners.length <= 1) {
            return null;
          }
        }

        const [membership] = await tx
          .update(workspaceMembers)
          .set({
            role
          })
          .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
          .returning();

        return membership ? serializeMember(membership) : null;
      });
    },

    async removeMembership(workspaceId, userId) {
      return db.transaction(async (tx) => {
        const [workspace] = await tx
          .select({
            id: workspaces.id
          })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .limit(1)
          .for("update");

        if (!workspace) {
          return false;
        }

        const [currentMembership] = await tx
          .select()
          .from(workspaceMembers)
          .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
          .limit(1);

        if (!currentMembership) {
          return false;
        }

        if (currentMembership.role === "owner") {
          const owners = await tx
            .select({
              userId: workspaceMembers.userId
            })
            .from(workspaceMembers)
            .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner")));

          if (owners.length <= 1) {
            return false;
          }
        }

        const deleted = await tx
          .delete(workspaceMembers)
          .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
          .returning({
            userId: workspaceMembers.userId
          });

        return deleted.length > 0;
      });
    },

    async createInvitation(input) {
      const [invitation] = await db
        .insert(invitations)
        .values({
          workspaceId: input.workspaceId,
          email: input.email,
          role: input.role,
          invitedBy: input.invitedBy
        })
        .returning();

      if (!invitation) {
        throw new Error("Failed to create invitation.");
      }

      return serializeInvitation(invitation);
    },

    async listPendingInvitations(workspaceId) {
      const rows = await db
        .select()
        .from(invitations)
        .where(and(eq(invitations.workspaceId, workspaceId), eq(invitations.status, "pending")))
        .orderBy(desc(invitations.createdAt));

      return rows.map(serializeInvitation);
    },

    async findPendingInvitationsByEmail(email) {
      const rows = await db
        .select()
        .from(invitations)
        .where(and(eq(invitations.email, email), eq(invitations.status, "pending")))
        .orderBy(desc(invitations.createdAt));

      return rows.map(serializeInvitation);
    },

    async updateInvitationStatus(invitationId, status) {
      const [invitation] = await db
        .update(invitations)
        .set({
          status
        })
        .where(eq(invitations.id, invitationId))
        .returning();

      return invitation ? serializeInvitation(invitation) : null;
    }
  };
}
