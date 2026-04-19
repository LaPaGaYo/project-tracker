import { WorkspaceError } from "../workspaces/core";
import { resolveWorkspaceContext } from "../work-management/utils";

import type { ActivityFeedOptions, ActivityRepository } from "./types";
import type { AppSession } from "../workspaces/types";

async function resolveProjectContext(
  repository: ActivityRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");
  const project = await repository.getProjectByKey(workspace.id, projectKey);

  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  return {
    workspace,
    project
  };
}

export async function getProjectActivityForUser(
  repository: ActivityRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  options?: ActivityFeedOptions
) {
  const { workspace, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  return repository.listProjectActivity(workspace.id, project.id, options);
}

export async function getItemActivityForUser(
  repository: ActivityRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  options?: ActivityFeedOptions
) {
  const { workspace, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  const item = await repository.getWorkItemByIdentifier(project.id, identifier);

  if (!item) {
    throw new WorkspaceError(404, "work item not found.");
  }

  return repository.listWorkItemActivity(workspace.id, item.id, options);
}
