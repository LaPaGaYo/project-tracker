import type { ProjectRepository } from "../projects/types";
import {
  requireNonEmptyString,
  requireRoleAtLeast,
  resolveWorkspaceContext
} from "../work-management/utils";
import { WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";

import type { GithubAppInstallationClient } from "./app-installation";
import { importGithubProjectForUser, type ImportGithubProjectResult } from "./import";
import type { GithubConnectionRepository } from "./types";

export interface ImportGithubInstallationRepositoryInput {
  providerRepositoryId?: unknown;
  projectName?: unknown;
  key?: unknown;
  description?: unknown;
  stagingEnvironmentName?: unknown;
  productionEnvironmentName?: unknown;
}

export async function importGithubInstallationRepositoryForUser(
  dependencies: {
    projectRepository: ProjectRepository;
    githubRepository: GithubConnectionRepository;
    installationClient: GithubAppInstallationClient;
  },
  session: AppSession,
  workspaceSlug: string,
  installationIdInput: unknown,
  input: ImportGithubInstallationRepositoryInput
): Promise<ImportGithubProjectResult> {
  const { membership } = await resolveWorkspaceContext(dependencies.projectRepository, session, workspaceSlug, "viewer");
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can import GitHub projects.");

  const installationId = requireNonEmptyString(installationIdInput, "installationId");
  const providerRepositoryId = requireNonEmptyString(input.providerRepositoryId, "providerRepositoryId");
  const repositories = await dependencies.installationClient.listRepositories(installationId);
  const selected = repositories.find((repository) => repository.providerRepositoryId === providerRepositoryId);

  if (!selected) {
    throw new WorkspaceError(404, "selected repository is not available to this GitHub installation.");
  }

  return importGithubProjectForUser(
    {
      projectRepository: dependencies.projectRepository,
      githubRepository: dependencies.githubRepository
    },
    session,
    workspaceSlug,
    {
      providerRepositoryId: selected.providerRepositoryId,
      owner: selected.owner,
      name: selected.name,
      fullName: selected.fullName,
      defaultBranch: selected.defaultBranch,
      installationId,
      projectName: input.projectName,
      key: input.key,
      description: input.description,
      stagingEnvironmentName: input.stagingEnvironmentName,
      productionEnvironmentName: input.productionEnvironmentName
    }
  );
}
