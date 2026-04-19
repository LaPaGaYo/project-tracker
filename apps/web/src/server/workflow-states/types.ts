import type { ProjectRecord, WorkflowStateCategory, WorkflowStateRecord } from "@the-platform/shared";

import type { WorkspaceRepository } from "../workspaces/types";

export interface CreateWorkflowStateInput {
  name?: unknown;
  category?: unknown;
  color?: unknown;
  position?: unknown;
}

export interface UpdateWorkflowStateInput {
  name?: unknown;
  category?: unknown;
  color?: unknown;
  position?: unknown;
}

export interface WorkflowStateRepository
  extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership"> {
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  listWorkflowStates(projectId: string): Promise<WorkflowStateRecord[]>;
  getWorkflowState(projectId: string, stateId: string): Promise<WorkflowStateRecord | null>;
  createWorkflowState(input: {
    projectId: string;
    workspaceId: string;
    name: string;
    category: WorkflowStateCategory;
    color: string | null;
    position?: number;
    actorId: string;
  }): Promise<WorkflowStateRecord>;
  updateWorkflowState(
    projectId: string,
    stateId: string,
    input: {
      workspaceId: string;
      name?: string;
      category?: WorkflowStateCategory;
      color?: string | null;
      position?: number;
      actorId: string;
    }
  ): Promise<WorkflowStateRecord | null>;
  deleteWorkflowState(
    projectId: string,
    stateId: string,
    workspaceId: string,
    actorId: string
  ): Promise<"deleted" | "not_found" | "has_items">;
}
