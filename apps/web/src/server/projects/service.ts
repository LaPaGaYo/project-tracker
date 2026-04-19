import type { ProjectStage } from "@the-platform/shared";

import { WorkspaceError } from "../workspaces/core";
import {
  normalizeOptionalDate,
  normalizeOptionalString,
  normalizeProjectKey,
  requireRoleAtLeast,
  requireNonEmptyString,
  resolveWorkspaceContext
} from "../work-management/utils";

import type { AppSession } from "../workspaces/types";
import type { CreateProjectInput, ProjectRepository, UpdateProjectInput } from "./types";

function requireProjectStage(value: unknown): ProjectStage {
  if (
    value === "Idea" ||
    value === "Planning" ||
    value === "Active" ||
    value === "Paused" ||
    value === "Completed" ||
    value === "Archived"
  ) {
    return value;
  }

  throw new WorkspaceError(400, "project stage is invalid.");
}

async function resolveProjectContext(
  repository: ProjectRepository,
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

export async function createProjectForUser(
  repository: ProjectRepository,
  session: AppSession,
  workspaceSlug: string,
  input: CreateProjectInput
) {
  const { workspace, membership } = await resolveWorkspaceContext(repository, session, workspaceSlug, "member");
  requireRoleAtLeast(membership.role, "member", "insufficient workspace permissions.");

  return repository.createProject({
    workspaceId: workspace.id,
    title: requireNonEmptyString(input.name, "name"),
    description: normalizeOptionalString(input.description) ?? "",
    key: normalizeProjectKey(input.key),
    stage: input.stage === undefined ? "Planning" : requireProjectStage(input.stage),
    dueDate: normalizeOptionalDate(input.dueDate, "dueDate") ?? null,
    actorId: session.userId
  });
}

export async function listProjectsForUser(
  repository: ProjectRepository,
  session: AppSession,
  workspaceSlug: string
) {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");
  return repository.listProjects(workspace.id);
}

export async function getProjectForUser(
  repository: ProjectRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  return project;
}

export async function updateProjectForUser(
  repository: ProjectRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  input: UpdateProjectInput
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can update projects.");

  const updated = await repository.updateProject(project.id, {
    ...(input.name !== undefined ? { title: requireNonEmptyString(input.name, "name") } : {}),
    ...(input.description !== undefined ? { description: normalizeOptionalString(input.description) ?? "" } : {}),
    ...(input.stage !== undefined ? { stage: requireProjectStage(input.stage) } : {}),
    ...(input.dueDate !== undefined ? { dueDate: normalizeOptionalDate(input.dueDate, "dueDate") ?? null } : {}),
    actorId: session.userId,
    workspaceId: workspace.id
  });

  if (!updated) {
    throw new WorkspaceError(404, "project not found.");
  }

  return updated;
}

export async function deleteProjectForUser(
  repository: ProjectRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can delete projects.");

  const deleted = await repository.deleteProject(project.id, workspace.id, session.userId);
  if (!deleted) {
    throw new WorkspaceError(404, "project not found.");
  }
}
