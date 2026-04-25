import type {
  DescriptionVersionRecord,
  PlanItemRecord,
  ProjectRecord,
  ProjectStageRecord,
  WorkflowStateRecord,
  WorkItemRecord
} from "@the-platform/shared";

import type { NotificationRepository } from "../notifications/types";
import type { WorkspaceRepository } from "../workspaces/types";

export interface CreateWorkItemInput {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  parentId?: unknown;
  assigneeId?: unknown;
  priority?: unknown;
  labels?: unknown;
  workflowStateId?: unknown;
  stageId?: unknown;
  planItemId?: unknown;
  dueDate?: unknown;
  blockedReason?: unknown;
  position?: unknown;
}

export interface UpdateWorkItemInput {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  parentId?: unknown;
  assigneeId?: unknown;
  priority?: unknown;
  labels?: unknown;
  workflowStateId?: unknown;
  stageId?: unknown;
  planItemId?: unknown;
  dueDate?: unknown;
  blockedReason?: unknown;
  position?: unknown;
}

export interface MoveWorkItemInput {
  position?: unknown;
  workflowStateId?: unknown;
  affectedItems?: unknown;
}

export interface WorkItemSort {
  field?: "position" | "identifier" | "priority" | "created_at";
  order?: "asc" | "desc";
}

export interface ListWorkItemFilters {
  types?: WorkItemRecord["type"][];
  priorities?: WorkItemRecord["priority"][];
  assigneeId?: string;
  workflowStateIds?: string[];
  sort?: WorkItemSort;
}

export interface WorkItemNotificationDependencies {
  notificationRepository?: NotificationRepository;
}

export interface WorkItemRepository
  extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership" | "listMembers"> {
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  listWorkflowStates(projectId: string): Promise<WorkflowStateRecord[]>;
  getWorkflowState(projectId: string, stateId: string): Promise<WorkflowStateRecord | null>;
  getProjectStage(projectId: string, stageId: string): Promise<ProjectStageRecord | null>;
  getPlanItem(projectId: string, planItemId: string): Promise<PlanItemRecord | null>;
  getWorkItemById(projectId: string, workItemId: string): Promise<WorkItemRecord | null>;
  getWorkItemByIdentifier(projectId: string, identifier: string): Promise<WorkItemRecord | null>;
  createWorkItem(input: {
    projectId: string;
    workspaceId: string;
    title: string;
    description: string;
    type: WorkItemRecord["type"];
    parentId: string | null;
    assigneeId: string | null;
    priority: WorkItemRecord["priority"];
    labels: string[] | null;
    workflowStateId: string | null;
    stageId: string | null;
    planItemId: string | null;
    dueDate: string | null;
    blockedReason: string | null;
    position: number;
    status: WorkItemRecord["status"];
    actorId: string;
  }): Promise<WorkItemRecord>;
  listWorkItems(projectId: string, filters?: ListWorkItemFilters): Promise<WorkItemRecord[]>;
  updateWorkItem(
    projectId: string,
    identifier: string,
    input: {
      title?: string;
      description?: string;
      type?: WorkItemRecord["type"];
      parentId?: string | null;
      assigneeId?: string | null;
      priority?: WorkItemRecord["priority"];
      labels?: string[] | null;
      workflowStateId?: string | null;
      stageId?: string | null;
      planItemId?: string | null;
      dueDate?: string | null;
      blockedReason?: string | null;
      position?: number;
      status?: WorkItemRecord["status"];
      workspaceId: string;
      actorId: string;
    }
  ): Promise<WorkItemRecord | null>;
  moveWorkItem(
    projectId: string,
    identifier: string,
    input: {
      position: number;
      workflowStateId?: string | null;
      status?: WorkItemRecord["status"];
      workspaceId: string;
      actorId: string;
    }
  ): Promise<WorkItemRecord | null>;
  moveWorkItems(
    projectId: string,
    identifier: string,
    input: {
      updates: Array<{
        identifier: string;
        position: number;
        workflowStateId?: string | null;
        status?: WorkItemRecord["status"];
      }>;
      workspaceId: string;
      actorId: string;
    }
  ): Promise<WorkItemRecord | null>;
  deleteWorkItem(projectId: string, identifier: string, workspaceId: string, actorId: string): Promise<boolean>;
  getWorkItemCreatorId(workItemId: string): Promise<string | null>;
  listDescriptionVersions(workItemId: string): Promise<DescriptionVersionRecord[]>;
}
