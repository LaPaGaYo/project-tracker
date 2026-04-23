import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubPullRequestState,
  GithubRepositoryProvider,
  GithubWebhookDeliveryStatus,
  GithubWebhookEventName,
  InvitationStatus,
  PlanItemStatus,
  ProjectStage,
  StageStatus,
  TaskStatus,
  TaskGithubCiStatus,
  TaskGithubDeployStatus,
  TaskGithubPrStatus,
  WorkflowStateCategory,
  WorkspaceRole,
  WorkItemGithubLinkSource,
  WorkItemPriority,
  WorkItemType
} from "./constants";

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  key: string;
  itemCounter: number;
  title: string;
  description: string;
  stage: ProjectStage;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  identifier: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  type: WorkItemType;
  parentId: string | null;
  assigneeId: string | null;
  priority: WorkItemPriority;
  labels: string[] | null;
  workflowStateId: string | null;
  stageId: string | null;
  planItemId: string | null;
  position: number;
  blockedReason: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskRecord = WorkItemRecord;

export interface WorkflowStateRecord {
  id: string;
  projectId: string;
  name: string;
  category: WorkflowStateCategory;
  position: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStageRecord {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  goal: string;
  status: StageStatus;
  gateStatus: string;
  sortOrder: number;
}

export interface PlanItemRecord {
  id: string;
  stageId: string;
  title: string;
  outcome: string;
  status: PlanItemStatus;
  blocker: string | null;
  sortOrder: number;
}

export interface TaskGithubStatusRecord {
  id: string;
  taskId: string;
  prStatus: TaskGithubPrStatus;
  ciStatus: TaskGithubCiStatus;
  deployStatus: TaskGithubDeployStatus;
}

export interface GithubRepositoryRecord {
  id: string;
  workspaceId: string;
  provider: GithubRepositoryProvider;
  providerRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  installationId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGithubConnectionRecord {
  id: string;
  projectId: string;
  repositoryId: string;
  stagingEnvironmentName: string | null;
  productionEnvironmentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubPullRequestRecord {
  id: string;
  repositoryId: string;
  providerPullRequestId: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: GithubPullRequestState;
  isDraft: boolean;
  authorLogin: string | null;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  mergedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubCheckRollupRecord {
  id: string;
  repositoryId: string;
  headSha: string;
  status: GithubCheckRollupStatus;
  url: string | null;
  checkCount: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubDeploymentRecord {
  id: string;
  repositoryId: string;
  providerDeploymentId: string;
  headSha: string;
  environmentName: string | null;
  environment: GithubDeploymentEnvironment;
  status: GithubDeploymentStatus;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemGithubLinkRecord {
  id: string;
  workItemId: string;
  repositoryId: string;
  pullRequestId: string | null;
  branchName: string | null;
  source: WorkItemGithubLinkSource;
  confidence: number;
  linkedAt: string;
}

export interface GithubWebhookDeliveryRecord {
  id: string;
  repositoryId: string | null;
  deliveryId: string;
  eventName: GithubWebhookEventName;
  status: GithubWebhookDeliveryStatus;
  receivedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummary extends WorkspaceRecord {
  role: WorkspaceRole;
}

export interface WorkspaceMemberRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedAt: string;
  joinedAt: string | null;
}

export interface InvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: string;
}

export interface ActivityLogRecord {
  id: string;
  workspaceId: string;
  entityType: "project" | "work_item" | "workflow_state";
  entityId: string;
  action: "created" | "updated" | "deleted" | "assigned" | "moved" | "state_changed";
  actorId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CommentRecord {
  id: string;
  workItemId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DescriptionVersionRecord {
  id: string;
  workItemId: string;
  content: string;
  authorId: string;
  createdAt: string;
}
