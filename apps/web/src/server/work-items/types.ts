import type { ProjectRecord, WorkflowStateRecord, WorkItemRecord } from "@the-platform/shared";

import type { WorkspaceRepository } from "../workspaces/types.ts";

export interface CreateWorkItemInput {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  parentId?: unknown;
  assigneeId?: unknown;
  priority?: unknown;
  labels?: unknown;
  workflowStateId?: unknown;
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
  dueDate?: unknown;
  blockedReason?: unknown;
  position?: unknown;
}

export interface ListWorkItemFilters {
  type?: string;
  workflowStateId?: string;
  assigneeId?: string;
}

export interface WorkItemRepository
  extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership" | "listMembers"> {
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  listWorkflowStates(projectId: string): Promise<WorkflowStateRecord[]>;
  getWorkflowState(projectId: string, stateId: string): Promise<WorkflowStateRecord | null>;
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
      dueDate?: string | null;
      blockedReason?: string | null;
      position?: number;
      status?: WorkItemRecord["status"];
      workspaceId: string;
      actorId: string;
    }
  ): Promise<WorkItemRecord | null>;
  deleteWorkItem(projectId: string, identifier: string, workspaceId: string, actorId: string): Promise<boolean>;
  getWorkItemCreatorId(workItemId: string): Promise<string | null>;
}
