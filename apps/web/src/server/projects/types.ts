import type {
  PlanItemRecord,
  ProjectRecord,
  ProjectStage,
  ProjectStageRecord,
  TaskGithubStatusRecord,
  WorkflowStateRecord
} from "@the-platform/shared";

import type { ProjectGithubConnectionView } from "../github/types";
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
  listProjectStages(projectId: string): Promise<ProjectStageRecord[]>;
  listPlanItems(projectId: string): Promise<PlanItemRecord[]>;
  listTaskGithubStatuses(projectId: string): Promise<TaskGithubStatusRecord[]>;
  getProjectGithubConnection(projectId: string): Promise<ProjectGithubConnectionView | null>;
  createProjectGithubConnection(input: {
    projectId: string;
    workspaceId: string;
    providerRepositoryId: string;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    installationId: string;
    stagingEnvironmentName: string | null;
    productionEnvironmentName: string | null;
    actorId: string;
  }): Promise<ProjectGithubConnectionView>;
}
