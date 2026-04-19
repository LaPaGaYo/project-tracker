import type { ProjectRecord, ProjectStage, WorkflowStateRecord } from "@the-platform/shared";

import type { WorkspaceRepository } from "../workspaces/types";

export interface CreateProjectInput {
  name?: unknown;
  description?: unknown;
  key?: unknown;
  stage?: unknown;
  dueDate?: unknown;
}

export interface UpdateProjectInput {
  name?: unknown;
  description?: unknown;
  stage?: unknown;
  dueDate?: unknown;
}

export interface ProjectWithCounts extends ProjectRecord {
  workItemCount: number;
  backlogItemCount: number;
  activeItemCount: number;
  doneItemCount: number;
}

export interface ProjectRepository extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership"> {
  createProject(input: {
    workspaceId: string;
    title: string;
    description: string;
    key: string;
    stage: ProjectStage;
    dueDate: string | null;
    actorId: string;
  }): Promise<ProjectRecord>;
  listProjects(workspaceId: string): Promise<ProjectWithCounts[]>;
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  updateProject(
    projectId: string,
    input: {
      title?: string;
      description?: string;
      stage?: ProjectStage;
      dueDate?: string | null;
      actorId: string;
      workspaceId: string;
    }
  ): Promise<ProjectRecord | null>;
  deleteProject(projectId: string, workspaceId: string, actorId: string): Promise<boolean>;
  listWorkflowStates(projectId: string): Promise<WorkflowStateRecord[]>;
}
