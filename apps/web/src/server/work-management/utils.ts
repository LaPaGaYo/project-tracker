import type {
  TaskStatus,
  WorkflowStateCategory,
  WorkspaceMemberRecord,
  WorkspaceRecord,
  WorkspaceRole,
  WorkItemPriority,
  WorkItemType
} from "@the-platform/shared";

import { hasMinimumRole, requireWorkspaceMembership, WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";

export interface WorkspaceAccessRepository {
  findWorkspaceBySlug(slug: string): Promise<WorkspaceRecord | null>;
  getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | null>;
}

export async function resolveWorkspaceContext(
  repository: WorkspaceAccessRepository,
  session: AppSession,
  workspaceSlug: string,
  minimumRole: WorkspaceRole = "viewer"
) {
  const workspace = await repository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    throw new WorkspaceError(404, "workspace not found.");
  }

  const membership = await requireWorkspaceMembership(repository, session, workspace.id, minimumRole);
  return {
    workspace,
    membership
  };
}

export function requireRoleAtLeast(currentRole: WorkspaceRole, minimumRole: WorkspaceRole, message: string) {
  if (!hasMinimumRole(currentRole, minimumRole)) {
    throw new WorkspaceError(403, message);
  }
}

export function requireNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkspaceError(400, `${field} is required.`);
  }

  return value.trim();
}

export function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "";
}

export function normalizeOptionalDate(value: unknown, field: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new WorkspaceError(400, `${field} must be a valid date.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new WorkspaceError(400, `${field} must be a valid date.`);
  }

  return date.toISOString();
}

export function normalizeProjectKey(value: unknown) {
  const normalized = requireNonEmptyString(value, "key")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  if (normalized.length < 2) {
    throw new WorkspaceError(400, "key is invalid.");
  }

  return normalized;
}

export function requireWorkItemType(value: unknown): WorkItemType {
  if (value === undefined) {
    return "task";
  }

  if (value === "epic" || value === "task" || value === "subtask") {
    return value;
  }

  throw new WorkspaceError(400, "type is invalid.");
}

export function requireWorkItemPriority(value: unknown): WorkItemPriority {
  if (value === undefined) {
    return "none";
  }

  if (value === "urgent" || value === "high" || value === "medium" || value === "low" || value === "none") {
    return value;
  }

  throw new WorkspaceError(400, "priority is invalid.");
}

export function requireWorkflowStateCategory(value: unknown): WorkflowStateCategory {
  if (value === "backlog" || value === "active" || value === "done") {
    return value;
  }

  throw new WorkspaceError(400, "workflow state category is invalid.");
}

export function normalizeLabels(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (Array.isArray(value)) {
    const labels = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return labels.length > 0 ? labels : null;
  }

  if (typeof value === "string") {
    const labels = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return labels.length > 0 ? labels : null;
  }

  throw new WorkspaceError(400, "labels are invalid.");
}

export function taskStatusFromWorkflowCategory(category: WorkflowStateCategory): TaskStatus {
  if (category === "done") {
    return "Done";
  }

  if (category === "active") {
    return "Doing";
  }

  return "Todo";
}
