import type {
  GithubIssueState,
  GithubIssueSyncStatus,
  GithubRepositoryRecord,
  ProjectGithubConnectionRecord,
  ProjectRecord,
  TaskStatus,
  WorkflowStateRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
  WorkItemPriority,
  WorkItemRecord,
  WorkItemType
} from "@the-platform/shared";

export interface NormalizedGithubIssue {
  providerIssueId: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: GithubIssueState;
  authorLogin: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
  githubClosedAt: string | null;
  isPullRequest: boolean;
}

export interface NormalizedGithubIssueComment {
  providerCommentId: string;
  body: string;
  url: string;
  authorLogin: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
}

export interface GithubIssueSyncView {
  status: GithubIssueSyncStatus;
  issueNumber: number;
  issueUrl: string;
  repositoryFullName: string;
  conflictFields: string[];
  errorMessage: string | null;
  syncEnabled: boolean;
}

export interface GithubIssueWithComments extends NormalizedGithubIssue {
  comments: NormalizedGithubIssueComment[];
}

export interface GithubIssueImportTarget {
  owner: string;
  name: string;
  fullName: string;
  installationId: string;
}

export interface GithubIssueImportOptions {
  includeClosed?: boolean;
}

export interface GithubIssueImportClient {
  getRepositoryIssuesSnapshot(
    target: GithubIssueImportTarget,
    options?: GithubIssueImportOptions
  ): Promise<GithubIssueWithComments[]>;
}

export interface ImportGithubIssuesSummary {
  created: number;
  updated: number;
  skippedPullRequests: number;
  conflicted: number;
  failed: number;
}

export interface GithubIssueSyncSettings {
  syncEnabled: boolean;
  importClosedIssues: boolean;
  syncTitle: boolean;
  syncBody: boolean;
  syncState: boolean;
  closedWorkflowStateId: string | null;
  reopenedWorkflowStateId: string | null;
}

export interface ProjectGithubConnectionWithRepository {
  connection: ProjectGithubConnectionRecord;
  repository: GithubRepositoryRecord;
}

export interface GithubIssueProjectionRecord {
  id: string;
  repositoryId: string;
  providerIssueId: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: GithubIssueState;
  authorLogin: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
  githubClosedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubIssueLinkRecord {
  id: string;
  workItemId: string;
  repositoryId: string;
  githubIssueId: string;
  source: string;
  syncStatus: GithubIssueSyncStatus;
  syncEnabled: boolean;
  syncTitle: boolean;
  syncBody: boolean;
  syncState: boolean;
  lastSyncedGithubUpdatedAt: string | null;
  lastSyncedWorkItemUpdatedAt: string | null;
  lastSyncedTitleHash: string | null;
  lastSyncedBodyHash: string | null;
  lastSyncedState: GithubIssueState | null;
  conflictFields: string[] | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubIssueCommentProjectionRecord {
  id: string;
  githubIssueId: string;
  providerCommentId: string;
  body: string;
  url: string;
  authorLogin: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
  githubDeletedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubIssueSyncRepository {
  findWorkspaceBySlug(slug: string): Promise<WorkspaceRecord | null>;
  getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | null>;
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  getProjectGithubConnection(projectId: string): Promise<ProjectGithubConnectionWithRepository | null>;
  getGithubIssueSyncSettings(projectId: string): Promise<GithubIssueSyncSettings | null>;
  listWorkflowStates(projectId: string): Promise<WorkflowStateRecord[]>;
  upsertGithubIssue(
    input: Omit<GithubIssueProjectionRecord, "id" | "lastSyncedAt" | "createdAt" | "updatedAt">
  ): Promise<GithubIssueProjectionRecord>;
  getGithubIssueLinkByIssueId(githubIssueId: string): Promise<GithubIssueLinkRecord | null>;
  createWorkItemForGithubIssue(input: {
    projectId: string;
    workspaceId: string;
    title: string;
    description: string;
    type: WorkItemType;
    priority: WorkItemPriority;
    status: TaskStatus;
    workflowStateId: string | null;
    stageId: string | null;
    planItemId: string | null;
    position: number;
    completedAt: string | null;
    actorId: string;
  }): Promise<WorkItemRecord>;
  updateWorkItemFromGithubIssue(input: {
    projectId: string;
    workspaceId: string;
    workItemId: string;
    title?: string;
    description?: string;
    status?: TaskStatus;
    workflowStateId?: string | null;
    completedAt?: string | null;
    actorId: string;
  }): Promise<WorkItemRecord | null>;
  upsertGithubIssueLink(input: {
    workItemId: string;
    repositoryId: string;
    githubIssueId: string;
    source: string;
    syncStatus: GithubIssueSyncStatus;
    syncEnabled: boolean;
    syncTitle: boolean;
    syncBody: boolean;
    syncState: boolean;
    lastSyncedGithubUpdatedAt: string | null;
    lastSyncedWorkItemUpdatedAt: string | null;
    lastSyncedTitleHash: string | null;
    lastSyncedBodyHash: string | null;
    lastSyncedState: GithubIssueState | null;
    conflictFields: string[] | null;
    errorMessage: string | null;
  }): Promise<GithubIssueLinkRecord>;
  upsertGithubIssueComment(
    input: Omit<GithubIssueCommentProjectionRecord, "id" | "githubDeletedAt" | "lastSyncedAt" | "createdAt" | "updatedAt">
  ): Promise<GithubIssueCommentProjectionRecord | void>;
}
