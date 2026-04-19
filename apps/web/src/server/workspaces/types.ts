import type {
  InvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
  WorkspaceRole,
  WorkspaceSummary
} from "@the-platform/shared";

export interface AppSession {
  userId: string;
  email: string | null;
  displayName: string | null;
  provider: "clerk" | "demo";
}

export interface WorkspaceRepository {
  createWorkspace(input: { name: string; slug: string }): Promise<WorkspaceRecord>;
  findWorkspaceBySlug(slug: string): Promise<WorkspaceRecord | null>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]>;
  getWorkspaceById(workspaceId: string): Promise<WorkspaceRecord | null>;
  updateWorkspace(
    workspaceId: string,
    updates: {
      name?: string;
      slug?: string;
    }
  ): Promise<WorkspaceRecord | null>;
  addMembership(input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
    invitedAt?: string;
    joinedAt?: string | null;
  }): Promise<WorkspaceMemberRecord>;
  getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | null>;
  listMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]>;
  updateMembershipRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<WorkspaceMemberRecord | null>;
  removeMembership(workspaceId: string, userId: string): Promise<boolean>;
  createInvitation(input: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedBy: string;
  }): Promise<InvitationRecord>;
  listPendingInvitations(workspaceId: string): Promise<InvitationRecord[]>;
  findPendingInvitationsByEmail(email: string): Promise<InvitationRecord[]>;
  updateInvitationStatus(
    invitationId: string,
    status: InvitationRecord["status"]
  ): Promise<InvitationRecord | null>;
}
