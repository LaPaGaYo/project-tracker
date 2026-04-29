import type { GithubRepositoryRecord } from "@the-platform/shared";

import type { GithubIssuesClient, GithubIssueSnapshot } from "./github-issues-client";

export interface GithubIssuesReconcileTarget extends GithubRepositoryRecord {
  projectId: string;
  issueSyncEnabled: boolean;
  importClosedIssues: boolean;
}

export interface GithubIssuesProjectionWriter {
  applyGithubIssueSnapshot(input: {
    repositoryId: string;
    projectId: string;
    issue: GithubIssueSnapshot;
  }): Promise<void>;
}

export interface GithubIssuesReconcileRepository {
  listConnectedRepositoriesForIssueSync(): Promise<GithubIssuesReconcileTarget[]>;
}

export interface GithubIssuesReconcileRepositorySummary {
  repositoryId: string;
  repositoryFullName: string;
  issuesApplied: number;
  commentsApplied: number;
}

export interface GithubIssuesReconcileSummary {
  mode: "backfill";
  repositories: GithubIssuesReconcileRepositorySummary[];
  totals: {
    repositoriesReconciled: number;
    issuesApplied: number;
    commentsApplied: number;
  };
}

interface GithubIssuesReconcileDependencies {
  repository: GithubIssuesReconcileRepository;
  projector: GithubIssuesProjectionWriter;
  client: GithubIssuesClient;
}

function emptySummary(): GithubIssuesReconcileSummary {
  return {
    mode: "backfill",
    repositories: [],
    totals: {
      repositoriesReconciled: 0,
      issuesApplied: 0,
      commentsApplied: 0
    }
  };
}

function dedupeTargets(targets: GithubIssuesReconcileTarget[]) {
  const uniqueTargets = new Map<string, GithubIssuesReconcileTarget>();

  for (const target of targets) {
    uniqueTargets.set(target.id, target);
  }

  return Array.from(uniqueTargets.values());
}

function countComments(issues: GithubIssueSnapshot[]) {
  return issues.reduce((total, issue) => total + issue.comments.length, 0);
}

export async function backfillConnectedGithubIssues(
  dependencies: GithubIssuesReconcileDependencies
): Promise<GithubIssuesReconcileSummary> {
  const summary = emptySummary();
  const targets = dedupeTargets(
    (await dependencies.repository.listConnectedRepositoriesForIssueSync()).filter((target) => target.issueSyncEnabled)
  );

  for (const target of targets) {
    const snapshot = await dependencies.client.getRepositoryIssuesSnapshot(target, {
      includeClosed: target.importClosedIssues
    });

    for (const issue of snapshot.issues) {
      await dependencies.projector.applyGithubIssueSnapshot({
        repositoryId: target.id,
        projectId: target.projectId,
        issue
      });
    }

    const commentsApplied = countComments(snapshot.issues);

    summary.repositories.push({
      repositoryId: target.id,
      repositoryFullName: target.fullName,
      issuesApplied: snapshot.issues.length,
      commentsApplied
    });
    summary.totals.repositoriesReconciled += 1;
    summary.totals.issuesApplied += snapshot.issues.length;
    summary.totals.commentsApplied += commentsApplied;
  }

  return summary;
}
