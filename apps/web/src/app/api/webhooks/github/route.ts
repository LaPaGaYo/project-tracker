import { createGithubConnectionRepository } from "@/server/github/repository";
import { projectGithubWebhookEvent } from "@/server/github/service";
import { syncGithubWebhookRequest } from "@/server/github/webhooks";
import { createNotificationRepository } from "@/server/notifications/repository";

const repository = createGithubConnectionRepository();
const notificationRepository = createNotificationRepository();

export async function POST(request: Request) {
  return syncGithubWebhookRequest(repository, request, {
    notificationRepository,
    processDelivery: ({ repository: githubRepository, eventName, payload, receivedAt }) =>
      projectGithubWebhookEvent(repository, githubRepository, eventName, payload, receivedAt, {
        notificationRepository
      })
  });
}
