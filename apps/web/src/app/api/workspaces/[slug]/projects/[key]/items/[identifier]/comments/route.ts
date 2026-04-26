import {
  handleCreateComment,
  handleListComments
} from "@/server/api/detail-handlers";
import { createActivityRepository } from "@/server/activity/repository";
import { createCommentRepository } from "@/server/comments/repository";
import { getAppSession } from "@/server/auth";
import { createNotificationRepository } from "@/server/notifications/repository";
import { createWorkItemRepository } from "@/server/work-items/repository";

const dependencies = {
  getSession: getAppSession,
  commentRepository: createCommentRepository(),
  notificationRepository: createNotificationRepository(),
  workItemRepository: createWorkItemRepository(),
  activityRepository: createActivityRepository()
};

export async function GET(
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
  return handleListComments(request, params, dependencies);
}

export async function POST(
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
  return handleCreateComment(request, params, dependencies);
}
