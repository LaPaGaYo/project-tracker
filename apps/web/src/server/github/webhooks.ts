import type { GithubRepositoryRecord, GithubWebhookEventName } from "@the-platform/shared";

import type { NotificationRepository } from "../notifications/types";

import { notifyGithubWebhookDeliveryFailure } from "./service";
import type { GithubWebhookRepository } from "./types";
import { verifyGithubWebhookSignature } from "./signature";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function isSupportedGithubWebhookEvent(value: string): value is GithubWebhookEventName {
  return (
    value === "pull_request" ||
    value === "check_run" ||
    value === "check_suite" ||
    value === "deployment" ||
    value === "deployment_status"
  );
}

export interface SyncGithubWebhookRequestOptions {
  secret?: string;
  now?: () => Date;
  verifySignature?: (payload: string, signature: string | null, secret: string) => boolean;
  notificationRepository?: NotificationRepository;
  processDelivery?: (input: {
    repository: GithubRepositoryRecord;
    deliveryId: string;
    eventName: GithubWebhookEventName;
    payload: Record<string, unknown>;
    receivedAt: string;
  }) => Promise<void>;
}

export async function syncGithubWebhookRequest(
  repository: GithubWebhookRepository,
  request: Request,
  options: SyncGithubWebhookRequestOptions = {}
) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const eventName = request.headers.get("x-github-event");
  const secret = options.secret ?? process.env.GITHUB_WEBHOOK_SECRET ?? "";
  const verifySignature = options.verifySignature ?? verifyGithubWebhookSignature;
  const now = options.now ?? (() => new Date());

  if (!deliveryId || !eventName) {
    return json({ error: "missing required GitHub webhook headers." }, 400);
  }

  if (!secret || !verifySignature(payload, signature, secret)) {
    return json({ error: "webhook verification failed." }, 400);
  }

  if (!isSupportedGithubWebhookEvent(eventName)) {
    return json({ ignored: true }, 202);
  }

  const existingDelivery = await repository.getGithubWebhookDeliveryByDeliveryId(deliveryId);
  if (existingDelivery) {
    return json({ duplicate: true });
  }

  let parsedBody: Record<string, unknown>;

  try {
    parsedBody = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return json({ error: "request body must be valid JSON." }, 400);
  }

  const providerRepositoryId =
    typeof parsedBody.repository === "object" &&
    parsedBody.repository &&
    "id" in parsedBody.repository &&
    (typeof parsedBody.repository.id === "string" || typeof parsedBody.repository.id === "number")
      ? `${parsedBody.repository.id}`
      : null;

  const repositoryRecord = providerRepositoryId
    ? await repository.findGithubRepositoryByProviderRepositoryId(providerRepositoryId)
    : null;

  const timestamp = now().toISOString();

  await repository.createGithubWebhookDelivery({
    repositoryId: repositoryRecord?.id ?? null,
    deliveryId,
    eventName,
    status: "pending",
    receivedAt: timestamp,
    processedAt: null,
    errorMessage: null
  });

  try {
    if (repositoryRecord && options.processDelivery) {
      await options.processDelivery({
        repository: repositoryRecord,
        deliveryId,
        eventName,
        payload: parsedBody,
        receivedAt: timestamp
      });
    }

    await repository.updateGithubWebhookDelivery(deliveryId, {
      status: "processed",
      processedAt: timestamp,
      errorMessage: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to process GitHub webhook.";

    await repository.updateGithubWebhookDelivery(deliveryId, {
      status: "failed",
      processedAt: timestamp,
      errorMessage: message
    });

    if (repositoryRecord && options.notificationRepository) {
      await notifyGithubWebhookDeliveryFailure(
        repository,
        options.notificationRepository,
        repositoryRecord,
        {
          deliveryId,
          eventName,
          errorMessage: message
        }
      );
    }

    return json({ error: message }, 500);
  }

  return json({ processed: true });
}
