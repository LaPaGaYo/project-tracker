import assert from "node:assert/strict";
import test from "node:test";

import {
  backfillConnectedGithubRepositories,
  replayFailedGithubDeliveries,
  runGithubReconciliationCycle,
  type GithubProjectionWriter,
  type GithubReconcileRepository,
  type GithubReconcileTarget
} from "./github-reconcile";
import type { GithubClient, GithubRepositorySnapshot } from "./github-client";

function createTarget(overrides: Partial<GithubReconcileTarget> = {}): GithubReconcileTarget {
  return {
    id: "repo-1",
    workspaceId: "workspace-1",
    provider: "github",
    providerRepositoryId: "repo_provider_1",
    owner: "the-platform",
    name: "platform-ops",
    fullName: "the-platform/platform-ops",
    defaultBranch: "main",
    installationId: "installation-1",
    isActive: true,
    stagingEnvironmentName: "staging",
    productionEnvironmentName: "production",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides
  };
}

class MemoryGithubProjectionWriter implements GithubProjectionWriter {
  pullRequests: Array<Record<string, unknown>> = [];

  checkRollups: Array<Record<string, unknown>> = [];

  deployments: Array<Record<string, unknown>> = [];

  applyPullRequestWebhookProjection(input: Record<string, unknown>) {
    this.pullRequests.push(input);
    return Promise.resolve();
  }

  applyCheckRollupWebhookProjection(input: Record<string, unknown>) {
    this.checkRollups.push(input);
    return Promise.resolve();
  }

  applyDeploymentWebhookProjection(input: Record<string, unknown>) {
    this.deployments.push(input);
    return Promise.resolve();
  }
}

class MemoryGithubClient implements GithubClient {
  calls: string[] = [];

  constructor(private readonly snapshots: Record<string, GithubRepositorySnapshot>) {}

  getRepositorySnapshot(target: GithubReconcileTarget) {
    this.calls.push(target.fullName);
    const snapshot = this.snapshots[target.id];
    if (!snapshot) {
      return Promise.reject(new Error(`Missing snapshot for ${target.fullName}`));
    }

    return Promise.resolve(snapshot);
  }
}

class MemoryGithubReconcileRepository implements GithubReconcileRepository {
  processedFailures: Array<{ repositoryId: string; processedAt: string; note: string }> = [];

  constructor(
    private readonly fixtures: {
      connected?: GithubReconcileTarget[];
      failed?: GithubReconcileTarget[];
      linked?: GithubReconcileTarget[];
    } = {}
  ) {}

  listConnectedRepositories() {
    return Promise.resolve(this.fixtures.connected ?? []);
  }

  listRepositoriesWithFailedDeliveries() {
    return Promise.resolve(this.fixtures.failed ?? []);
  }

  listRepositoriesWithLinkedWorkItems() {
    return Promise.resolve(this.fixtures.linked ?? []);
  }

  markFailedDeliveriesProcessed(repositoryId: string, input: { processedAt: string; note: string }) {
    this.processedFailures.push({
      repositoryId,
      processedAt: input.processedAt,
      note: input.note
    });

    return Promise.resolve(repositoryId === "repo-2" ? 2 : 1);
  }
}

function createSnapshot(label: string) {
  return {
    fetchedAt: "2026-04-24T12:00:00.000Z",
    pullRequests: [
      {
        providerPullRequestId: `${label}-pr-1`,
        number: 101,
        title: "OPS-101 ship reconcile worker",
        body: "Backfill repository engineering state.",
        url: `https://github.com/the-platform/${label}/pull/101`,
        state: "open" as const,
        isDraft: false,
        authorLogin: "octocat",
        baseBranch: "main",
        headBranch: "ops-101-reconcile-worker",
        headSha: `${label}-sha-1`,
        createdAt: "2026-04-24T11:30:00.000Z",
        updatedAt: "2026-04-24T11:45:00.000Z",
        mergedAt: null,
        closedAt: null,
        titleIdentifiers: ["OPS-101"],
        bodyIdentifiers: [],
        branchIdentifiers: ["OPS-101"]
      }
    ],
    checkRollups: [
      {
        headSha: `${label}-sha-1`,
        status: "passing" as const,
        url: `https://github.com/the-platform/${label}/actions/runs/101`,
        checkCount: 3,
        completedAt: "2026-04-24T11:50:00.000Z"
      }
    ],
    deployments: [
      {
        providerDeploymentId: `${label}-deployment-1`,
        headSha: `${label}-sha-1`,
        environmentName: "staging",
        environment: "staging" as const,
        status: "success" as const,
        url: `https://staging.${label}.example.com`
      }
    ]
  };
}

