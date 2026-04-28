import { describe, expect, it } from "vitest";

import type {
  GithubIssueImportClient,
  GithubIssueLinkRecord,
  GithubIssueProjectionRecord,
  GithubIssueSyncRepository
} from "./types";
import { importGithubIssuesForProject, projectGithubIssueWebhookEvent, syncWorkItemGithubOwnedFields } from "./service";
import { WorkspaceError } from "../../workspaces/core";
import { syncGithubWebhookRequest } from "../webhooks";

const now = "2026-04-28T12:00:00.000Z";

function workspace(role: "owner" | "admin" | "member" | "viewer" = "admin") {
  return {
    workspace: {
      id: "workspace-1",
      name: "Acme",
      slug: "acme",
      createdAt: now,
      updatedAt: now
    },
    membership: {
      workspaceId: "workspace-1",
      userId: "user-1",
      role,
      invitedAt: now,
      joinedAt: now
    },
    project: {
      id: "project-1",
      workspaceId: "workspace-1",
      key: "WEB",
      itemCounter: 0,
      title: "Website",
      description: "",
      stage: "Active" as const,
      dueDate: null,
      createdAt: now,
      updatedAt: now
    }
  };
}

function issue(overrides: Partial<GithubIssueImportClientIssue> = {}): GithubIssueImportClientIssue {
  return {
    providerIssueId: "issue-1",
    number: 42,
    title: "GitHub issue",
    body: "GitHub issue body",
    url: "https://github.com/acme/web/issues/42",
    state: "open",
    authorLogin: "octocat",
    githubCreatedAt: "2026-04-28T10:00:00.000Z",
    githubUpdatedAt: "2026-04-28T11:00:00.000Z",
    githubClosedAt: null,
    isPullRequest: false,
    comments: [],
    ...overrides
  };
}

type GithubIssueImportClientIssue = Awaited<
  ReturnType<GithubIssueImportClient["getRepositoryIssuesSnapshot"]>
>["issues"][number];

