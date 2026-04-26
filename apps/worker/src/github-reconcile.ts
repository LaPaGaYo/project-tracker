import { and, desc, eq, isNotNull } from "drizzle-orm";

import {
  db,
  githubRepositories,
  githubWebhookDeliveries,
  projectGithubConnections,
  workItemGithubLinks
} from "@the-platform/db";
import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubRepositoryRecord,
  GithubPullRequestState
} from "@the-platform/shared";

import type {
  GithubClient,
  GithubRepositorySnapshot,
  GithubSnapshotCheckRollup,
  GithubSnapshotDeployment,
  GithubSnapshotPullRequest
} from "./github-client";

export interface GithubReconcileTarget extends GithubRepositoryRecord {
  stagingEnvironmentName: string | null;
  productionEnvironmentName: string | null;
}

export interface GithubProjectionWriter {
  applyPullRequestWebhookProjection(input: {
    repositoryId: string;
    providerPullRequestId: string;
    number: number;
    title: string;
    body: string | null;
    url: string;
    state: GithubPullRequestState;
    isDraft: boolean;
    authorLogin: string | null;
    baseBranch: string;
    headBranch: string;
    headSha: string;
    createdAt: string;
    updatedAt: string;
    mergedAt: string | null;
    closedAt: string | null;
    titleIdentifiers: string[];
    bodyIdentifiers: string[];
    branchIdentifiers: string[];
  }): Promise<void>;
  applyCheckRollupWebhookProjection(input: {
    repositoryId: string;
    headSha: string;
    status: GithubCheckRollupStatus;
    url: string | null;
    checkCount: number;
    completedAt: string | null;
  }): Promise<void>;
  applyDeploymentWebhookProjection(input: {
    repositoryId: string;
    providerDeploymentId: string;
    headSha: string;
    environmentName: string | null;
    environment: GithubDeploymentEnvironment;
    status: GithubDeploymentStatus;
    url: string | null;
  }): Promise<void>;
}

export interface GithubReconcileRepository {
  listConnectedRepositories(): Promise<GithubReconcileTarget[]>;
  listRepositoriesWithFailedDeliveries(): Promise<GithubReconcileTarget[]>;
  listRepositoriesWithLinkedWorkItems(): Promise<GithubReconcileTarget[]>;
  markFailedDeliveriesProcessed(
    repositoryId: string,
    input: {
      processedAt: string;
      note: string;
    }
  ): Promise<number>;
}

export type GithubReconcileReason = "backfill" | "failed_delivery" | "linked_resync";
export type GithubReconcileMode = "backfill" | "replay-failed" | "resync-linked" | "cycle";

export interface GithubReconcileRepositorySummary {
  repositoryId: string;
  repositoryFullName: string;
  reason: GithubReconcileReason;
  pullRequestsApplied: number;
  checkRollupsApplied: number;
  deploymentsApplied: number;
  failedDeliveriesResolved: number;
}

export interface GithubReconcileSummary {
  mode: GithubReconcileMode;
  repositories: GithubReconcileRepositorySummary[];
  totals: {
    repositoriesReconciled: number;
    pullRequestsApplied: number;
    checkRollupsApplied: number;
    deploymentsApplied: number;
    failedDeliveriesResolved: number;
  };
}

interface GithubReconcileDependencies {
  repository: GithubReconcileRepository;
  projector: GithubProjectionWriter;
  client: GithubClient;
  now?: () => Date;
}

function serializeRepositoryTarget(row: {
  repository: typeof githubRepositories.$inferSelect;
  connection: typeof projectGithubConnections.$inferSelect;
}): GithubReconcileTarget {
  return {
    id: row.repository.id,
    workspaceId: row.repository.workspaceId,
    provider: row.repository.provider,
    providerRepositoryId: row.repository.providerRepositoryId,
    owner: row.repository.owner,
    name: row.repository.name,
    fullName: row.repository.fullName,
    defaultBranch: row.repository.defaultBranch,
    installationId: row.repository.installationId,
    isActive: row.repository.isActive,
    stagingEnvironmentName: row.connection.stagingEnvironmentName,
    productionEnvironmentName: row.connection.productionEnvironmentName,
    createdAt: row.repository.createdAt.toISOString(),
    updatedAt: row.repository.updatedAt.toISOString()
  };
}

