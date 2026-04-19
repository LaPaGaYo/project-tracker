import { WorkspaceError } from "../workspaces/core.ts";
import {
  normalizeOptionalString,
  requireRoleAtLeast,
  requireWorkflowStateCategory,
  requireNonEmptyString,
  resolveWorkspaceContext
} from "../work-management/utils.ts";

import type { AppSession } from "../workspaces/types.ts";
import type {
  CreateWorkflowStateInput,
  UpdateWorkflowStateInput,
  WorkflowStateRepository
} from "./types.ts";

async function resolveProjectContext(
  repository: WorkflowStateRepository,
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

export async function listWorkflowStatesForUser(
  repository: WorkflowStateRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  return repository.listWorkflowStates(project.id);
}

export async function createWorkflowStateForUser(
  repository: WorkflowStateRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  input: CreateWorkflowStateInput
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can manage workflow states.");

  return repository.createWorkflowState({
    projectId: project.id,
    workspaceId: workspace.id,
    name: requireNonEmptyString(input.name, "name"),
    category: requireWorkflowStateCategory(input.category),
    color: normalizeOptionalString(input.color) ?? null,
    ...(typeof input.position === "number" ? { position: input.position } : {}),
    actorId: session.userId
  });
}

export async function updateWorkflowStateForUser(
  repository: WorkflowStateRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  stateId: string,
  input: UpdateWorkflowStateInput
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can manage workflow states.");

  const updated = await repository.updateWorkflowState(project.id, stateId, {
    ...(input.name !== undefined ? { name: requireNonEmptyString(input.name, "name") } : {}),
    ...(input.category !== undefined ? { category: requireWorkflowStateCategory(input.category) } : {}),
    ...(input.color !== undefined ? { color: normalizeOptionalString(input.color) ?? null } : {}),
    ...(typeof input.position === "number" ? { position: input.position } : {}),
    workspaceId: workspace.id,
    actorId: session.userId
  });

  if (!updated) {
    throw new WorkspaceError(404, "workflow state not found.");
  }

  return updated;
}

export async function deleteWorkflowStateForUser(
  repository: WorkflowStateRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  stateId: string
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can manage workflow states.");

  const result = await repository.deleteWorkflowState(project.id, stateId, workspace.id, session.userId);

  if (result === "not_found") {
    throw new WorkspaceError(404, "workflow state not found.");
  }

  if (result === "has_items") {
    throw new WorkspaceError(409, "workflow state still has work items.");
  }
}
