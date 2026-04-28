import { describe, expect, it } from "vitest";

import type {
  GithubIssueImportClient,
  GithubIssueLinkRecord,
  GithubIssueProjectionRecord,
  GithubIssueSyncRepository
} from "./types";
import { importGithubIssuesForProject } from "./service";
import { WorkspaceError } from "../../workspaces/core";

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
  readonly localPlatformComments: unknown[] = [];

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

  async getGithubIssueSyncSettings() {
    return null;
  }

  async listWorkflowStates(projectId: string) {
    return projectId === this.state.project.id ? this.workflowStates : [];
  }

  async upsertGithubIssue(input: Parameters<GithubIssueSyncRepository["upsertGithubIssue"]>[0]) {
    this.upsertedIssues.push(input);
    return {
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
  }

  async getGithubIssueLinkByIssueId() {
    return this.link;
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
      }
    };
  }

  async updateWorkItemFromGithubIssue(input: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0]) {
    this.updatedWorkItems.push(input);
    return {
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
