import assert from "node:assert/strict";
import test from "node:test";

import type { GithubIssuesClient, GithubIssueSnapshot } from "./github-issues-client";
import {
  backfillConnectedGithubIssues,
  type GithubIssuesProjectionWriter,
  type GithubIssuesReconcileRepository,
  type GithubIssuesReconcileTarget
} from "./github-issues-reconcile";

function createTarget(overrides: Partial<GithubIssuesReconcileTarget> = {}): GithubIssuesReconcileTarget {
  return {
    id: "repo-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    provider: "github",
    providerRepositoryId: "repo_provider_1",
    owner: "the-platform",
    name: "platform-ops",
    fullName: "the-platform/platform-ops",
    defaultBranch: "main",
    installationId: "installation-1",
    isActive: true,
    issueSyncEnabled: true,
    importClosedIssues: false,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides
  };
}

function createIssue(overrides: Partial<GithubIssueSnapshot> = {}): GithubIssueSnapshot {
  return {
    providerIssueId: "issue-provider-1",
    number: 101,
    title: "OPS-101 reconcile GitHub issues",
    body: "Backfill issue projections.",
    url: "https://github.com/the-platform/platform-ops/issues/101",
    state: "open",
    authorLogin: "octocat",
    githubCreatedAt: "2026-04-24T11:00:00.000Z",
    githubUpdatedAt: "2026-04-24T11:30:00.000Z",
    githubClosedAt: null,
    comments: [],
    ...overrides
  };
}

class MemoryGithubIssuesReconcileRepository implements GithubIssuesReconcileRepository {
  constructor(private readonly targets: GithubIssuesReconcileTarget[]) {}

  listConnectedRepositoriesForIssueSync() {
    return Promise.resolve(this.targets);
  }
}

class MemoryGithubIssuesClient implements GithubIssuesClient {
  calls: Array<{ repositoryId: string; includeClosed: boolean | undefined }> = [];

  constructor(private readonly snapshots: Record<string, GithubIssueSnapshot[]>) {}

  getRepositoryIssuesSnapshot(target: GithubIssuesReconcileTarget, options?: { includeClosed?: boolean }) {
    this.calls.push({
      repositoryId: target.id,
      includeClosed: options?.includeClosed
    });

    const issues = this.snapshots[target.id];
    if (!issues) {
      return Promise.reject(new Error(`Missing issue snapshot for ${target.fullName}`));
    }

    return Promise.resolve({
      fetchedAt: "2026-04-24T12:00:00.000Z",
      issues
    });
  }

  updateIssue() {
    return Promise.reject(new Error("not implemented"));
  }
}

class MemoryGithubIssuesProjectionWriter implements GithubIssuesProjectionWriter {
  applied: Array<{ repositoryId: string; projectId: string; issue: GithubIssueSnapshot }> = [];

  applyGithubIssueSnapshot(input: { repositoryId: string; projectId: string; issue: GithubIssueSnapshot }) {
    this.applied.push(input);
    return Promise.resolve();
  }
}

void test("backfillConnectedGithubIssues reconciles connected repositories with issue sync enabled", async () => {
  const target = createTarget();
  const issues = [
    createIssue({
      providerIssueId: "issue-provider-1",
      number: 101,
      comments: [
        {
          providerCommentId: "comment-1",
          body: "First comment",
          url: "https://github.com/the-platform/platform-ops/issues/101#issuecomment-1",
          authorLogin: "octocat",
          githubCreatedAt: "2026-04-24T11:10:00.000Z",
          githubUpdatedAt: "2026-04-24T11:10:00.000Z"
        }
      ]
    }),
    createIssue({
      providerIssueId: "issue-provider-2",
      number: 102,
      comments: [
        {
          providerCommentId: "comment-2",
          body: "Second comment",
          url: "https://github.com/the-platform/platform-ops/issues/102#issuecomment-2",
          authorLogin: "hubot",
          githubCreatedAt: "2026-04-24T11:20:00.000Z",
          githubUpdatedAt: "2026-04-24T11:20:00.000Z"
        },
        {
          providerCommentId: "comment-3",
          body: "Third comment",
          url: "https://github.com/the-platform/platform-ops/issues/102#issuecomment-3",
          authorLogin: null,
          githubCreatedAt: "2026-04-24T11:25:00.000Z",
          githubUpdatedAt: "2026-04-24T11:25:00.000Z"
        }
      ]
    })
  ];
  const repository = new MemoryGithubIssuesReconcileRepository([target]);
  const client = new MemoryGithubIssuesClient({
    [target.id]: issues
  });
  const projector = new MemoryGithubIssuesProjectionWriter();

  const summary = await backfillConnectedGithubIssues({
    repository,
    client,
    projector
  });

  assert.deepEqual(client.calls, [{ repositoryId: "repo-1", includeClosed: false }]);
  assert.equal(projector.applied.length, 2);
  assert.deepEqual(
    projector.applied.map((entry) => ({
      repositoryId: entry.repositoryId,
      projectId: entry.projectId,
      issueNumber: entry.issue.number
    })),
    [
      { repositoryId: "repo-1", projectId: "project-1", issueNumber: 101 },
      { repositoryId: "repo-1", projectId: "project-1", issueNumber: 102 }
    ]
  );
  assert.equal(summary.mode, "backfill");
  assert.equal(summary.repositories.length, 1);
  assert.equal(summary.repositories[0]?.repositoryId, "repo-1");
  assert.equal(summary.repositories[0]?.repositoryFullName, "the-platform/platform-ops");
  assert.equal(summary.repositories[0]?.issuesApplied, 2);
  assert.equal(summary.repositories[0]?.commentsApplied, 3);
  assert.deepEqual(summary.totals, {
    repositoriesReconciled: 1,
    issuesApplied: 2,
    commentsApplied: 3
  });
});

