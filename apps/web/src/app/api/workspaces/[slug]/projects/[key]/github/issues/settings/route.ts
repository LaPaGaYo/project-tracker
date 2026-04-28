import { getAppSession } from "@/server/auth";
import { createGithubIssueSyncRepository } from "@/server/github/issues/repository";
import { updateProjectGithubIssueSyncSettings } from "@/server/github/issues/service";
import { WorkspaceError } from "@/server/workspaces/core";

import { parseGithubIssueSettingsBody } from "./body";

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
