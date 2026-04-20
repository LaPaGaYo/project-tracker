import { hasMinimumRole, WorkspaceError } from "../workspaces/core";
import {
  normalizeLabels,
  normalizeOptionalDate,
  normalizeOptionalString,
  requireNonEmptyString,
  requireRoleAtLeast,
  requireWorkItemPriority,
  requireWorkItemType,
  resolveWorkspaceContext,
  taskStatusFromWorkflowCategory
} from "../work-management/utils";

import type { AppSession } from "../workspaces/types";
import type {
  CreateWorkItemInput,
  ListWorkItemFilters,
  MoveWorkItemInput,
  UpdateWorkItemInput,
  WorkItemRepository
} from "./types";

async function resolveProjectContext(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  minimumRole: "viewer" | "member" = "viewer"
) {
  const { workspace, membership } = await resolveWorkspaceContext(repository, session, workspaceSlug, minimumRole);
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

async function resolveWorkflowState(
  repository: WorkItemRepository,
  projectId: string,
  workflowStateId: unknown
) {
  if (workflowStateId === undefined) {
    const states = await repository.listWorkflowStates(projectId);
    return states.find((state) => state.category === "backlog") ?? states[0] ?? null;
  }

  if (workflowStateId === null || workflowStateId === "") {
    return null;
  }

  if (typeof workflowStateId !== "string") {
    throw new WorkspaceError(400, "workflowStateId is invalid.");
  }

  const state = await repository.getWorkflowState(projectId, workflowStateId);
  if (!state) {
    throw new WorkspaceError(404, "workflow state not found.");
  }

  return state;
}

async function validateAssignee(
  repository: WorkItemRepository,
  workspaceId: string,
  assigneeId: string | null
) {
  if (!assigneeId) {
    return;
  }

  const membership = await repository.getMembership(workspaceId, assigneeId);
  if (!membership) {
    throw new WorkspaceError(400, "assignee must belong to the workspace.");
  }
}

async function validateParent(
  repository: WorkItemRepository,
  projectId: string,
  parentId: string | null,
  type: "epic" | "task" | "subtask"
) {
  if (!parentId) {
    if (type === "subtask") {
      throw new WorkspaceError(400, "subtasks require a parent task.");
    }

    return;
  }

  const parent = await repository.getWorkItemById(projectId, parentId);
  if (!parent) {
    throw new WorkspaceError(404, "parent work item not found.");
  }

  if (parent.type === "subtask") {
    throw new WorkspaceError(400, "subtasks cannot have children.");
  }

  if (parent.type === "epic" && type !== "task") {
    throw new WorkspaceError(400, "epic children must be tasks.");
  }

  if (parent.type === "task" && type !== "subtask") {
    throw new WorkspaceError(400, "task children must be subtasks.");
  }
}

function requirePosition(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WorkspaceError(400, "position is invalid.");
  }

  return value;
}

function requireIdentifier(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkspaceError(400, "identifier is invalid.");
  }

  return value;
}

function requireAffectedItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new WorkspaceError(400, "affectedItems must be a non-empty array.");
  }

  return value as Array<Record<string, unknown>>;
}

export async function createWorkItemForUser(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  input: CreateWorkItemInput
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey, "member");
  requireRoleAtLeast(membership.role, "member", "only members and above can create work items.");

  const type = requireWorkItemType(input.type);
  const parentId = typeof input.parentId === "string" && input.parentId ? input.parentId : null;
  await validateParent(repository, project.id, parentId, type);

  const state = await resolveWorkflowState(repository, project.id, input.workflowStateId);
  const assigneeId = typeof input.assigneeId === "string" && input.assigneeId ? input.assigneeId : null;
  await validateAssignee(repository, workspace.id, assigneeId);

  const position = typeof input.position === "number" ? input.position : 0;

  return repository.createWorkItem({
    projectId: project.id,
    workspaceId: workspace.id,
    title: requireNonEmptyString(input.title, "title"),
    description: normalizeOptionalString(input.description) ?? "",
    type,
    parentId,
    assigneeId,
    priority: requireWorkItemPriority(input.priority),
    labels: normalizeLabels(input.labels) ?? null,
    workflowStateId: state?.id ?? null,
    dueDate: normalizeOptionalDate(input.dueDate, "dueDate") ?? null,
    blockedReason: normalizeOptionalString(input.blockedReason) ?? null,
    position,
    status: taskStatusFromWorkflowCategory(state?.category ?? "backlog"),
    actorId: session.userId
  });
}

export async function listWorkItemsForUser(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  filters?: ListWorkItemFilters
) {
  const { project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  return repository.listWorkItems(project.id, filters);
}

export async function moveWorkItemForUser(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  input: MoveWorkItemInput
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "member", "only members and above can update work items.");

  const current = await repository.getWorkItemByIdentifier(project.id, identifier);
  if (!current) {
    throw new WorkspaceError(404, "work item not found.");
  }

  const nextState =
    input.workflowStateId !== undefined
      ? await resolveWorkflowState(repository, project.id, input.workflowStateId)
      : current.workflowStateId
        ? await repository.getWorkflowState(project.id, current.workflowStateId)
        : null;

  const updated = await repository.moveWorkItem(project.id, identifier, {
    position: requirePosition(input.position),
    ...(input.workflowStateId !== undefined ? { workflowStateId: nextState?.id ?? null } : {}),
    ...(nextState ? { status: taskStatusFromWorkflowCategory(nextState.category) } : {}),
    workspaceId: workspace.id,
    actorId: session.userId
  });

  if (!updated) {
    throw new WorkspaceError(404, "work item not found.");
  }

  return updated;
}

