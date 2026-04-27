import type { ProjectRepository } from "../projects/types";
import {
  requireNonEmptyString,
  requireRoleAtLeast,
  resolveWorkspaceContext,
} from "../work-management/utils";
import { WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";

import type { GithubAppInstallationClient } from "./app-installation";
import {
  importGithubProjectForUser,
  type ImportGithubProjectResult,
} from "./import";
import type { GithubConnectionRepository } from "./types";
import type { GithubUserAuthorizationProof } from "./user-authorization-state";

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
    authorizationProof: GithubUserAuthorizationProof | null;
  },
  session: AppSession,
  workspaceSlug: string,
  installationIdInput: unknown,
  input: ImportGithubInstallationRepositoryInput
): Promise<ImportGithubProjectResult> {
  const { membership } = await resolveWorkspaceContext(
    dependencies.projectRepository,
    session,
    workspaceSlug,
    "viewer"
  );
  requireRoleAtLeast(
    membership.role,
    "admin",
    "only owners and admins can import GitHub projects."
  );

  const installationId = requireNonEmptyString(
    installationIdInput,
    "installationId"
  );
  const proof = dependencies.authorizationProof;
  if (!proof) {
    throw new WorkspaceError(
      403,
      "GitHub user authorization is required before importing repositories."
    );
  }

  if (
    proof.productUserId !== session.userId ||
    proof.workspaceSlug !== workspaceSlug ||
    proof.installationId !== installationId
  ) {
    throw new WorkspaceError(
      403,
      "GitHub user authorization does not match this import request."
    );
  }

  const providerRepositoryId = requireNonEmptyString(
    input.providerRepositoryId,
    "providerRepositoryId"
  );
  const repositories =
    await dependencies.installationClient.listRepositories(installationId);
  const selected = repositories.find(
    (repository) => repository.providerRepositoryId === providerRepositoryId
  );

  if (!proof.allowedProviderRepositoryIds.includes(providerRepositoryId)) {
    throw new WorkspaceError(
      403,
      "selected repository is not authorized for this GitHub user."
    );
  }

  if (!selected) {
    throw new WorkspaceError(
      403,
      "selected repository is not authorized for this GitHub user."
    );
  }

  return importGithubProjectForUser(
    {
      projectRepository: dependencies.projectRepository,
      githubRepository: dependencies.githubRepository,
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
      productionEnvironmentName: input.productionEnvironmentName,
    }
  );
}
