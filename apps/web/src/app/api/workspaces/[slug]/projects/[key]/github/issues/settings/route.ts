import { getAppSession } from "@/server/auth";
import { createGithubIssueSyncRepository } from "@/server/github/issues/repository";
import { updateProjectGithubIssueSyncSettings } from "@/server/github/issues/service";
import type { UpdateGithubIssueSyncSettingsInput } from "@/server/github/issues/types";
import { WorkspaceError } from "@/server/workspaces/core";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function handleError(error: unknown) {
  if (error instanceof WorkspaceError) {
    return json({ error: error.message }, error.status);
  }

  return json({ error: "GitHub issue sync settings update failed." }, 500);
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new WorkspaceError(400, "request body must be valid JSON.");
  }
}

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

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
    }>;
  }
) {
  const session = await getAppSession();
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const { slug, key } = await context.params;
    const input = parseGithubIssueSettingsBody(await parseJsonBody(request));
    const settings = await updateProjectGithubIssueSyncSettings(
      createGithubIssueSyncRepository(),
      session,
      slug,
      key,
      input
    );

    return json({ settings });
  } catch (error) {
    return handleError(error);
  }
}