class FakeGithubIssueSyncRepository implements GithubIssueSyncRepository {
  readonly createdWorkItems: Parameters<GithubIssueSyncRepository["createWorkItemForGithubIssue"]>[0][] = [];
  readonly createdWorkItemsAndLinks: Parameters<
    GithubIssueSyncRepository["createWorkItemAndLinkGithubIssue"]
  >[0][] = [];
  readonly updatedWorkItems: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0][] = [];
  readonly upsertedIssues: Parameters<GithubIssueSyncRepository["upsertGithubIssue"]>[0][] = [];
  readonly upsertedLinks: Parameters<GithubIssueSyncRepository["upsertGithubIssueLink"]>[0][] = [];
  readonly upsertedComments: Parameters<GithubIssueSyncRepository["upsertGithubIssueComment"]>[0][] = [];
  readonly deletedComments: Parameters<NonNullable<GithubIssueSyncRepository["markGithubIssueCommentDeleted"]>>[0][] = [];
  readonly localPlatformComments: unknown[] = [];
  readonly createdOperations: unknown[] = [];
  readonly completedOperations: unknown[] = [];
  readonly failedOperations: unknown[] = [];
  readonly linkErrors: unknown[] = [];
  readonly outboundProjectionUpdates: unknown[] = [];
  readonly baselineUpdates: unknown[] = [];
  issueProjection: GithubIssueProjectionRecord | null = null;
  createAndLinkCreated = true;
  updateChanged = true;

  private readonly state = workspace();
  connection: Awaited<ReturnType<GithubIssueSyncRepository["getProjectGithubConnection"]>> = {
    connection: {
      id: "connection-1",
      projectId: "project-1",
      repositoryId: "repository-1",
      stagingEnvironmentName: null,
      productionEnvironmentName: null,
      createdAt: now,
      updatedAt: now
    },
    repository: {
      id: "repository-1",
      workspaceId: "workspace-1",
      provider: "github",
      providerRepositoryId: "repo-1",
      owner: "acme",
      name: "web",
      fullName: "acme/web",
      defaultBranch: "main",
      installationId: "installation-1",
      isActive: true,
      createdAt: now,
      updatedAt: now
    }
  };
  link: GithubIssueLinkRecord | null = null;
  workflowStates: Awaited<ReturnType<GithubIssueSyncRepository["listWorkflowStates"]>> = [
    {
      id: "backlog-state-1",
      projectId: "project-1",
      name: "Backlog",
      category: "backlog",
      position: 0,
      color: null,
      createdAt: now,
      updatedAt: now
    }
  ];
  workItemForLink: Awaited<ReturnType<NonNullable<GithubIssueSyncRepository["getWorkItemForGithubIssueLink"]>>> = null;

  constructor(role: "owner" | "admin" | "member" | "viewer" = "admin") {
    this.state = workspace(role);
  }

  async findWorkspaceBySlug(slug: string) {
    return slug === this.state.workspace.slug ? this.state.workspace : null;
  }

  async getMembership(workspaceId: string, userId: string) {
    return workspaceId === this.state.workspace.id && userId === "user-1" ? this.state.membership : null;
  }

  async getProjectByKey(workspaceId: string, projectKey: string) {
    return workspaceId === this.state.workspace.id && projectKey === this.state.project.key ? this.state.project : null;
  }

  async getProjectGithubConnection(projectId: string) {
    return projectId === this.state.project.id ? this.connection : null;
  }

  async getProjectGithubConnectionByRepositoryId(repositoryId: string) {
    return repositoryId === this.connection?.repository.id ? this.connection : null;
  }

  async findGithubRepositoryByProviderRepositoryId(providerRepositoryId: string) {
    if (providerRepositoryId !== this.connection?.repository.providerRepositoryId) {
      return null;
    }

    return {
      ...this.connection.repository,
      installationId: this.connection.repository.installationId ?? "installation-1"
    };
  }

  async getGithubWebhookDeliveryByDeliveryId() {
    return null;
  }

  async createGithubWebhookDelivery(input: {
    repositoryId: string | null;
    deliveryId: string;
    eventName: "pull_request" | "check_run" | "check_suite" | "deployment" | "deployment_status" | "issues" | "issue_comment";
    status: "pending" | "processed" | "failed";
    receivedAt: string;
    processedAt: string | null;
    errorMessage: string | null;
  }) {
    return {
      id: `webhook-${input.deliveryId}`,
      ...input
    };
  }

  async updateGithubWebhookDelivery(
    deliveryId: string,
    input: {
      status?: "pending" | "processed" | "failed";
      processedAt?: string | null;
      errorMessage?: string | null;
    }
  ) {
    return {
      id: `webhook-${deliveryId}`,
      repositoryId: this.connection?.repository.id ?? null,
      deliveryId,
      eventName: "issues" as const,
      status: input.status ?? "processed",
      receivedAt: now,
      processedAt: input.processedAt ?? now,
      errorMessage: input.errorMessage ?? null
    };
  }

  async getGithubRepositoryNotificationContext() {
    return null;
  }

  async getGithubIssueSyncSettings() {
    return null;
  }

  async listWorkflowStates(projectId: string) {
    return projectId === this.state.project.id ? this.workflowStates : [];
  }

  async upsertGithubIssue(input: Parameters<GithubIssueSyncRepository["upsertGithubIssue"]>[0]) {
    this.upsertedIssues.push(input);
    const projection = {
      id: `github-${input.providerIssueId}`,
      repositoryId: input.repositoryId,
      providerIssueId: input.providerIssueId,
      number: input.number,
      title: input.title,
      body: input.body,
      url: input.url,
      state: input.state,
      authorLogin: input.authorLogin,
      githubCreatedAt: input.githubCreatedAt,
      githubUpdatedAt: input.githubUpdatedAt,
      githubClosedAt: input.githubClosedAt,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now
    } satisfies GithubIssueProjectionRecord;
    this.issueProjection = projection;
    return projection;
  }

  async findGithubIssueByProviderIssueId(repositoryId: string, providerIssueId: string) {
    return this.issueProjection?.repositoryId === repositoryId && this.issueProjection.providerIssueId === providerIssueId
      ? this.issueProjection
      : null;
  }

  async getGithubIssueLinkByIssueId() {
    return this.link;
  }

  async getGithubIssueLinkForWorkItem() {
    return this.link && this.issueProjection && this.connection
      ? {
          link: this.link,
          issue: this.issueProjection,
          repository: this.connection.repository
        }
      : null;
  }

  async createGithubIssueSyncOperation(input: unknown) {
    this.createdOperations.push(input);
    const operation = input as {
      linkId: string;
      operationKey: string;
      operationType: "update_issue";
      status: "pending";
      requestedBy: string;
      githubUpdatedAtBefore: string | null;
      targetFields: Record<string, unknown>;
    };
    return {
      id: "operation-1",
      linkId: operation.linkId,
      operationKey: operation.operationKey,
      operationType: operation.operationType,
      status: operation.status,
      requestedBy: operation.requestedBy,
      requestedAt: now,
      completedAt: null,
      githubUpdatedAtBefore: operation.githubUpdatedAtBefore,
      targetFields: operation.targetFields,
      errorMessage: null
    };
  }

  async completeGithubIssueSyncOperation(input: unknown) {
    this.completedOperations.push(input);
  }

  async failGithubIssueSyncOperation(input: unknown) {
    this.failedOperations.push(input);
  }

  async markGithubIssueLinkError(input: unknown) {
    this.linkErrors.push(input);
    if (this.link) {
      this.link = {
        ...this.link,
        syncStatus: "error",
        errorMessage: (input as { errorMessage?: string }).errorMessage ?? null
      };
    }
  }

  async updateIssueProjectionFromOutbound(input: unknown) {
    this.outboundProjectionUpdates.push(input);
  }

  async updateGithubIssueLinkBaseline(input: unknown) {
    this.baselineUpdates.push(input);
  }

  async createWorkItemForGithubIssue(input: Parameters<GithubIssueSyncRepository["createWorkItemForGithubIssue"]>[0]) {
    this.createdWorkItems.push(input);
    return {
      id: "work-item-1",
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      identifier: "WEB-1",
      title: input.title,
      description: input.description,
      status: input.status,
      type: input.type,
      parentId: null,
      assigneeId: null,
      priority: input.priority,
      labels: null,
      workflowStateId: input.workflowStateId,
      stageId: null,
      planItemId: null,
      position: input.position,
      blockedReason: null,
      dueDate: null,
      completedAt: input.completedAt,
      createdAt: now,
      updatedAt: now
    };
  }

  async createWorkItemAndLinkGithubIssue(
    input: Parameters<GithubIssueSyncRepository["createWorkItemAndLinkGithubIssue"]>[0]
  ) {
    this.createdWorkItemsAndLinks.push(input);
    return {
      workItem: {
        id: "work-item-1",
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        identifier: "WEB-1",
        title: input.workItem.title,
        description: input.workItem.description,
        status: input.workItem.status,
        type: input.workItem.type,
        parentId: null,
        assigneeId: null,
        priority: input.workItem.priority,
        labels: null,
        workflowStateId: input.workItem.workflowStateId,
        stageId: null,
        planItemId: null,
        position: input.workItem.position,
        blockedReason: null,
        dueDate: null,
        completedAt: input.workItem.completedAt,
        createdAt: now,
        updatedAt: now
      },
      link: {
        id: "link-1",
        workItemId: "work-item-1",
        repositoryId: input.link.repositoryId,
        githubIssueId: input.link.githubIssueId,
        source: input.link.source,
        syncStatus: input.link.syncStatus,
        syncEnabled: input.link.syncEnabled,
        syncTitle: input.link.syncTitle,
        syncBody: input.link.syncBody,
        syncState: input.link.syncState,
        lastSyncedGithubUpdatedAt: input.link.lastSyncedGithubUpdatedAt,
        lastSyncedWorkItemUpdatedAt: now,
        lastSyncedTitleHash: input.link.lastSyncedTitleHash,
        lastSyncedBodyHash: input.link.lastSyncedBodyHash,
        lastSyncedState: input.link.lastSyncedState,
        conflictFields: input.link.conflictFields,
        errorMessage: input.link.errorMessage,
        createdAt: now,
        updatedAt: now
      },
      created: this.createAndLinkCreated
    };
  }

  async updateWorkItemFromGithubIssue(input: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0]) {
    this.updatedWorkItems.push(input);
    return {
      workItem: {
        id: input.workItemId,
        projectId: this.state.project.id,
        workspaceId: this.state.workspace.id,
        identifier: "WEB-1",
        title: input.title ?? "Existing title",
        description: input.description ?? "Existing body",
        status: input.status ?? "Todo",
        type: "task" as const,
        parentId: null,
        assigneeId: null,
        priority: "none" as const,
        labels: null,
        workflowStateId: input.workflowStateId ?? null,
        stageId: null,
        planItemId: null,
        position: 0,
        blockedReason: null,
        dueDate: null,
        completedAt: input.completedAt ?? null,
        createdAt: now,
        updatedAt: now
      },
      changed: this.updateChanged
    };
  }

  async upsertGithubIssueLink(input: Parameters<GithubIssueSyncRepository["upsertGithubIssueLink"]>[0]) {
    this.upsertedLinks.push(input);
    return {
      id: "link-1",
      workItemId: input.workItemId,
      repositoryId: input.repositoryId,
      githubIssueId: input.githubIssueId,
      source: input.source,
      syncStatus: input.syncStatus,
      syncEnabled: input.syncEnabled,
      syncTitle: input.syncTitle,
      syncBody: input.syncBody,
      syncState: input.syncState,
      lastSyncedGithubUpdatedAt: input.lastSyncedGithubUpdatedAt,
      lastSyncedWorkItemUpdatedAt: input.lastSyncedWorkItemUpdatedAt,
      lastSyncedTitleHash: input.lastSyncedTitleHash,
      lastSyncedBodyHash: input.lastSyncedBodyHash,
      lastSyncedState: input.lastSyncedState,
      conflictFields: input.conflictFields,
      errorMessage: input.errorMessage,
      createdAt: now,
      updatedAt: now
    };
  }

  async upsertGithubIssueComment(input: Parameters<GithubIssueSyncRepository["upsertGithubIssueComment"]>[0]) {
    this.upsertedComments.push(input);
  }

  async markGithubIssueCommentDeleted(
    input: Parameters<NonNullable<GithubIssueSyncRepository["markGithubIssueCommentDeleted"]>>[0]
  ) {
    this.deletedComments.push(input);
  }

  async getWorkItemForGithubIssueLink() {
    return this.workItemForLink;
  }
}