void test("backfillConnectedGithubRepositories reprojects every connected repository snapshot through the projector", async () => {
  const target = createTarget();
  const repository = new MemoryGithubReconcileRepository({
    connected: [target]
  });
  const projector = new MemoryGithubProjectionWriter();
  const client = new MemoryGithubClient({
    [target.id]: createSnapshot("platform-ops")
  });

  const summary = await backfillConnectedGithubRepositories({
    repository,
    projector,
    client,
    now: () => new Date("2026-04-24T12:00:00.000Z")
  });

  assert.deepEqual(client.calls, ["the-platform/platform-ops"]);
  assert.equal(projector.pullRequests.length, 1);
  assert.equal(projector.checkRollups.length, 1);
  assert.equal(projector.deployments.length, 1);
  assert.equal(summary.repositories.length, 1);
  assert.equal(summary.repositories[0]?.reason, "backfill");
  assert.equal(summary.repositories[0]?.pullRequestsApplied, 1);
  assert.equal(summary.totals.pullRequestsApplied, 1);
  assert.equal(summary.totals.deploymentsApplied, 1);
});

void test("replayFailedGithubDeliveries deduplicates repositories and marks failed receipts processed after reconciliation", async () => {
  const repoOne = createTarget();
  const repoTwo = createTarget({
    id: "repo-2",
    providerRepositoryId: "repo_provider_2",
    name: "ops-infra",
    fullName: "the-platform/ops-infra"
  });
  const repository = new MemoryGithubReconcileRepository({
    failed: [repoOne, repoOne, repoTwo]
  });
  const projector = new MemoryGithubProjectionWriter();
  const client = new MemoryGithubClient({
    [repoOne.id]: createSnapshot("platform-ops"),
    [repoTwo.id]: createSnapshot("ops-infra")
  });

  const summary = await replayFailedGithubDeliveries({
    repository,
    projector,
    client,
    now: () => new Date("2026-04-24T12:30:00.000Z")
  });

  assert.deepEqual(client.calls, ["the-platform/platform-ops", "the-platform/ops-infra"]);
  assert.equal(summary.repositories.length, 2);
  assert.equal(summary.totals.failedDeliveriesResolved, 3);
  assert.deepEqual(
    repository.processedFailures.map((entry) => entry.repositoryId),
    ["repo-1", "repo-2"]
  );
  assert.match(repository.processedFailures[0]?.note ?? "", /worker repository reconciliation/i);
});

void test("runGithubReconciliationCycle performs scheduled linked-repository resync without double-processing repositories already replayed", async () => {
  const replayed = createTarget();
  const linked = createTarget({
    id: "repo-2",
    providerRepositoryId: "repo_provider_2",
    name: "ops-linked",
    fullName: "the-platform/ops-linked"
  });
  const repository = new MemoryGithubReconcileRepository({
    failed: [replayed],
    linked: [replayed, linked]
  });
  const projector = new MemoryGithubProjectionWriter();
  const client = new MemoryGithubClient({
    [replayed.id]: createSnapshot("platform-ops"),
    [linked.id]: createSnapshot("ops-linked")
  });

  const summary = await runGithubReconciliationCycle({
    mode: "cycle",
    repository,
    projector,
    client,
    now: () => new Date("2026-04-24T13:00:00.000Z")
  });

  assert.deepEqual(client.calls, ["the-platform/platform-ops", "the-platform/ops-linked"]);
  assert.equal(summary.repositories.length, 2);
  assert.equal(summary.repositories[0]?.reason, "failed_delivery");
  assert.equal(summary.repositories[1]?.reason, "linked_resync");
  assert.equal(summary.totals.repositoriesReconciled, 2);
  assert.equal(summary.totals.failedDeliveriesResolved, 1);
  assert.equal(summary.totals.pullRequestsApplied, 2);
});
