import { createGithubConnectionRepository } from "@/server/github/repository";
import { syncGithubWebhookRequest } from "@/server/github/webhooks";

const repository = createGithubConnectionRepository();

export async function POST(request: Request) {
  return syncGithubWebhookRequest(repository, request);
}