function client(issues: GithubIssueImportClientIssue[]): GithubIssueImportClient & { calls: unknown[] } {
  return {
    calls: [],
    async getRepositoryIssuesSnapshot(target, options) {
      this.calls.push({ target, options });
      return {
        fetchedAt: "2026-04-28T12:30:00.000Z",
        issues
      };
    }
  };
}

function linkedRepository(overrides: Partial<GithubIssueLinkRecord> = {}) {
  const repository = new FakeGithubIssueSyncRepository("admin");
  repository.issueProjection = {
    id: "github-issue-1",
    repositoryId: "repository-1",
    providerIssueId: "issue-1",
    number: 42,
    title: "GitHub issue",
    body: "GitHub issue body",
    url: "https://github.com/acme/web/issues/42",
    state: "open",
    authorLogin: "octocat",
    githubCreatedAt: "2026-04-28T10:00:00.000Z",
    githubUpdatedAt: "2026-04-28T11:00:00.000Z",
    githubClosedAt: null,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now
  };
  repository.link = {
    id: "link-1",
    workItemId: "work-item-1",
    repositoryId: "repository-1",
    githubIssueId: "github-issue-1",
    source: "initial_import",
    syncStatus: "synced",
    syncEnabled: true,
    syncTitle: true,
    syncBody: true,
    syncState: true,
    lastSyncedGithubUpdatedAt: "2026-04-28T11:00:00.000Z",
    lastSyncedWorkItemUpdatedAt: now,
    lastSyncedTitleHash: null,
    lastSyncedBodyHash: null,
    lastSyncedState: "open",
    conflictFields: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
  return repository;
}

function updateClient(snapshotOverrides: Partial<GithubIssueImportClientIssue> = {}) {
  return {
    calls: [] as unknown[],
    async updateIssue(target: unknown, issueNumber: number, input: unknown) {
      this.calls.push({ target, issueNumber, input });
      return issue({
        title: (input as { title?: string }).title ?? "GitHub issue",
        body: (input as { body?: string | null }).body ?? "GitHub issue body",
        state: (input as { state?: "open" | "closed" }).state ?? "open",
        githubUpdatedAt: "2026-04-28T12:45:00.000Z",
        ...snapshotOverrides
      });
    }
  };
}

describe("syncWorkItemGithubOwnedFields", () => {
  it("writes title edits to GitHub when title sync and link sync are enabled", async () => {
    const repository = linkedRepository();
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(repository, githubClient, {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields: { title: "Platform title" },
      now: () => new Date("2026-04-28T12:40:00.000Z")
    });

    expect(result).toEqual({ attempted: true, succeeded: true });
    expect(githubClient.calls).toEqual([
      {
        target: expect.objectContaining({ owner: "acme", name: "web", fullName: "acme/web" }),
        issueNumber: 42,
        input: { title: "Platform title" }
      }
    ]);
    expect(repository.createdOperations[0]).toMatchObject({
      operationType: "update_issue",
      status: "pending",
      requestedBy: "user-1",
      githubUpdatedAtBefore: "2026-04-28T11:00:00.000Z",
      targetFields: { title: "Platform title" }
    });
    expect(repository.completedOperations).toEqual([{ operationId: "operation-1" }]);
    expect(repository.outboundProjectionUpdates[0]).toMatchObject({
      githubIssueId: "github-issue-1",
      issue: expect.objectContaining({ title: "Platform title" })
    });
    expect(repository.baselineUpdates[0]).toMatchObject({
      linkId: "link-1",
      issue: expect.objectContaining({ title: "Platform title" })
    });
  });

  it("writes body edits to GitHub when body sync is enabled", async () => {
    const repository = linkedRepository();
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(repository, githubClient, {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields: { description: "Platform body" }
    });

    expect(result).toEqual({ attempted: true, succeeded: true });
    expect(githubClient.calls).toHaveLength(1);
    expect(githubClient.calls[0]).toMatchObject({ input: { body: "Platform body" } });
  });

  it.each([
    [{ status: "Done" }, "closed"],
    [{ completedAt: "2026-04-28T12:00:00.000Z" }, "closed"],
    [{ status: "Todo" }, "open"],
    [{ completedAt: null }, "open"],
    [{ state: "closed" }, "closed"],
    [{ state: "open" }, "open"]
  ] as const)("writes state %s to GitHub as %s when state sync is enabled", async (changedFields, state) => {
    const repository = linkedRepository();
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(repository, githubClient, {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields
    });

    expect(result).toEqual({ attempted: true, succeeded: true });
    expect(githubClient.calls[0]).toMatchObject({ input: { state } });
  });

  it("does not write unsupported platform-only fields or arbitrary workflow movement", async () => {
    const repository = linkedRepository();
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(repository, githubClient, {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields: {
        priority: "high",
        workflowStateId: "state-2",
        stageId: "stage-1",
        planItemId: "plan-1",
        assigneeId: "user-2",
        blockedReason: "Waiting"
      }
    });

    expect(result).toEqual({ attempted: false });
    expect(githubClient.calls).toHaveLength(0);
    expect(repository.createdOperations).toHaveLength(0);
  });

  it.each([
    [{ syncEnabled: false }, { title: "Platform title" }],
    [{ syncStatus: "conflict" }, { title: "Platform title" }],
    [{ syncStatus: "error" }, { title: "Platform title" }],
    [{ syncStatus: "paused" }, { title: "Platform title" }],
    [{ syncTitle: false }, { title: "Platform title" }],
    [{ syncBody: false }, { body: "Platform body" }],
    [{ syncState: false }, { status: "Done" }]
  ] as const)("does not write when link or field sync disallows it", async (linkOverrides, changedFields) => {
    const repository = linkedRepository(linkOverrides);
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(repository, githubClient, {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields
    });

    expect(result).toEqual({ attempted: false });
    expect(githubClient.calls).toHaveLength(0);
    expect(repository.createdOperations).toHaveLength(0);
  });

  it("marks operation failed and link error with a sanitized message when GitHub update fails", async () => {
    const repository = linkedRepository();
    const githubClient = {
      calls: [] as unknown[],
      async updateIssue(target: unknown, issueNumber: number, input: unknown) {
        this.calls.push({ target, issueNumber, input });
        throw new Error("GitHub token ghp_secret_1234567890abcdef request failed");
      }
    };

    const result = await syncWorkItemGithubOwnedFields(repository, githubClient, {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields: { title: "Platform title" }
    });

    expect(result).toEqual({ attempted: true, succeeded: false });
    expect(repository.failedOperations[0]).toMatchObject({
      operationId: "operation-1",
      errorMessage: expect.not.stringContaining("ghp_secret_1234567890abcdef")
    });
    expect(repository.linkErrors[0]).toMatchObject({
      linkId: "link-1",
      errorMessage: expect.not.stringContaining("ghp_secret_1234567890abcdef")
    });
    expect(repository.completedOperations).toHaveLength(0);
  });
});

describe("importGithubIssuesForProject", () => {
  it("rejects viewer/member roles below admin with WorkspaceError status 403", async () => {
    const repository = new FakeGithubIssueSyncRepository("member");
    const githubClient = client([]);

    await expect(
      importGithubIssuesForProject(repository, { userId: "user-1" }, "acme", "WEB", githubClient)
    ).rejects.toMatchObject({
      name: "WorkspaceError",
      status: 403
    });
  });

  it("requires an existing project GitHub connection", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.connection = null;

    await expect(
      importGithubIssuesForProject(repository, { userId: "user-1" }, "acme", "WEB", client([]))
    ).rejects.toSatisfy((error) => {
      return (
        error instanceof WorkspaceError &&
        (error.status === 404 || error.status === 409) &&
        error.message.toLowerCase().includes("github") &&
        error.message.toLowerCase().includes("connection")
      );
    });
  });

  it("imports non-PR GitHub issues as platform work items and links them", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    const githubClient = client([
      issue({
        comments: [
          {
            providerCommentId: "comment-1",
            body: "Comment from GitHub",
            url: "https://github.com/acme/web/issues/42#issuecomment-1",
            authorLogin: "mona",
            githubCreatedAt: "2026-04-28T10:30:00.000Z",
            githubUpdatedAt: "2026-04-28T10:30:00.000Z"
          }
        ]
      }),
      issue({
        providerIssueId: "pr-1",
        number: 43,
        title: "Pull request",
        url: "https://github.com/acme/web/pull/43",
        isPullRequest: true
      })
    ]);

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      githubClient
    );

    expect(summary).toEqual({
      created: 1,
      updated: 0,
      skippedPullRequests: 1,
      conflicted: 0,
      failed: 0
    });
    expect(repository.createdWorkItemsAndLinks).toHaveLength(1);
    expect(repository.createdWorkItemsAndLinks[0]).toMatchObject({
      workItem: {
        title: "GitHub issue",
        description: "GitHub issue body",
        type: "task",
        priority: "none",
        status: "Todo",
        workflowStateId: "backlog-state-1",
        stageId: null,
        planItemId: null
      },
      actorId: "user-1"
    });
    expect(repository.createdWorkItems).toHaveLength(0);
    expect(repository.upsertedLinks).toHaveLength(0);
    expect(repository.createdWorkItemsAndLinks[0]?.link).toMatchObject({
      repositoryId: "repository-1",
      githubIssueId: "github-issue-1",
      syncStatus: "synced",
      syncEnabled: false,
      syncTitle: true,
      syncBody: true,
      syncState: true
    });
  });

  it("updates an existing linked work item instead of creating a duplicate", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-issue-1",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: now,
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: null,
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([issue({ title: "Updated title", body: "Updated body", state: "closed" })])
    );

    expect(summary).toMatchObject({ created: 0, updated: 1 });
    expect(repository.createdWorkItems).toHaveLength(0);
    expect(repository.createdWorkItemsAndLinks).toHaveLength(0);
    expect(repository.updatedWorkItems).toHaveLength(1);
    expect(repository.updatedWorkItems[0]).toMatchObject({
      workItemId: "work-item-1",
      title: "Updated title",
      description: "Updated body",
      status: "Done"
    });
  });

  it("does not count disabled default links as conflicted and still imports comments", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-issue-1",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: false,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: now,
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: null,
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([
        issue({
          comments: [
            {
              providerCommentId: "comment-1",
              body: "Still projected",
              url: "https://github.com/acme/web/issues/42#issuecomment-1",
              authorLogin: "octocat",
              githubCreatedAt: "2026-04-28T10:05:00.000Z",
              githubUpdatedAt: "2026-04-28T10:10:00.000Z"
            }
          ]
        })
      ])
    );

    expect(summary).toMatchObject({ created: 0, updated: 0, conflicted: 0, failed: 0 });
    expect(repository.updatedWorkItems).toHaveLength(0);
    expect(repository.upsertedComments).toHaveLength(1);
  });

  it("does not increment created when atomic create and link finds an existing link", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.createAndLinkCreated = false;

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([issue()])
    );

    expect(summary).toMatchObject({ created: 0, updated: 0, conflicted: 0, failed: 0 });
    expect(repository.createdWorkItemsAndLinks).toHaveLength(1);
    expect(repository.createdWorkItems).toHaveLength(0);
    expect(repository.upsertedLinks).toHaveLength(0);
  });

  it("does not update or count updated when linked sync flags produce no patch", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-issue-1",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: false,
      syncBody: false,
      syncState: false,
      lastSyncedGithubUpdatedAt: now,
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: null,
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([issue()])
    );

    expect(summary).toMatchObject({ created: 0, updated: 0, conflicted: 0, failed: 0 });
    expect(repository.updatedWorkItems).toHaveLength(0);
  });

  it("does not count updated when repository reports the linked work item was unchanged", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.updateChanged = false;
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-issue-1",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: now,
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: null,
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([issue()])
    );

    expect(summary).toMatchObject({ created: 0, updated: 0, conflicted: 0, failed: 0 });
    expect(repository.updatedWorkItems).toHaveLength(1);
    expect(repository.upsertedLinks).toHaveLength(0);
  });

  it("upserts GitHub issue comments without creating local platform comments", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    const githubClient = client([
      issue({
        comments: [
          {
            providerCommentId: "comment-1",
            body: "GitHub comment",
            url: "https://github.com/acme/web/issues/42#issuecomment-1",
            authorLogin: "octocat",
            githubCreatedAt: "2026-04-28T10:05:00.000Z",
            githubUpdatedAt: "2026-04-28T10:10:00.000Z"
          }
        ]
      })
    ]);

    await importGithubIssuesForProject(repository, { userId: "user-1" }, "acme", "WEB", githubClient);

    expect(repository.upsertedComments).toEqual([
      {
        githubIssueId: "github-issue-1",
        providerCommentId: "comment-1",
        body: "GitHub comment",
        url: "https://github.com/acme/web/issues/42#issuecomment-1",
        authorLogin: "octocat",
        githubCreatedAt: "2026-04-28T10:05:00.000Z",
        githubUpdatedAt: "2026-04-28T10:10:00.000Z"
      }
    ]);
    expect(repository.localPlatformComments).toHaveLength(0);
  });

  it("passes includeClosed false by default when importClosedIssues is not configured", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    const githubClient = client([]);

    await importGithubIssuesForProject(repository, { userId: "user-1" }, "acme", "WEB", githubClient);

    expect(githubClient.calls).toEqual([
      {
        target: {
          owner: "acme",
          name: "web",
          fullName: "acme/web",
          installationId: "installation-1"
        },
        options: {
          includeClosed: false
        }
      }
    ]);
  });

  it("accepts a null installation id in the snapshot target contract", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    if (repository.connection) {
      repository.connection.repository.installationId = null;
    }
    const githubClient = client([]);

    await importGithubIssuesForProject(repository, { userId: "user-1" }, "acme", "WEB", githubClient);

    expect(githubClient.calls).toEqual([
      {
        target: {
          owner: "acme",
          name: "web",
          fullName: "acme/web",
          installationId: null
        },
        options: {
          includeClosed: false
        }
      }
    ]);
  });
});

function githubIssuePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    number: 42,
    title: "GitHub issue",
    body: "GitHub issue body",
    html_url: "https://github.com/acme/web/issues/42",
    state: "open",
    user: { login: "octocat" },
    created_at: "2026-04-28T10:00:00.000Z",
    updated_at: "2026-04-28T11:00:00.000Z",
    closed_at: null,
    ...overrides
  };
}

function githubIssueCommentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 9001,
    body: "GitHub comment",
    html_url: "https://github.com/acme/web/issues/42#issuecomment-9001",
    user: { login: "mona" },
    created_at: "2026-04-28T11:05:00.000Z",
    updated_at: "2026-04-28T11:10:00.000Z",
    ...overrides
  };
}

describe("projectGithubIssueWebhookEvent", () => {
  it("projects issues opened into a linked work item and issue projection", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issues",
      { action: "opened", issue: githubIssuePayload() },
      now
    );

    expect(result).toEqual({ ignored: false });
    expect(repository.upsertedIssues).toHaveLength(1);
    expect(repository.upsertedIssues[0]).toMatchObject({
      repositoryId: "repository-1",
      providerIssueId: "1001",
      number: 42,
      title: "GitHub issue",
      body: "GitHub issue body",
      state: "open"
    });
    expect(repository.createdWorkItemsAndLinks).toHaveLength(1);
    expect(repository.createdWorkItemsAndLinks[0]).toMatchObject({
      workItem: {
        title: "GitHub issue",
        description: "GitHub issue body",
        status: "Todo"
      },
      link: {
        repositoryId: "repository-1",
        githubIssueId: "github-1001",
        source: "github_issue_webhook",
        syncStatus: "synced"
      }
    });
  });

  it("ignores issues payloads that represent pull requests", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issues",
      { action: "opened", issue: githubIssuePayload({ pull_request: { html_url: "https://github.com/acme/web/pull/42" } }) },
      now
    );

    expect(result).toEqual({ ignored: true, reason: "pull_request_issue" });
    expect(repository.upsertedIssues).toHaveLength(0);
    expect(repository.createdWorkItemsAndLinks).toHaveLength(0);
  });

  it("marks linked issue title conflicts instead of overwriting when both sides changed", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-1001",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: "2026-04-28T09:00:00.000Z",
      lastSyncedWorkItemUpdatedAt: "2026-04-28T09:00:00.000Z",
      lastSyncedTitleHash: "57f44bd39f117b9eda3418ac243c0ec12dd2f8431a96a79783c9a36ac67a43fe",
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };
    repository.workItemForLink = {
      id: "work-item-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      identifier: "WEB-1",
      title: "Changed locally",
      description: "GitHub issue body",
      status: "Todo",
      type: "task",
      parentId: null,
      assigneeId: null,
      priority: "none",
      labels: null,
      workflowStateId: "backlog-state-1",
      stageId: null,
      planItemId: null,
      position: 0,
      blockedReason: null,
      dueDate: null,
      completedAt: null,
      createdAt: now,
      updatedAt: "2026-04-28T10:30:00.000Z"
    };

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issues",
      { action: "edited", issue: githubIssuePayload({ title: "Changed on GitHub" }) },
      now
    );

    expect(result).toEqual({ ignored: false });
    expect(repository.updatedWorkItems).toHaveLength(0);
    expect(repository.upsertedLinks).toHaveLength(1);
    expect(repository.upsertedLinks[0]).toMatchObject({
      workItemId: "work-item-1",
      syncStatus: "conflict",
      conflictFields: ["title"]
    });
  });

  it("refreshes the linked issue webhook sync baseline when the work item already matches GitHub", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.updateChanged = false;
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-1001",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: "2026-04-28T09:00:00.000Z",
      lastSyncedWorkItemUpdatedAt: "2026-04-28T09:00:00.000Z",
      lastSyncedTitleHash: "stale-title-hash",
      lastSyncedBodyHash: "stale-body-hash",
      lastSyncedState: "closed",
      conflictFields: ["title"],
      errorMessage: "stale conflict",
      createdAt: now,
      updatedAt: now
    };
    repository.workItemForLink = {
      id: "work-item-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      identifier: "WEB-1",
      title: "GitHub issue",
      description: "GitHub issue body",
      status: "Todo",
      type: "task",
      parentId: null,
      assigneeId: null,
      priority: "none",
      labels: null,
      workflowStateId: "backlog-state-1",
      stageId: null,
      planItemId: null,
      position: 0,
      blockedReason: null,
      dueDate: null,
      completedAt: null,
      createdAt: now,
      updatedAt: "2026-04-28T10:30:00.000Z"
    };

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issues",
      { action: "edited", issue: githubIssuePayload() },
      now
    );

    expect(result).toEqual({ ignored: false });
    expect(repository.updatedWorkItems).toHaveLength(1);
    expect(repository.upsertedLinks).toHaveLength(1);
    expect(repository.upsertedLinks[0]).toMatchObject({
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-1001",
      syncStatus: "synced",
      lastSyncedGithubUpdatedAt: "2026-04-28T11:00:00.000Z",
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: "7d94e2e7acad3b70eb76f83fbf6ce2314194503e524d5bc054df0bad880cd0eb",
      lastSyncedBodyHash: "3a370c18db71cdf372040daee6c8e55ddeb6719af5b2c9816d32863b9546ac26",
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null
    });
  });

  it("upserts external GitHub issue comments on created and edited events", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-1001",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: now,
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: null,
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      { action: "created", issue: githubIssuePayload(), comment: githubIssueCommentPayload() },
      now
    );
    await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "edited",
        issue: githubIssuePayload(),
        comment: githubIssueCommentPayload({ body: "Edited GitHub comment" })
      },
      now
    );

    expect(repository.upsertedComments).toEqual([
      {
        githubIssueId: "github-1001",
        providerCommentId: "9001",
        body: "GitHub comment",
        url: "https://github.com/acme/web/issues/42#issuecomment-9001",
        authorLogin: "mona",
        githubCreatedAt: "2026-04-28T11:05:00.000Z",
        githubUpdatedAt: "2026-04-28T11:10:00.000Z"
      },
      {
        githubIssueId: "github-1001",
        providerCommentId: "9001",
        body: "Edited GitHub comment",
        url: "https://github.com/acme/web/issues/42#issuecomment-9001",
        authorLogin: "mona",
        githubCreatedAt: "2026-04-28T11:05:00.000Z",
        githubUpdatedAt: "2026-04-28T11:10:00.000Z"
      }
    ]);
    expect(repository.localPlatformComments).toHaveLength(0);
  });

  it("marks issue comments deleted without creating local platform comments", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-1001",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: now,
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: null,
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      { action: "deleted", issue: githubIssuePayload(), comment: githubIssueCommentPayload() },
      now
    );

    expect(result).toEqual({ ignored: false });
    expect(repository.deletedComments).toEqual([
      {
        githubIssueId: "github-1001",
        providerCommentId: "9001",
        githubDeletedAt: now
      }
    ]);
    expect(repository.upsertedComments).toHaveLength(0);
    expect(repository.localPlatformComments).toHaveLength(0);
  });

  it("ignores issue_comment payloads for pull requests and does not create local platform comments", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "created",
        issue: githubIssuePayload({ pull_request: { html_url: "https://github.com/acme/web/pull/42" } }),
        comment: githubIssueCommentPayload()
      },
      now
    );

    expect(result).toEqual({ ignored: true, reason: "pull_request_issue_comment" });
    expect(repository.upsertedComments).toHaveLength(0);
    expect(repository.localPlatformComments).toHaveLength(0);
  });

  it("ignores pull request issue comments even when an issue projection and link already exist", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.issueProjection = {
      id: "github-1001",
      repositoryId: "repository-1",
      providerIssueId: "1001",
      number: 42,
      title: "GitHub issue",
      body: "GitHub issue body",
      url: "https://github.com/acme/web/issues/42",
      state: "open",
      authorLogin: "octocat",
      githubCreatedAt: "2026-04-28T10:00:00.000Z",
      githubUpdatedAt: "2026-04-28T11:00:00.000Z",
      githubClosedAt: null,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now
    };
    repository.link = {
      id: "link-1",
      workItemId: "work-item-1",
      repositoryId: "repository-1",
      githubIssueId: "github-1001",
      source: "initial_import",
      syncStatus: "synced",
      syncEnabled: true,
      syncTitle: true,
      syncBody: true,
      syncState: true,
      lastSyncedGithubUpdatedAt: now,
      lastSyncedWorkItemUpdatedAt: now,
      lastSyncedTitleHash: null,
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    const createdResult = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "created",
        issue: githubIssuePayload({ pull_request: { html_url: "https://github.com/acme/web/pull/42" } }),
        comment: githubIssueCommentPayload()
      },
      now
    );
    const deletedResult = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "deleted",
        issue: githubIssuePayload({ pull_request: { html_url: "https://github.com/acme/web/pull/42" } }),
        comment: githubIssueCommentPayload()
      },
      now
    );

    expect(createdResult).toEqual({ ignored: true, reason: "pull_request_issue_comment" });
    expect(deletedResult).toEqual({ ignored: true, reason: "pull_request_issue_comment" });
    expect(repository.upsertedComments).toHaveLength(0);
    expect(repository.deletedComments).toHaveLength(0);
    expect(repository.localPlatformComments).toHaveLength(0);
  });
});

describe("syncGithubWebhookRequest issue events", () => {
  it.each(["issues", "issue_comment"] as const)("accepts %s as a supported event name", async (eventName) => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    const request = new Request("https://example.test/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": eventName,
        "x-github-delivery": `delivery-${eventName}`,
        "x-hub-signature-256": "sha256=test"
      },
      body: JSON.stringify({
        repository: {
          id: "repo-1"
        },
        issue: githubIssuePayload()
      })
    });
    const deliveries: string[] = [];

    const response = await syncGithubWebhookRequest(repository, request, {
      secret: "secret",
      verifySignature: () => true,
      now: () => new Date(now),
      processDelivery: async ({ eventName: processedEventName }) => {
        deliveries.push(processedEventName);
      }
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: true });
    expect(deliveries).toEqual([eventName]);
  });
});
