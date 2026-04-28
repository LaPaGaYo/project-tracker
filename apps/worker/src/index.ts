import { pathToFileURL } from "node:url";

import { APP_NAME } from "@the-platform/shared";

import { createGithubConnectionRepository } from "../../web/src/server/github/repository";

import { createGithubClient } from "./github-client";
import { createGithubIssuesClient } from "./github-issues-client";
import type {
  GithubIssuesProjectionWriter
} from "./github-issues-reconcile";
import {
  createGithubReconcileRepository,
  runGithubReconciliationCycle,
  type GithubReconcileMode,
  type GithubReconcileRepository,
  type GithubReconcileSummary
} from "./github-reconcile";
import {
  createNotificationRepairRepository,
  runNotificationRepair,
  type NotificationRepairSummary
} from "./notification-repair";

type WorkerMode = GithubReconcileMode | "repair-notifications";

export function parseWorkerMode(value: string | undefined): WorkerMode {
  if (value === "backfill" || value === "replay-failed" || value === "resync-linked" || value === "cycle") {
    return value;
  }

  if (value === "repair-notifications") {
    return value;
  }

  return "cycle";
}

function readWorkerMode() {
  return parseWorkerMode(
    process.env.NOTIFICATION_REPAIR_MODE ?? process.env.WORKER_MODE ?? process.env.GITHUB_RECONCILE_MODE
  );
}

function readRepositoryScope() {
  const scopedRepository = process.env.GITHUB_REPOSITORY_FULL_NAME?.trim();
  return scopedRepository && scopedRepository.length > 0 ? scopedRepository : null;
}

function readNotificationRepairBackfillFlag() {
  return process.env.NOTIFICATION_REPAIR_BACKFILL_ACTIVITY === "true";
}

function createScopedRepository(
  repository: GithubReconcileRepository,
  repositoryFullName: string | null
): GithubReconcileRepository {
  if (!repositoryFullName) {
    return repository;
  }

  const filter = async <T extends { fullName: string }>(loader: () => Promise<T[]>) =>
    (await loader()).filter((target) => target.fullName === repositoryFullName);

  return {
    listConnectedRepositories: () => filter(() => repository.listConnectedRepositories()),
    listRepositoriesWithFailedDeliveries: () => filter(() => repository.listRepositoriesWithFailedDeliveries()),
    listRepositoriesWithLinkedWorkItems: () => filter(() => repository.listRepositoriesWithLinkedWorkItems()),
    listConnectedRepositoriesForIssueSync: () => filter(() => repository.listConnectedRepositoriesForIssueSync()),
    markFailedDeliveriesProcessed: (repositoryId, input) =>
      repository.markFailedDeliveriesProcessed(repositoryId, input)
  };
}

function createGithubIssuesProjectionWriter(
  repository: ReturnType<typeof createGithubConnectionRepository>
): GithubIssuesProjectionWriter {
  return {
    async applyGithubIssueSnapshot(input) {
      const projection = await repository.upsertGithubIssue({
        repositoryId: input.repositoryId,
        providerIssueId: input.issue.providerIssueId,
        number: input.issue.number,
        title: input.issue.title,
        body: input.issue.body,
        url: input.issue.url,
        state: input.issue.state,
        authorLogin: input.issue.authorLogin,
        githubCreatedAt: input.issue.githubCreatedAt,
        githubUpdatedAt: input.issue.githubUpdatedAt,
        githubClosedAt: input.issue.githubClosedAt
      });

      for (const comment of input.issue.comments) {
        await repository.upsertGithubIssueComment({
          githubIssueId: projection.id,
          providerCommentId: comment.providerCommentId,
          body: comment.body,
          url: comment.url,
          authorLogin: comment.authorLogin,
          githubCreatedAt: comment.githubCreatedAt,
          githubUpdatedAt: comment.githubUpdatedAt
        });
      }
    }
  };
}

export function formatGithubWorkerSummary(summary: GithubReconcileSummary) {
  const header = [
    `${APP_NAME} worker reconciliation`,
    `Mode: ${summary.mode}`,
    `Repositories reconciled: ${summary.totals.repositoriesReconciled}`,
    `Pull requests applied: ${summary.totals.pullRequestsApplied}`,
    `Check rollups applied: ${summary.totals.checkRollupsApplied}`,
    `Deployments applied: ${summary.totals.deploymentsApplied}`,
    `Failed deliveries resolved: ${summary.totals.failedDeliveriesResolved}`,
    `Issues applied: ${summary.totals.issuesApplied}`,
    `Issue comments applied: ${summary.totals.issueCommentsApplied}`
  ];

  const repositories = summary.repositories.map((repository) =>
    [
      `- ${repository.repositoryFullName}`,
      `  reason=${repository.reason}`,
      `  prs=${repository.pullRequestsApplied}`,
      `  checks=${repository.checkRollupsApplied}`,
      `  deploys=${repository.deploymentsApplied}`,
      `  failed=${repository.failedDeliveriesResolved}`
    ].join(" ")
  );

  return [...header, ...repositories].join("\n");
}

export function formatNotificationRepairSummary(summary: NotificationRepairSummary) {
  const header = [
    `${APP_NAME} worker notification repair`,
    `Mode: ${summary.mode}`,
    `Events repaired: ${summary.totals.eventsRepaired}`,
    `Activity events backfilled: ${summary.totals.activityEventsBackfilled}`,
    `Recipients inserted: ${summary.totals.recipientsInserted}`
  ];

  const events = summary.events.map((event) =>
    [
      `- ${event.eventId}`,
      `eventType=${event.eventType}`,
      `reason=${event.reason}`,
      `recipients=${event.recipientsInserted}`
    ].join(" ")
  );

  return [...header, ...events].join("\n");
}

export async function runWorkerFromEnvironment() {
  const mode = readWorkerMode();

  if (mode === "repair-notifications") {
    const summary = await runNotificationRepair({
      repository: createNotificationRepairRepository(),
      backfillRecentActivity: readNotificationRepairBackfillFlag(),
      now: () => new Date()
    });

    console.info(formatNotificationRepairSummary(summary));
    return summary;
  }

  const repositoryScope = readRepositoryScope();
  const repository = createScopedRepository(createGithubReconcileRepository(), repositoryScope);
  const projector = createGithubConnectionRepository();
  const client = createGithubClient();
  const issuesClient = createGithubIssuesClient();

  const summary = await runGithubReconciliationCycle({
    mode,
    repository,
    projector,
    client,
    issues: {
      repository,
      projector: createGithubIssuesProjectionWriter(projector),
      client: issuesClient
    },
    now: () => new Date()
  });

  console.info(formatGithubWorkerSummary(summary));
  return summary;
}

const isEntryPoint = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]!).href;

if (isEntryPoint) {
  void runWorkerFromEnvironment().catch((error) => {
    console.error(`${APP_NAME} worker failed`, error);
    process.exitCode = 1;
  });
}
