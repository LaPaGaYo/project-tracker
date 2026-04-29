import { handlePatchDescription } from "@/server/api/detail-handlers";
import { createActivityRepository } from "@/server/activity/repository";
import { createCommentRepository } from "@/server/comments/repository";
import { getAppSession } from "@/server/auth";
import { createGithubIssueSyncRepository } from "@/server/github/issues/repository";
import { createGithubIssuesClient, syncWorkItemGithubOwnedFields } from "@/server/github/issues/service";
import { createWorkItemRepository } from "@/server/work-items/repository";

const dependencies = {
  getSession: getAppSession,
  commentRepository: createCommentRepository(),
  workItemRepository: createWorkItemRepository(),
  githubIssueSync: {
    syncWorkItemFields: (input: {
      actorId: string;
      projectId: string;
      workItemId: string;
      changedFields: Record<string, unknown>;
    }) => syncWorkItemGithubOwnedFields(createGithubIssueSyncRepository(), createGithubIssuesClient(), input)
  },
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
  return handlePatchDescription(request, params, dependencies);
}
