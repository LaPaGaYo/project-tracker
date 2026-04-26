import { handleMarkAllNotificationsRead } from "@/server/api/notification-handlers";
import { getAppSession } from "@/server/auth";
import { createNotificationRepository } from "@/server/notifications/repository";

const dependencies = {
  getSession: getAppSession,
  notificationRepository: createNotificationRepository()
};

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
    }>;
  }
) {
  const params = await context.params;
  return handleMarkAllNotificationsRead(request, params, dependencies);
}
