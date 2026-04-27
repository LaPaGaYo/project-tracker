import type { ProjectRecord } from "@the-platform/shared";

import { createProjectForUser, deleteProjectForUser } from "../projects/service";
import type { ProjectRepository } from "../projects/types";
import {
  normalizeOptionalString,
  requireNonEmptyString,
  requireRoleAtLeast,
  resolveWorkspaceContext
} from "../work-management/utils";
import type { AppSession } from "../workspaces/types";

import { connectProjectGithubRepositoryForUser } from "./service";
import type { GithubConnectionRepository, ProjectGithubConnectionView } from "./types";

export interface ImportGithubProjectInput {
  providerRepositoryId?: unknown;
  owner?: unknown;
  name?: unknown;
  fullName?: unknown;
  defaultBranch?: unknown;
  installationId?: unknown;
  stagingEnvironmentName?: unknown;
  productionEnvironmentName?: unknown;
  projectName?: unknown;
  key?: unknown;
  description?: unknown;
}

export interface ImportGithubProjectDependencies {
  projectRepository: ProjectRepository;
  githubRepository: GithubConnectionRepository;
}

export interface ImportGithubProjectResult {
  project: ProjectRecord;
  github: ProjectGithubConnectionView;
}

function titleFromRepositoryName(name: string) {
  const title = name
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : ""))
    .join(" ")
    .trim();

  return title || name;
}

function projectKeyFromRepositoryName(name: string) {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  return normalized.length >= 2 ? normalized : "GH";
}

export async function importGithubProjectForUser(
  dependencies: ImportGithubProjectDependencies,
  session: AppSession,
  workspaceSlug: string,
  input: ImportGithubProjectInput
): Promise<ImportGithubProjectResult> {
  const { membership } = await resolveWorkspaceContext(dependencies.projectRepository, session, workspaceSlug, "viewer");
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can import GitHub projects.");

  const providerRepositoryId = requireNonEmptyString(input.providerRepositoryId, "providerRepositoryId");
  const owner = requireNonEmptyString(input.owner, "owner");
  const name = requireNonEmptyString(input.name, "name");
  const defaultBranch = requireNonEmptyString(input.defaultBranch, "defaultBranch");
  const installationId = requireNonEmptyString(input.installationId, "installationId");
  const projectName = normalizeOptionalString(input.projectName) || titleFromRepositoryName(name);
  const projectKey = normalizeOptionalString(input.key) || projectKeyFromRepositoryName(name);
  const description =
    normalizeOptionalString(input.description) ?? `Imported from ${normalizeOptionalString(input.fullName) ?? `${owner}/${name}`}.`;

  const project = await createProjectForUser(dependencies.projectRepository, session, workspaceSlug, {
    name: projectName,
    key: projectKey,
    description
  });

  try {
    const github = await connectProjectGithubRepositoryForUser(
      dependencies.githubRepository,
      session,
      workspaceSlug,
      project.key,
      {
        providerRepositoryId,
        owner,
        name,
        fullName: input.fullName,
        defaultBranch,
        installationId,
        stagingEnvironmentName: input.stagingEnvironmentName,
        productionEnvironmentName: input.productionEnvironmentName
      }
    );

    return {
      project,
      github
    };
  } catch (error) {
    try {
      await deleteProjectForUser(dependencies.projectRepository, session, workspaceSlug, project.key);
    } catch {
      // Preserve the original connection error; cleanup failure should not hide the import failure.
    }

    throw error;
  }
}
