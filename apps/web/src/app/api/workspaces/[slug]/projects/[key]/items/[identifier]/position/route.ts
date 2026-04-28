import { handlePatchWorkItemPosition } from "@/server/api/project-handlers";
import { createActivityRepository } from "@/server/activity/repository";
import { getAppSession } from "@/server/auth";
import { createGithubIssueSyncRepository } from "@/server/github/issues/repository";
import { createGithubIssuesClient, syncWorkItemGithubOwnedFields } from "@/server/github/issues/service";
import { createNotificationRepository } from "@/server/notifications/repository";
import { createProjectRepository } from "@/server/projects/repository";
import { createWorkItemRepository } from "@/server/work-items/repository";
import { createWorkflowStateRepository } from "@/server/workflow-states/repository";

const dependencies = {
  getSession: getAppSession,
  projectRepository: createProjectRepository(),
  workItemRepository: createWorkItemRepository(),
  notificationRepository: createNotificationRepository(),
  githubIssueSync: {
    syncWorkItemFields: (input: {
      actorId: string;
      projectId: string;
      workItemId: string;
      changedFields: Record<string, unknown>;
    }) => syncWorkItemGithubOwnedFields(createGithubIssueSyncRepository(), createGithubIssuesClient(), input)
  },
  workflowStateRepository: createWorkflowStateRepository(),
  activityRepository: createActivityRepository()
};

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
      identifier: string;
    }>;
  }
) {
  const params = await context.params;
  return handlePatchWorkItemPosition(request, params, dependencies);
}
