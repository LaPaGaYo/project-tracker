import { handlePatchNotification } from "@/server/api/notification-handlers";
import { getAppSession } from "@/server/auth";
import { createNotificationRepository } from "@/server/notifications/repository";

const dependencies = {
  getSession: getAppSession,
  notificationRepository: createNotificationRepository()
};

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      notificationId: string;
    }>;
  }
) {
  const params = await context.params;
  return handlePatchNotification(request, params, dependencies);
}
