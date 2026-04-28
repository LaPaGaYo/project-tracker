import type { UpdateGithubIssueSyncSettingsInput } from "@/server/github/issues/types";
import { WorkspaceError } from "@/server/workspaces/core";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireBoolean(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== "boolean") {
    throw new WorkspaceError(400, `${key} must be a boolean.`);
  }

  return value;
}

function requireNullableString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === null || typeof value === "string") {
    return value;
  }

  throw new WorkspaceError(400, `${key} must be a string or null.`);
}

function parseSettingsInput(
  body: Record<string, unknown>
): UpdateGithubIssueSyncSettingsInput {
  return {
    issueSyncEnabled: requireBoolean(body, "issueSyncEnabled"),
    syncTitle: requireBoolean(body, "syncTitle"),
    syncBody: requireBoolean(body, "syncBody"),
    syncState: requireBoolean(body, "syncState"),
    importClosedIssues: requireBoolean(body, "importClosedIssues"),
    closedWorkflowStateId: requireNullableString(body, "closedWorkflowStateId"),
    reopenedWorkflowStateId: requireNullableString(
      body,
      "reopenedWorkflowStateId"
    ),
  };
}

export function parseGithubIssueSettingsBody(
  body: unknown
): UpdateGithubIssueSyncSettingsInput {
  if (!isJsonObject(body)) {
    throw new WorkspaceError(400, "request body must be a JSON object.");
  }

  return parseSettingsInput(body);
}
