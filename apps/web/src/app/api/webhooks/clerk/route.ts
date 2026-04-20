import { handleSyncInvitationsFromClerkWebhook } from "@/server/api/workspace-handlers";
import { createWorkspaceRepository } from "@/server/workspaces/repository";

const dependencies = {
  repository: createWorkspaceRepository()
};

export async function POST(request: Request) {
  return handleSyncInvitationsFromClerkWebhook(request, dependencies);
}