export async function moveWorkItemsForUser(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  input: MoveWorkItemInput
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "member", "only members and above can update work items.");

  const rawUpdates = requireAffectedItems(input.affectedItems);
  const uniqueIdentifiers = Array.from(
    new Set(rawUpdates.map((entry) => requireIdentifier(entry.identifier)))
  );

  if (!uniqueIdentifiers.includes(identifier)) {
    throw new WorkspaceError(400, "affectedItems must include the moved work item.");
  }

  const currentItems = await Promise.all(
    uniqueIdentifiers.map(async (currentIdentifier) => {
      const item = await repository.getWorkItemByIdentifier(project.id, currentIdentifier);
      if (!item) {
        throw new WorkspaceError(404, "work item not found.");
      }

      return item;
    })
  );

  const currentByIdentifier = new Map(currentItems.map((item) => [item.identifier, item]));
  const normalizedUpdates = await Promise.all(
    rawUpdates.map(async (entry) => {
      const current = currentByIdentifier.get(requireIdentifier(entry.identifier));
      if (!current) {
        throw new WorkspaceError(404, "work item not found.");
      }

      const nextState =
        entry.workflowStateId !== undefined
          ? await resolveWorkflowState(repository, project.id, entry.workflowStateId)
          : current.workflowStateId
            ? await repository.getWorkflowState(project.id, current.workflowStateId)
            : null;

      return {
        identifier: requireIdentifier(current.identifier),
        position: requirePosition(entry.position),
        ...(entry.workflowStateId !== undefined ? { workflowStateId: nextState?.id ?? null } : {}),
        ...(nextState ? { status: taskStatusFromWorkflowCategory(nextState.category) } : {})
      };
    })
  );

  const updated = await repository.moveWorkItems(project.id, identifier, {
    updates: normalizedUpdates,
    workspaceId: workspace.id,
    actorId: session.userId
  });

  if (!updated) {
    throw new WorkspaceError(404, "work item not found.");
  }

  return updated;
}

export async function getWorkItemForUser(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string
) {
  const { project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  const item = await repository.getWorkItemByIdentifier(project.id, identifier);

  if (!item) {
    throw new WorkspaceError(404, "work item not found.");
  }

  return item;
}

export async function updateWorkItemForUser(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  input: UpdateWorkItemInput
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey, "member");
  requireRoleAtLeast(membership.role, "member", "only members and above can update work items.");

  const current = await repository.getWorkItemByIdentifier(project.id, identifier);
  if (!current) {
    throw new WorkspaceError(404, "work item not found.");
  }

  const type = input.type !== undefined ? requireWorkItemType(input.type) : current.type;
  const parentId =
    input.parentId !== undefined ? (typeof input.parentId === "string" && input.parentId ? input.parentId : null) : current.parentId;

  if (input.type !== undefined || input.parentId !== undefined) {
    await validateParent(repository, project.id, parentId, type);
  }

  const state =
    input.workflowStateId !== undefined
      ? await resolveWorkflowState(repository, project.id, input.workflowStateId)
      : current.workflowStateId
        ? await repository.getWorkflowState(project.id, current.workflowStateId)
        : null;

  const assigneeId =
    input.assigneeId !== undefined ? (typeof input.assigneeId === "string" && input.assigneeId ? input.assigneeId : null) : current.assigneeId;
  if (input.assigneeId !== undefined) {
    await validateAssignee(repository, workspace.id, assigneeId);
  }

  const updated = await repository.updateWorkItem(project.id, identifier, {
    ...(input.title !== undefined ? { title: requireNonEmptyString(input.title, "title") } : {}),
    ...(input.description !== undefined ? { description: normalizeOptionalString(input.description) ?? "" } : {}),
    ...(input.type !== undefined ? { type } : {}),
    ...(input.parentId !== undefined ? { parentId } : {}),
    ...(input.assigneeId !== undefined ? { assigneeId } : {}),
    ...(input.priority !== undefined ? { priority: requireWorkItemPriority(input.priority) } : {}),
    ...(input.labels !== undefined ? { labels: normalizeLabels(input.labels) ?? null } : {}),
    ...(input.workflowStateId !== undefined ? { workflowStateId: state?.id ?? null } : {}),
    ...(input.dueDate !== undefined ? { dueDate: normalizeOptionalDate(input.dueDate, "dueDate") ?? null } : {}),
    ...(input.blockedReason !== undefined ? { blockedReason: normalizeOptionalString(input.blockedReason) ?? null } : {}),
    ...(typeof input.position === "number" ? { position: input.position } : {}),
    ...(input.workflowStateId !== undefined && state ? { status: taskStatusFromWorkflowCategory(state.category) } : {}),
    workspaceId: workspace.id,
    actorId: session.userId
  });

  if (!updated) {
    throw new WorkspaceError(404, "work item not found.");
  }

  return updated;
}

export async function deleteWorkItemForUser(
  repository: WorkItemRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string
) {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  const item = await repository.getWorkItemByIdentifier(project.id, identifier);

  if (!item) {
    throw new WorkspaceError(404, "work item not found.");
  }

  const isAdminOrOwner = hasMinimumRole(membership.role, "admin");
  if (!isAdminOrOwner) {
    if (membership.role === "viewer") {
      throw new WorkspaceError(403, "only owners, admins, or the creator can delete work items.");
    }

    const creatorId = await repository.getWorkItemCreatorId(item.id);
    if (creatorId !== session.userId) {
      throw new WorkspaceError(403, "only owners, admins, or the creator can delete work items.");
    }
  }

  const deleted = await repository.deleteWorkItem(project.id, identifier, workspace.id, session.userId);
  if (!deleted) {
    throw new WorkspaceError(404, "work item not found.");
  }
}