void test("backfillConnectedGithubIssues skips repositories with issueSyncEnabled false", async () => {
  const disabled = createTarget({
    issueSyncEnabled: false
  });
  const repository = new MemoryGithubIssuesReconcileRepository([disabled]);
  const client = new MemoryGithubIssuesClient({
    [disabled.id]: [createIssue()]
  });
  const projector = new MemoryGithubIssuesProjectionWriter();

  const summary = await backfillConnectedGithubIssues({
    repository,
    client,
    projector
  });

  assert.deepEqual(client.calls, []);
  assert.deepEqual(projector.applied, []);
  assert.deepEqual(summary.totals, {
    repositoriesReconciled: 0,
    issuesApplied: 0,
    commentsApplied: 0
  });
});

void test("backfillConnectedGithubIssues passes importClosedIssues into client includeClosed", async () => {
  const target = createTarget({
    importClosedIssues: true
  });
  const repository = new MemoryGithubIssuesReconcileRepository([target]);
  const client = new MemoryGithubIssuesClient({
    [target.id]: []
  });
  const projector = new MemoryGithubIssuesProjectionWriter();

  await backfillConnectedGithubIssues({
    repository,
    client,
    projector
  });

  assert.deepEqual(client.calls, [{ repositoryId: "repo-1", includeClosed: true }]);
});

void test("backfillConnectedGithubIssues deduplicates duplicate repository targets by repository id", async () => {
  const target = createTarget();
  const repository = new MemoryGithubIssuesReconcileRepository([target, target]);
  const client = new MemoryGithubIssuesClient({
    [target.id]: [createIssue()]
  });
  const projector = new MemoryGithubIssuesProjectionWriter();

  const summary = await backfillConnectedGithubIssues({
    repository,
    client,
    projector
  });

  assert.deepEqual(client.calls, [{ repositoryId: "repo-1", includeClosed: false }]);
  assert.equal(projector.applied.length, 1);
  assert.equal(summary.totals.repositoriesReconciled, 1);
  assert.equal(summary.totals.issuesApplied, 1);
});

void test("backfillConnectedGithubIssues propagates client errors", async () => {
  const target = createTarget();
  const repository = new MemoryGithubIssuesReconcileRepository([target]);
  const client = new MemoryGithubIssuesClient({});
  const projector = new MemoryGithubIssuesProjectionWriter();

  await assert.rejects(
    () =>
      backfillConnectedGithubIssues({
        repository,
        client,
        projector
      }),
    /Missing issue snapshot/
  );
});

void test("backfillConnectedGithubIssues propagates projector errors", async () => {
  const target = createTarget();
  const repository = new MemoryGithubIssuesReconcileRepository([target]);
  const client = new MemoryGithubIssuesClient({
    [target.id]: [createIssue()]
  });
  const projector: GithubIssuesProjectionWriter = {
    applyGithubIssueSnapshot() {
      return Promise.reject(new Error("projector failed"));
    }
  };

  await assert.rejects(
    () =>
      backfillConnectedGithubIssues({
        repository,
        client,
        projector
      }),
    /projector failed/
  );
});
