import { WorkspaceError } from "../workspaces/core";
import {
  normalizeOptionalString,
  requireNonEmptyString,
  requireRoleAtLeast,
  resolveWorkspaceContext
} from "../work-management/utils";

import type { AppSession } from "../workspaces/types";

import type {
  CreateProjectGithubConnectionInput,
  GithubConnectionRepository,
  ProjectGithubConnectionView
} from "./types";

async function resolveProjectContext(
  repository: GithubConnectionRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { workspace, membership } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");
  const project = await repository.getProjectByKey(workspace.id, projectKey);

  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  return {
    workspace,
    membership,
    project
  };
}

function normalizeFullName(owner: string, name: string, fullName: unknown) {
  return normalizeOptionalString(fullName) ?? `${owner}/${name}`;
}

function translateConnectionError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "project already has a primary GitHub repository.") {
      throw new WorkspaceError(409, error.message);
    }

    if (error.message === "repository is already connected to another project.") {
      throw new WorkspaceError(409, error.message);
    }
  }

  throw error;
}

export async function connectProjectGithubRepositoryForUser(
  repository: GithubConnectionRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  input: CreateProjectGithubConnectionInput
): Promise<ProjectGithubConnectionView> {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can connect GitHub repositories.");

  const existingConnection = await repository.getProjectGithubConnection(project.id);
  if (existingConnection) {
    throw new WorkspaceError(409, "project already has a primary GitHub repository.");
  }

  const owner = requireNonEmptyString(input.owner, "owner");
  const name = requireNonEmptyString(input.name, "name");

  try {
    return await repository.createProjectGithubConnection({
      projectId: project.id,
      workspaceId: workspace.id,
      providerRepositoryId: requireNonEmptyString(input.providerRepositoryId, "providerRepositoryId"),
      owner,
      name,
      fullName: normalizeFullName(owner, name, input.fullName),
      defaultBranch: requireNonEmptyString(input.defaultBranch, "defaultBranch"),
      installationId: requireNonEmptyString(input.installationId, "installationId"),
      stagingEnvironmentName: normalizeOptionalString(input.stagingEnvironmentName) ?? null,
      productionEnvironmentName: normalizeOptionalString(input.productionEnvironmentName) ?? null,
      actorId: session.userId
    });
  } catch (error) {
    translateConnectionError(error);
  }
}

export async function getProjectGithubConnectionForUser(
  repository: GithubConnectionRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  return repository.getProjectGithubConnection(project.id);
}
