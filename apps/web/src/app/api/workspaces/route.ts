import { handleCreateWorkspace, handleListWorkspaces } from "@/server/api/workspace-handlers";
import { getAppSession } from "@/server/auth";
import { createWorkspaceRepository } from "@/server/workspaces/repository";

const dependencies = {
  getSession: getAppSession,
  repository: createWorkspaceRepository()
};

export async function GET(request: Request) {
  return handleListWorkspaces(request, dependencies);
}

export async function POST(request: Request) {
  return handleCreateWorkspace(request, dependencies);
}
