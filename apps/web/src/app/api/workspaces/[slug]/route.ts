import { handleGetWorkspace, handlePatchWorkspace } from "@/server/api/workspace-handlers";
import { getAppSession } from "@/server/auth";
import { createWorkspaceRepository } from "@/server/workspaces/repository";

const dependencies = {
  getSession: getAppSession,
  repository: createWorkspaceRepository()
};

async function resolveWorkspaceId(slug: string) {
  const workspace = await dependencies.repository.findWorkspaceBySlug(slug);
  if (!workspace) {
    return null;
  }

  return workspace.id;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
    }>;
  }
) {
  const { slug } = await context.params;
  const workspaceId = await resolveWorkspaceId(slug);

  if (!workspaceId) {
    return Response.json({ error: "workspace not found." }, { status: 404 });
  }

  return handleGetWorkspace(request, { workspaceId }, dependencies);
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
    }>;
  }
) {
  const { slug } = await context.params;
  const workspaceId = await resolveWorkspaceId(slug);

  if (!workspaceId) {
    return Response.json({ error: "workspace not found." }, { status: 404 });
  }

  return handlePatchWorkspace(request, { workspaceId }, dependencies);
}