function dedupeTargets(targets: GithubReconcileTarget[]) {
  const uniqueTargets = new Map<string, GithubReconcileTarget>();

  for (const target of targets) {
    uniqueTargets.set(target.id, target);
  }

  return Array.from(uniqueTargets.values());
}

function emptySummary(mode: GithubReconcileMode): GithubReconcileSummary {
  return {
    mode,
    repositories: [],
    totals: {
      repositoriesReconciled: 0,
      pullRequestsApplied: 0,
      checkRollupsApplied: 0,
      deploymentsApplied: 0,
      failedDeliveriesResolved: 0
    }
  };
}

function mergeSummaries(mode: GithubReconcileMode, summaries: GithubReconcileSummary[]): GithubReconcileSummary {
  const merged = emptySummary(mode);

  for (const summary of summaries) {
    merged.repositories.push(...summary.repositories);
    merged.totals.repositoriesReconciled += summary.totals.repositoriesReconciled;
    merged.totals.pullRequestsApplied += summary.totals.pullRequestsApplied;
    merged.totals.checkRollupsApplied += summary.totals.checkRollupsApplied;
    merged.totals.deploymentsApplied += summary.totals.deploymentsApplied;
    merged.totals.failedDeliveriesResolved += summary.totals.failedDeliveriesResolved;
  }

  return merged;
}

function createRepositorySummary(
  target: GithubReconcileTarget,
  reason: GithubReconcileReason,
  snapshot: GithubRepositorySnapshot,
  failedDeliveriesResolved = 0
): GithubReconcileRepositorySummary {
  return {
    repositoryId: target.id,
    repositoryFullName: target.fullName,
    reason,
    pullRequestsApplied: snapshot.pullRequests.length,
    checkRollupsApplied: snapshot.checkRollups.length,
    deploymentsApplied: snapshot.deployments.length,
    failedDeliveriesResolved
  };
}

async function applyPullRequests(
  projector: GithubProjectionWriter,
  repositoryId: string,
  pullRequests: GithubSnapshotPullRequest[]
) {
  for (const pullRequest of pullRequests) {
    await projector.applyPullRequestWebhookProjection({
      repositoryId,
      ...pullRequest
    });
  }
}

async function applyCheckRollups(
  projector: GithubProjectionWriter,
  repositoryId: string,
  checkRollups: GithubSnapshotCheckRollup[]
) {
  for (const checkRollup of checkRollups) {
    await projector.applyCheckRollupWebhookProjection({
      repositoryId,
      ...checkRollup
    });
  }
}

async function applyDeployments(
  projector: GithubProjectionWriter,
  repositoryId: string,
  deployments: GithubSnapshotDeployment[]
) {
  for (const deployment of deployments) {
    await projector.applyDeploymentWebhookProjection({
      repositoryId,
      ...deployment
    });
  }
}

async function reconcileTargets(
  dependencies: GithubReconcileDependencies,
  mode: GithubReconcileMode,
  reason: GithubReconcileReason,
  targets: GithubReconcileTarget[],
  options: {
    markFailuresResolved?: boolean;
  } = {}
) {
  const now = dependencies.now ?? (() => new Date());
  const summary = emptySummary(mode);
  const uniqueTargets = dedupeTargets(targets);

  for (const target of uniqueTargets) {
    const snapshot = await dependencies.client.getRepositorySnapshot(target);

    await applyPullRequests(dependencies.projector, target.id, snapshot.pullRequests);
    await applyCheckRollups(dependencies.projector, target.id, snapshot.checkRollups);
    await applyDeployments(dependencies.projector, target.id, snapshot.deployments);

    const failedDeliveriesResolved = options.markFailuresResolved
      ? await dependencies.repository.markFailedDeliveriesProcessed(target.id, {
          processedAt: now().toISOString(),
          note: "Reconciled by worker repository reconciliation."
        })
      : 0;

    summary.repositories.push(createRepositorySummary(target, reason, snapshot, failedDeliveriesResolved));
    summary.totals.repositoriesReconciled += 1;
    summary.totals.pullRequestsApplied += snapshot.pullRequests.length;
    summary.totals.checkRollupsApplied += snapshot.checkRollups.length;
    summary.totals.deploymentsApplied += snapshot.deployments.length;
    summary.totals.failedDeliveriesResolved += failedDeliveriesResolved;
  }

  return summary;
}

