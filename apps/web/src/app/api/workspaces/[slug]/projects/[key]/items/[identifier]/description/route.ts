import { handlePatchDescription } from "@/server/api/detail-handlers";
import { createActivityRepository } from "@/server/activity/repository";
import { createCommentRepository } from "@/server/comments/repository";
import { getAppSession } from "@/server/auth";
import { createWorkItemRepository } from "@/server/work-items/repository";

const dependencies = {
  getSession: getAppSession,
  commentRepository: createCommentRepository(),
  workItemRepository: createWorkItemRepository(),
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
