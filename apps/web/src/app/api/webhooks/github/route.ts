import { createGithubConnectionRepository } from "@/server/github/repository";
import { projectGithubWebhookEvent } from "@/server/github/service";
import { syncGithubWebhookRequest } from "@/server/github/webhooks";

const repository = createGithubConnectionRepository();

export async function POST(request: Request) {
  return syncGithubWebhookRequest(repository, request, {
    processDelivery: ({ repository: githubRepository, eventName, payload, receivedAt }) =>
      projectGithubWebhookEvent(repository, githubRepository, eventName, payload, receivedAt)
  });
}
