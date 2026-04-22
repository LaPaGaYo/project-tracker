import type {
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
