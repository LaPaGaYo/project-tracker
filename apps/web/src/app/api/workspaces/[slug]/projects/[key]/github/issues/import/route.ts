import { getAppSession } from "@/server/auth";
import { createGithubIssueSyncRepository } from "@/server/github/issues/repository";
import {
  createGithubIssuesClient,
  importGithubIssuesForProject,
} from "@/server/github/issues/service";
import { WorkspaceError } from "@/server/workspaces/core";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function handleError(error: unknown) {
  if (error instanceof WorkspaceError) {
    return json({ error: error.message }, error.status);
  }

  return json({ error: "GitHub issue import failed." }, 500);
}

export async function POST(
  _request: Request,
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

  const { slug, key } = await context.params;

  try {
    const summary = await importGithubIssuesForProject(
      createGithubIssueSyncRepository(),
      session,
      slug,
      key,
      createGithubIssuesClient()
    );

    return json({ summary });
  } catch (error) {
    return handleError(error);
  }
}
