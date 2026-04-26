import { searchProjectForUser } from "../../../../../../../server/projects/search";
import { createProjectRepository } from "../../../../../../../server/projects/repository";
import type { ProjectRepository } from "../../../../../../../server/projects/types";
import { WorkspaceError } from "../../../../../../../server/workspaces/core";
import type { AppSession } from "../../../../../../../server/workspaces/types";

interface SearchRouteDependencies {
  getSession: () => Promise<AppSession | null>;
  projectRepository: Pick<ProjectRepository, "findWorkspaceBySlug" | "getMembership" | "getProjectByKey">;
}

async function getDefaultSession() {
  const { getAppSession } = await import("../../../../../../../server/auth");
  return getAppSession();
}

const defaultDependencies: SearchRouteDependencies = {
  getSession: getDefaultSession,
  projectRepository: createProjectRepository()
};

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
    }>;
  },
  overrideDependencies?: SearchRouteDependencies
) {
  const dependencies = overrideDependencies ?? defaultDependencies;
  const session = await dependencies.getSession();

  if (!session) {
    return Response.json({ error: "authentication required." }, { status: 401 });
  }

  const { slug, key } = await context.params;
  const query = new URL(request.url).searchParams.get("q") ?? "";

  try {
    const response = await searchProjectForUser(
      { projectRepository: dependencies.projectRepository },
      session,
      slug,
      key,
      query
    );

    return Response.json(response);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
