import type { GithubRepositoryRecord, ProjectGithubConnectionRecord, ProjectRecord } from "@the-platform/shared";

import type { WorkspaceRepository } from "../workspaces/types";

export interface CreateProjectGithubConnectionInput {
  providerRepositoryId?: unknown;
  owner?: unknown;
  name?: unknown;
  fullName?: unknown;
  defaultBranch?: unknown;
  installationId?: unknown;
  stagingEnvironmentName?: unknown;
  productionEnvironmentName?: unknown;
}

export interface ProjectGithubConnectionView {
  connection: ProjectGithubConnectionRecord;
  repository: GithubRepositoryRecord;
}

export interface GithubConnectionRepository extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership"> {
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
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
