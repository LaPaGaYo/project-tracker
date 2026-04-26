import assert from "node:assert/strict";
import test from "node:test";

import { computeGithubWebhookSignature } from "../apps/web/src/server/github/signature.ts";
import { syncGithubWebhookRequest } from "../apps/web/src/server/github/webhooks.ts";

function createRepositoryRecord(overrides = {}) {
  return {
    id: "repo-local-1",
    workspaceId: "workspace-1",
    provider: "github",
    providerRepositoryId: "repo_platform_ops_webhook",
    owner: "the-platform",
    name: "platform-ops",
    fullName: "the-platform/platform-ops",
    defaultBranch: "main",
    installationId: "installation-1",
    isActive: true,
    createdAt: new Date("2026-04-22T17:55:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-22T17:55:00.000Z").toISOString(),
    ...overrides
  };
}

class MemoryGithubWebhookRepository {
  constructor() {
    this.repositories = new Map();
    this.deliveries = new Map();
  }

  seedRepository(record) {
    this.repositories.set(record.providerRepositoryId, record);
  }

  async findGithubRepositoryByProviderRepositoryId(providerRepositoryId) {
    return this.repositories.get(providerRepositoryId) ?? null;
  }

  async getGithubWebhookDeliveryByDeliveryId(deliveryId) {
    return this.deliveries.get(deliveryId) ?? null;
  }

  async createGithubWebhookDelivery(input) {
    const record = {
      id: `delivery-${this.deliveries.size + 1}`,
      repositoryId: input.repositoryId,
      deliveryId: input.deliveryId,
      eventName: input.eventName,
      status: input.status,
      receivedAt: input.receivedAt,
      processedAt: input.processedAt,
      errorMessage: input.errorMessage
    };
    this.deliveries.set(record.deliveryId, record);
    return record;
  }

  async updateGithubWebhookDelivery(deliveryId, input) {
    const current = this.deliveries.get(deliveryId);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...input
    };
    this.deliveries.set(deliveryId, updated);
    return updated;
  }
}

function createWebhookRequest({ payload, signature, deliveryId, eventName }) {
  return new Request("http://localhost/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": deliveryId,
      "x-github-event": eventName,
      "x-hub-signature-256": signature
    },
    body: payload
  });
}

test("github webhook rejects invalid signatures before persisting delivery receipts", async () => {
  const repository = new MemoryGithubWebhookRepository();
  repository.seedRepository(createRepositoryRecord());

  const payload = JSON.stringify({
    repository: {
      id: "repo_platform_ops_webhook"
    }
  });

  const response = await syncGithubWebhookRequest(
    repository,
    createWebhookRequest({
      payload,
      signature: "sha256=invalid",
      deliveryId: "delivery-invalid-signature",
      eventName: "pull_request"
    }),
    {
      secret: "topsecret"
    }
  );

  assert.equal(response.status, 400);
  assert.equal(repository.deliveries.size, 0);
});

test("github webhook persists verified deliveries, marks them processed, and deduplicates by delivery id", async () => {
  const repository = new MemoryGithubWebhookRepository();
  repository.seedRepository(createRepositoryRecord());

  const payload = JSON.stringify({
    action: "opened",
    repository: {
      id: "repo_platform_ops_webhook"
    }
  });
  const signature = computeGithubWebhookSignature(payload, "topsecret");

  const response = await syncGithubWebhookRequest(
    repository,
    createWebhookRequest({
      payload,
      signature,
      deliveryId: "delivery-ops-128",
      eventName: "pull_request"
    }),
    {
      secret: "topsecret",
      now: () => new Date("2026-04-22T18:00:00.000Z")
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: true });
  assert.equal(repository.deliveries.size, 1);

  const delivery = repository.deliveries.get("delivery-ops-128");
  assert.equal(delivery?.repositoryId, "repo-local-1");
  assert.equal(delivery?.status, "processed");
  assert.equal(delivery?.receivedAt, "2026-04-22T18:00:00.000Z");
  assert.equal(delivery?.processedAt, "2026-04-22T18:00:00.000Z");

  const duplicateResponse = await syncGithubWebhookRequest(
    repository,
    createWebhookRequest({
      payload,
      signature,
      deliveryId: "delivery-ops-128",
      eventName: "pull_request"
    }),
    {
      secret: "topsecret",
      now: () => new Date("2026-04-22T18:00:01.000Z")
    }
  );

  assert.equal(duplicateResponse.status, 200);
  assert.deepEqual(await duplicateResponse.json(), { duplicate: true });
  assert.equal(repository.deliveries.size, 1);
});