export async function backfillConnectedGithubRepositories(dependencies: GithubReconcileDependencies) {
  const targets = await dependencies.repository.listConnectedRepositories();
  return reconcileTargets(dependencies, "backfill", "backfill", targets);
}

export async function replayFailedGithubDeliveries(dependencies: GithubReconcileDependencies) {
  const targets = await dependencies.repository.listRepositoriesWithFailedDeliveries();
  return reconcileTargets(dependencies, "replay-failed", "failed_delivery", targets, {
    markFailuresResolved: true
  });
}

export async function resyncLinkedGithubRepositories(
  dependencies: GithubReconcileDependencies,
  options: {
    excludeRepositoryIds?: string[];
  } = {}
) {
  const excluded = new Set(options.excludeRepositoryIds ?? []);
  const targets = (await dependencies.repository.listRepositoriesWithLinkedWorkItems()).filter(
    (target) => !excluded.has(target.id)
  );

  return reconcileTargets(dependencies, "resync-linked", "linked_resync", targets);
}

export async function runGithubReconciliationCycle(
  dependencies: GithubReconcileDependencies & {
    mode: GithubReconcileMode;
  }
) {
  if (dependencies.mode === "backfill") {
    return backfillConnectedGithubRepositories(dependencies);
  }

  if (dependencies.mode === "replay-failed") {
    return replayFailedGithubDeliveries(dependencies);
  }

  if (dependencies.mode === "resync-linked") {
    return resyncLinkedGithubRepositories(dependencies);
  }

  const replaySummary = await replayFailedGithubDeliveries(dependencies);
  const resyncSummary = await resyncLinkedGithubRepositories(dependencies, {
    excludeRepositoryIds: replaySummary.repositories.map((repository) => repository.repositoryId)
  });

  return mergeSummaries("cycle", [replaySummary, resyncSummary]);
}

export function createGithubReconcileRepository(): GithubReconcileRepository {
  return {
    async listConnectedRepositories() {
      const rows = await db
        .select({
          repository: githubRepositories,
          connection: projectGithubConnections
        })
        .from(projectGithubConnections)
        .innerJoin(githubRepositories, eq(projectGithubConnections.repositoryId, githubRepositories.id))
        .where(eq(githubRepositories.isActive, true))
        .orderBy(desc(githubRepositories.updatedAt));

      return rows.map(serializeRepositoryTarget);
    },

    async listRepositoriesWithFailedDeliveries() {
      const rows = await db
        .select({
          repository: githubRepositories,
          connection: projectGithubConnections
        })
        .from(githubWebhookDeliveries)
        .innerJoin(githubRepositories, eq(githubWebhookDeliveries.repositoryId, githubRepositories.id))
        .innerJoin(projectGithubConnections, eq(projectGithubConnections.repositoryId, githubRepositories.id))
        .where(and(eq(githubWebhookDeliveries.status, "failed"), eq(githubRepositories.isActive, true)))
        .orderBy(desc(githubWebhookDeliveries.receivedAt));

      return dedupeTargets(rows.map(serializeRepositoryTarget));
    },

    async listRepositoriesWithLinkedWorkItems() {
      const rows = await db
        .select({
          repository: githubRepositories,
          connection: projectGithubConnections
        })
        .from(workItemGithubLinks)
        .innerJoin(githubRepositories, eq(workItemGithubLinks.repositoryId, githubRepositories.id))
        .innerJoin(projectGithubConnections, eq(projectGithubConnections.repositoryId, githubRepositories.id))
        .where(and(eq(githubRepositories.isActive, true), isNotNull(workItemGithubLinks.pullRequestId)))
        .orderBy(desc(workItemGithubLinks.linkedAt));

      return dedupeTargets(rows.map(serializeRepositoryTarget));
    },

    async markFailedDeliveriesProcessed(repositoryId, input) {
      const updated = await db
        .update(githubWebhookDeliveries)
        .set({
          status: "processed",
          processedAt: new Date(input.processedAt),
          errorMessage: input.note
        })
        .where(and(eq(githubWebhookDeliveries.repositoryId, repositoryId), eq(githubWebhookDeliveries.status, "failed")))
        .returning({
          id: githubWebhookDeliveries.id
        });

      return updated.length;
    }
  };
}
