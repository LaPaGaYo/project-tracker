import { describe, expect, it, vi } from "vitest";

import type {
  GithubIssueImportClient,
  GithubIssueLinkRecord,
  GithubIssueProjectionRecord,
  GithubIssueSyncSettings,
  GithubIssueSyncRepository,
} from "./types";
import {
  createGithubIssuesClient,
  importGithubIssuesForProject,
  projectGithubIssueWebhookEvent,
  syncWorkItemGithubOwnedFields,
  updateProjectGithubIssueSyncSettings,
} from "./service";
import { WorkspaceError } from "../../workspaces/core";
import { syncGithubWebhookRequest } from "../webhooks";

const now = "2026-04-28T12:00:00.000Z";
const testPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAlmE94ty2BNjZed9Mn2ij7xDcsZBCbCbSajZZQM1Vx5ouIRYF
Tk9CGJoMn7tJwmHUaR7A7jERo3/9I2eRTZ4poTlAkyoKFLM9oMTenQZI71DfKhEn
R6+qkNDcIMmvoLxbGQbNC1H1T3cKp2QvIrnn0pbN7+Gpv3sw3jkGXV21Es2UZcJK
JnhnO4toTt5TkUNf0zM+D86q4GfHRWCQd2XuqMO6iLIRgCLvzxY60F7caYwznYr0
iYHSknS5lYyxC1WzFTEDJ2V7q7syF1DxFMGWhEcefqFf9lsMzt/WBaD+pAhrYd6Z
cEkJQnmnV6hRGSSgDJMqWK2WD+f1yoKTDqKQVQIDAQABAoIBAEm9xT8I68JEkF7d
1IoXRlwGpPL95h8NhmpzBVmGk57W3ZqMhzhqJ8Etp/dApfr/dLqHdFRK8WqvO8Ff
kP39E71tU0j3QFTNddcHxuQ/78QpjmIEgV5Chyn94/P7teI890UjUcYl7NlmgK4K
XjWWED4Dk4yPbiwgvbjNO0/rG0SkjApAN4iIiBgHtsHVuX10cTqWa1vm0Nw1IvOI
3zBsFRmygC/7HQv9w1KmGXFenZnQGeztqQxmUVM/atFOUK3qImoXkNk3tqqQySO3
ALhS+NK7UjU89GcZi90IyHxo4xEm03dtWFjF3To3mfbDwo3qks5e+xWMeJ5L6Si/
Tehlj/ECgYEAzb7pRO19HcpxxkFC5kQ6pM6puYPmtjfOlqQKSUtlP6jQj77+zqaG
82Qf0K22MuKU3psWIupHY4YbTaT1c3RcnKV9QvEfQMjlMSt2TD08TWrB88YhNLuO
AyZbjTNTI4NBs2m4HNqUmJ9sNCrPXibQlFkBNFW+lPm5mq+ioyRhf/sCgYEAt60q
wqc4R9is1rD1NrabDvn4jaSTQwEsbTOuYtMhuxIwVI1xj99aYkgyICDZmkNAx0KB
N2AjYIIyENdEeN9a2Z7+hw1fKGmdxt9XKijAtSOH/7OCbPH7pC8kkwY9j9ppgf3D
7bNaY8l4QhCqxc0yo7o3uX9iGXW41M4EPlUL/FUCgYA9uEJlj85C/uB9lCmOqUnb
2HaovDQEfVHBW6Fj7J6BkKPZvKekO5bYx0FjPMK4UqsuuAiaKZuzNsqaI7cfWHQ+
pLWQcfKkVSyaqwfSVYl4LwY2P6X+0S24oFUii6cUIU9vkfF1fbpXKG4STvkLROvS
1aL2acPi38NlEXKE1duDNQKBgD0roAmP5qiLJkQx+/B9kfhFVr+HS4+1+KugF7Fo
w9c96cgTZZEi2rJmGZGdgOqjyuSWTHwHVctS6c+i39L2FjEpNVB4koYBx/Tpx3gB
2lFgyEPf+IISCFNjDX28FWLE8QYc0Vz61Z78OAoPMqNUZVYDoHpHXeIar4+oUOBe
4lVNAoGBAMVFgci41uABRE5BBx1BzAdlpgl/DJdjAuVKAUsaRGMQo1VBmKo0xQcd
/80yVLY0hi+bTbNYXHsJvi58QpebuvaiNxLnoC0O9HFpb5pBjITz08b7Ikn8o8iR
s95am2X9xg6SuKGJrPTGxYgrwQMkN+AgzqlMxDqLuDj+3PNqKN2M
-----END RSA PRIVATE KEY-----`;

function workspace(role: "owner" | "admin" | "member" | "viewer" = "admin") {
  return {
    workspace: {
      id: "workspace-1",
      name: "Acme",
      slug: "acme",
      createdAt: now,
      updatedAt: now,
    },
    membership: {
      workspaceId: "workspace-1",
      userId: "user-1",
      role,
      invitedAt: now,
      joinedAt: now,
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
      updatedAt: now,
    },
  };
}

function issue(
  overrides: Partial<GithubIssueImportClientIssue> = {}
): GithubIssueImportClientIssue {
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
    ...overrides,
  };
}

type GithubIssueImportClientIssue = Awaited<
  ReturnType<GithubIssueImportClient["getRepositoryIssuesSnapshot"]>
>["issues"][number];

class FakeGithubIssueSyncRepository implements GithubIssueSyncRepository {
  readonly createdWorkItems: Parameters<
    GithubIssueSyncRepository["createWorkItemForGithubIssue"]
  >[0][] = [];
  readonly createdWorkItemsAndLinks: Parameters<
    GithubIssueSyncRepository["createWorkItemAndLinkGithubIssue"]
  >[0][] = [];
  readonly updatedWorkItems: Parameters<
    GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]
  >[0][] = [];
  readonly upsertedIssues: Parameters<
    GithubIssueSyncRepository["upsertGithubIssue"]
  >[0][] = [];
  readonly upsertedLinks: Parameters<
    GithubIssueSyncRepository["upsertGithubIssueLink"]
  >[0][] = [];
  readonly upsertedComments: Parameters<
    GithubIssueSyncRepository["upsertGithubIssueComment"]
  >[0][] = [];
  readonly deletedComments: Parameters<
    NonNullable<GithubIssueSyncRepository["markGithubIssueCommentDeleted"]>
  >[0][] = [];
  readonly localPlatformComments: unknown[] = [];
  readonly createdOperations: unknown[] = [];
  readonly completedOperations: unknown[] = [];
  readonly failedOperations: unknown[] = [];
  readonly linkErrors: unknown[] = [];
  readonly outboundProjectionUpdates: unknown[] = [];
  readonly baselineUpdates: unknown[] = [];
  readonly settingsUpdates: {
    projectId: string;
    settings: GithubIssueSyncSettings;
  }[] = [];
  issueProjection: GithubIssueProjectionRecord | null = null;
  createAndLinkCreated = true;
  updateChanged = true;
  existingOperationStatus: "pending" | "succeeded" | "failed" | null = null;
  existingOperationRequestedBy: string | null = null;

  private readonly state = workspace();
  connection: Awaited<
    ReturnType<GithubIssueSyncRepository["getProjectGithubConnection"]>
  > = {
    connection: {
      id: "connection-1",
      projectId: "project-1",
      repositoryId: "repository-1",
      stagingEnvironmentName: null,
      productionEnvironmentName: null,
      issueSyncEnabled: false,
      issueImportClosed: false,
      issueSyncTitle: true,
      issueSyncBody: true,
      issueSyncState: true,
      issueClosedWorkflowStateId: null,
      issueReopenedWorkflowStateId: null,
      createdAt: now,
      updatedAt: now,
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
      updatedAt: now,
    },
  };
  link: GithubIssueLinkRecord | null = null;
  workflowStates: Awaited<
    ReturnType<GithubIssueSyncRepository["listWorkflowStates"]>
  > = [
    {
      id: "backlog-state-1",
      projectId: "project-1",
      name: "Backlog",
      category: "backlog",
      position: 0,
      color: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  workItemForLink: Awaited<
    ReturnType<
      NonNullable<GithubIssueSyncRepository["getWorkItemForGithubIssueLink"]>
    >
  > = null;

  constructor(role: "owner" | "admin" | "member" | "viewer" = "admin") {
    this.state = workspace(role);
  }

  async findWorkspaceBySlug(slug: string) {
    return slug === this.state.workspace.slug ? this.state.workspace : null;
  }

  async getMembership(workspaceId: string, userId: string) {
    return workspaceId === this.state.workspace.id && userId === "user-1"
      ? this.state.membership
      : null;
  }

  async getProjectByKey(workspaceId: string, projectKey: string) {
    return workspaceId === this.state.workspace.id &&
      projectKey === this.state.project.key
      ? this.state.project
      : null;
  }

  async getProjectGithubConnection(projectId: string) {
    return projectId === this.state.project.id ? this.connection : null;
  }

  async getProjectGithubConnectionByRepositoryId(repositoryId: string) {
    return repositoryId === this.connection?.repository.id
      ? this.connection
      : null;
  }

  async findGithubRepositoryByProviderRepositoryId(
    providerRepositoryId: string
  ) {
    if (
      providerRepositoryId !== this.connection?.repository.providerRepositoryId
    ) {
      return null;
    }

    return {
      ...this.connection.repository,
      installationId:
        this.connection.repository.installationId ?? "installation-1",
    };
  }

  async getGithubWebhookDeliveryByDeliveryId() {
    return null;
  }

  async createGithubWebhookDelivery(input: {
    repositoryId: string | null;
    deliveryId: string;
    eventName:
      | "pull_request"
      | "check_run"
      | "check_suite"
      | "deployment"
      | "deployment_status"
      | "issues"
      | "issue_comment";
    status: "pending" | "processed" | "failed";
    receivedAt: string;
    processedAt: string | null;
    errorMessage: string | null;
  }) {
    return {
      id: `webhook-${input.deliveryId}`,
      ...input,
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
      errorMessage: input.errorMessage ?? null,
    };
  }

  async getGithubRepositoryNotificationContext() {
    return null;
  }

  async getGithubIssueSyncSettings() {
    return null;
  }

  async updateGithubIssueSyncSettings(
    projectId: string,
    settings: GithubIssueSyncSettings
  ) {
    this.settingsUpdates.push({ projectId, settings });
    return settings;
  }

  async listWorkflowStates(projectId: string) {
    return projectId === this.state.project.id ? this.workflowStates : [];
  }

  async upsertGithubIssue(
    input: Parameters<GithubIssueSyncRepository["upsertGithubIssue"]>[0]
  ) {
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
      updatedAt: now,
    } satisfies GithubIssueProjectionRecord;
    this.issueProjection = projection;
    return projection;
  }

  async findGithubIssueByProviderIssueId(
    repositoryId: string,
    providerIssueId: string
  ) {
    return this.issueProjection?.repositoryId === repositoryId &&
      this.issueProjection.providerIssueId === providerIssueId
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
          repository: this.connection.repository,
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
    const status = this.existingOperationStatus ?? operation.status;
    const requestedBy =
      this.existingOperationRequestedBy ?? operation.requestedBy;
    return {
      id: "operation-1",
      linkId: operation.linkId,
      operationKey: operation.operationKey,
      operationType: operation.operationType,
      status,
      requestedBy,
      requestedAt: now,
      completedAt: this.existingOperationStatus === "succeeded" ? now : null,
      githubUpdatedAtBefore: operation.githubUpdatedAtBefore,
      targetFields: operation.targetFields,
      errorMessage: null,
      reused: this.existingOperationStatus !== null,
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
        errorMessage: (input as { errorMessage?: string }).errorMessage ?? null,
      };
    }
  }

  async updateIssueProjectionFromOutbound(input: unknown) {
    this.outboundProjectionUpdates.push(input);
  }

  async updateGithubIssueLinkBaseline(input: unknown) {
    this.baselineUpdates.push(input);
  }

  async createWorkItemForGithubIssue(
    input: Parameters<
      GithubIssueSyncRepository["createWorkItemForGithubIssue"]
    >[0]
  ) {
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
      updatedAt: now,
    };
  }

  async createWorkItemAndLinkGithubIssue(
    input: Parameters<
      GithubIssueSyncRepository["createWorkItemAndLinkGithubIssue"]
    >[0]
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
        updatedAt: now,
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
        updatedAt: now,
      },
      created: this.createAndLinkCreated,
    };
  }

  async updateWorkItemFromGithubIssue(
    input: Parameters<
      GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]
    >[0]
  ) {
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
        updatedAt: now,
      },
      changed: this.updateChanged,
    };
  }

  async upsertGithubIssueLink(
    input: Parameters<GithubIssueSyncRepository["upsertGithubIssueLink"]>[0]
  ) {
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
      updatedAt: now,
    };
  }

  async upsertGithubIssueComment(
    input: Parameters<GithubIssueSyncRepository["upsertGithubIssueComment"]>[0]
  ) {
    this.upsertedComments.push(input);
  }

  async markGithubIssueCommentDeleted(
    input: Parameters<
      NonNullable<GithubIssueSyncRepository["markGithubIssueCommentDeleted"]>
    >[0]
  ) {
    this.deletedComments.push(input);
  }

  async getWorkItemForGithubIssueLink() {
    return this.workItemForLink;
  }
}

function client(
  issues: GithubIssueImportClientIssue[]
): GithubIssueImportClient & { calls: unknown[] } {
  return {
    calls: [],
    async getRepositoryIssuesSnapshot(target, options) {
      this.calls.push({ target, options });
      return {
        fetchedAt: "2026-04-28T12:30:00.000Z",
        issues,
      };
    },
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
    updatedAt: now,
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
    ...overrides,
  };
  return repository;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function githubIssuesClient(fetchImpl: typeof fetch) {
  return createGithubIssuesClient({
    appId: "123",
    privateKey: testPrivateKey,
    apiBaseUrl: "https://api.github.test",
    fetch: fetchImpl,
    now: () => new Date(now),
  });
}

describe("createGithubIssuesClient", () => {
  it("imports issues across multiple Link pages", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/access_tokens")) {
        return jsonResponse({ token: "installation-token" });
      }
      if (requestUrl.includes("/issues?state=open&per_page=100")) {
        return jsonResponse(
          [
            githubIssuePayload({
              id: 1001,
              number: 1,
              title: "First issue",
              html_url: "https://github.com/acme/web/issues/1",
              comments: 0,
            }),
          ],
          {
            headers: {
              link: '<https://api.github.test/repos/acme/web/issues?page=2&per_page=100>; rel="next"',
            },
          }
        );
      }
      if (requestUrl.includes("/issues?page=2&per_page=100")) {
        return jsonResponse([
          githubIssuePayload({
            id: 1002,
            number: 2,
            title: "Second issue",
            html_url: "https://github.com/acme/web/issues/2",
            comments: 0,
          }),
        ]);
      }

      throw new Error(`Unexpected request: ${requestUrl}`);
    }) as unknown as typeof fetch;

    const snapshot = await githubIssuesClient(
      fetchImpl
    ).getRepositoryIssuesSnapshot({
      owner: "acme",
      name: "web",
      fullName: "acme/web",
      installationId: "installation-1",
    });

    expect(snapshot.issues.map((issue) => issue.number)).toEqual([1, 2]);
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(3);
  });

  it("follows comment pagination for imported issues", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/access_tokens")) {
        return jsonResponse({ token: "installation-token" });
      }
      if (requestUrl.includes("/issues?state=open&per_page=100")) {
        return jsonResponse([
          githubIssuePayload({
            comments: 2,
            comments_url:
              "https://api.github.test/repos/acme/web/issues/42/comments",
          }),
        ]);
      }
      if (requestUrl.endsWith("/issues/42/comments")) {
        return jsonResponse([githubIssueCommentPayload({ id: 9001 })], {
          headers: {
            link: '</repos/acme/web/issues/42/comments?page=2>; rel="next"',
          },
        });
      }
      if (requestUrl.endsWith("/issues/42/comments?page=2")) {
        return jsonResponse([
          githubIssueCommentPayload({
            id: 9002,
            body: "Second GitHub comment",
          }),
        ]);
      }

      throw new Error(`Unexpected request: ${requestUrl}`);
    }) as unknown as typeof fetch;

    const snapshot = await githubIssuesClient(
      fetchImpl
    ).getRepositoryIssuesSnapshot({
      owner: "acme",
      name: "web",
      fullName: "acme/web",
      installationId: "installation-1",
    });

    expect(
      snapshot.issues[0]?.comments.map((comment) => comment.providerCommentId)
    ).toEqual(["9001", "9002"]);
  });

  it("does not request comments for non-PR issues with zero comments", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/access_tokens")) {
        return jsonResponse({ token: "installation-token" });
      }
      if (requestUrl.includes("/issues?state=open&per_page=100")) {
        return jsonResponse([
          githubIssuePayload({
            comments: 0,
            comments_url:
              "https://api.github.test/repos/acme/web/issues/42/comments",
          }),
        ]);
      }

      throw new Error(`Unexpected request: ${requestUrl}`);
    }) as unknown as typeof fetch;

    const snapshot = await githubIssuesClient(
      fetchImpl
    ).getRepositoryIssuesSnapshot({
      owner: "acme",
      name: "web",
      fullName: "acme/web",
      installationId: "installation-1",
    });

    expect(snapshot.issues[0]?.comments).toEqual([]);
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(2);
  });
});

function updateClient(
  snapshotOverrides: Partial<GithubIssueImportClientIssue> = {}
) {
  return {
    calls: [] as unknown[],
    async updateIssue(target: unknown, issueNumber: number, input: unknown) {
      this.calls.push({ target, issueNumber, input });
      return issue({
        title: (input as { title?: string }).title ?? "GitHub issue",
        body: (input as { body?: string | null }).body ?? "GitHub issue body",
        state: (input as { state?: "open" | "closed" }).state ?? "open",
        githubUpdatedAt: "2026-04-28T12:45:00.000Z",
        ...snapshotOverrides,
      });
    },
  };
}

describe("syncWorkItemGithubOwnedFields", () => {
  it("writes title edits to GitHub when title sync and link sync are enabled", async () => {
    const repository = linkedRepository();
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(
      repository,
      githubClient,
      {
        actorId: "user-1",
        projectId: "project-1",
        workItemId: "work-item-1",
        changedFields: { title: "Platform title" },
        now: () => new Date("2026-04-28T12:40:00.000Z"),
      }
    );

    expect(result).toEqual({ attempted: true, succeeded: true });
    expect(githubClient.calls).toEqual([
      {
        target: expect.objectContaining({
          owner: "acme",
          name: "web",
          fullName: "acme/web",
        }),
        issueNumber: 42,
        input: { title: "Platform title" },
      },
    ]);
    expect(repository.createdOperations[0]).toMatchObject({
      operationType: "update_issue",
      status: "pending",
      requestedBy: "user-1",
      githubUpdatedAtBefore: "2026-04-28T11:00:00.000Z",
      targetFields: { title: "Platform title" },
    });
    expect(repository.completedOperations).toEqual([
      { operationId: "operation-1" },
    ]);
    expect(repository.outboundProjectionUpdates[0]).toMatchObject({
      githubIssueId: "github-issue-1",
      issue: expect.objectContaining({ title: "Platform title" }),
    });
    expect(repository.baselineUpdates[0]).toMatchObject({
      linkId: "link-1",
      issue: expect.objectContaining({ title: "Platform title" }),
    });
  });

  it("writes body edits to GitHub when body sync is enabled", async () => {
    const repository = linkedRepository();
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(
      repository,
      githubClient,
      {
        actorId: "user-1",
        projectId: "project-1",
        workItemId: "work-item-1",
        changedFields: { description: "Platform body" },
      }
    );

    expect(result).toEqual({ attempted: true, succeeded: true });
    expect(githubClient.calls).toHaveLength(1);
    expect(githubClient.calls[0]).toMatchObject({
      input: { body: "Platform body" },
    });
  });

  it.each([
    [{ status: "Done" }, "closed"],
    [{ completedAt: "2026-04-28T12:00:00.000Z" }, "closed"],
    [{ status: "Todo" }, "open"],
    [{ completedAt: null }, "open"],
    [{ state: "closed" }, "closed"],
    [{ state: "open" }, "open"],
  ] as const)(
    "writes state %s to GitHub as %s when state sync is enabled",
    async (changedFields, state) => {
      const repository = linkedRepository();
      const githubClient = updateClient();

      const result = await syncWorkItemGithubOwnedFields(
        repository,
        githubClient,
        {
          actorId: "user-1",
          projectId: "project-1",
          workItemId: "work-item-1",
          changedFields,
        }
      );

      expect(result).toEqual({ attempted: true, succeeded: true });
      expect(githubClient.calls[0]).toMatchObject({ input: { state } });
    }
  );

  it("does not write unsupported platform-only fields or arbitrary workflow movement", async () => {
    const repository = linkedRepository();
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(
      repository,
      githubClient,
      {
        actorId: "user-1",
        projectId: "project-1",
        workItemId: "work-item-1",
        changedFields: {
          priority: "high",
          workflowStateId: "state-2",
          stageId: "stage-1",
          planItemId: "plan-1",
          assigneeId: "user-2",
          blockedReason: "Waiting",
        },
      }
    );

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
    [{ syncState: false }, { status: "Done" }],
  ] as const)(
    "does not write when link or field sync disallows it",
    async (linkOverrides, changedFields) => {
      const repository = linkedRepository(linkOverrides);
      const githubClient = updateClient();

      const result = await syncWorkItemGithubOwnedFields(
        repository,
        githubClient,
        {
          actorId: "user-1",
          projectId: "project-1",
          workItemId: "work-item-1",
          changedFields,
        }
      );

      expect(result).toEqual({ attempted: false });
      expect(githubClient.calls).toHaveLength(0);
      expect(repository.createdOperations).toHaveLength(0);
    }
  );

  it("marks operation failed and link error with a sanitized message when GitHub update fails", async () => {
    const repository = linkedRepository();
    const githubClient = {
      calls: [] as unknown[],
      async updateIssue(target: unknown, issueNumber: number, input: unknown) {
        this.calls.push({ target, issueNumber, input });
        throw new Error(
          "GitHub token ghp_secret_1234567890abcdef request failed"
        );
      },
    };

    const result = await syncWorkItemGithubOwnedFields(
      repository,
      githubClient,
      {
        actorId: "user-1",
        projectId: "project-1",
        workItemId: "work-item-1",
        changedFields: { title: "Platform title" },
      }
    );

    expect(result).toEqual({ attempted: true, succeeded: false });
    expect(repository.failedOperations[0]).toMatchObject({
      operationId: "operation-1",
      errorMessage: expect.not.stringContaining("ghp_secret_1234567890abcdef"),
    });
    expect(repository.linkErrors[0]).toMatchObject({
      linkId: "link-1",
      errorMessage: expect.not.stringContaining("ghp_secret_1234567890abcdef"),
    });
    expect(repository.completedOperations).toHaveLength(0);
  });

  it("uses the same operation key for the same link, fields, and GitHub baseline", async () => {
    const firstRepository = linkedRepository();
    const secondRepository = linkedRepository();

    await syncWorkItemGithubOwnedFields(firstRepository, updateClient(), {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields: { title: "Platform title" },
      now: () => new Date("2026-04-28T12:40:00.000Z"),
    });
    await syncWorkItemGithubOwnedFields(secondRepository, updateClient(), {
      actorId: "user-1",
      projectId: "project-1",
      workItemId: "work-item-1",
      changedFields: { title: "Platform title" },
      now: () => new Date("2026-04-28T12:45:00.000Z"),
    });

    expect(firstRepository.createdOperations[0]).toMatchObject({
      operationKey: (
        secondRepository.createdOperations[0] as { operationKey: string }
      ).operationKey,
    });
  });

  it("treats an existing succeeded operation for the same key as idempotent without marking link error", async () => {
    const repository = linkedRepository();
    repository.existingOperationStatus = "succeeded";
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(
      repository,
      githubClient,
      {
        actorId: "user-1",
        projectId: "project-1",
        workItemId: "work-item-1",
        changedFields: { title: "Platform title" },
      }
    );

    expect(result).toEqual({ attempted: true, succeeded: true });
    expect(githubClient.calls).toHaveLength(0);
    expect(repository.linkErrors).toHaveLength(0);
    expect(repository.failedOperations).toHaveLength(0);
    expect(repository.completedOperations).toHaveLength(0);
  });

  it("treats an existing pending operation for the same key as an idempotent no-op", async () => {
    const repository = linkedRepository();
    repository.existingOperationStatus = "pending";
    const githubClient = updateClient();

    const result = await syncWorkItemGithubOwnedFields(
      repository,
      githubClient,
      {
        actorId: "user-1",
        projectId: "project-1",
        workItemId: "work-item-1",
        changedFields: { title: "Platform title" },
      }
    );

    expect(result).toEqual({
      attempted: true,
      succeeded: false,
      pending: true,
    });
    expect(githubClient.calls).toHaveLength(0);
    expect(repository.linkErrors).toHaveLength(0);
    expect(repository.failedOperations).toHaveLength(0);
    expect(repository.completedOperations).toHaveLength(0);
  });
});

describe("importGithubIssuesForProject", () => {
  it("rejects viewer/member roles below admin with WorkspaceError status 403", async () => {
    const repository = new FakeGithubIssueSyncRepository("member");
    const githubClient = client([]);

    await expect(
      importGithubIssuesForProject(
        repository,
        { userId: "user-1" },
        "acme",
        "WEB",
        githubClient
      )
    ).rejects.toMatchObject({
      name: "WorkspaceError",
      status: 403,
    });
  });

  it("requires an existing project GitHub connection", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.connection = null;

    await expect(
      importGithubIssuesForProject(
        repository,
        { userId: "user-1" },
        "acme",
        "WEB",
        client([])
      )
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
            githubUpdatedAt: "2026-04-28T10:30:00.000Z",
          },
        ],
      }),
      issue({
        providerIssueId: "pr-1",
        number: 43,
        title: "Pull request",
        url: "https://github.com/acme/web/pull/43",
        isPullRequest: true,
      }),
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
      failed: 0,
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
        planItemId: null,
      },
      actorId: "user-1",
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
      syncState: true,
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
      updatedAt: now,
    };

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([
        issue({
          title: "Updated title",
          body: "Updated body",
          state: "closed",
        }),
      ])
    );

    expect(summary).toMatchObject({ created: 0, updated: 1 });
    expect(repository.createdWorkItems).toHaveLength(0);
    expect(repository.createdWorkItemsAndLinks).toHaveLength(0);
    expect(repository.updatedWorkItems).toHaveLength(1);
    expect(repository.updatedWorkItems[0]).toMatchObject({
      workItemId: "work-item-1",
      title: "Updated title",
      description: "Updated body",
      status: "Done",
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
      updatedAt: now,
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
              githubUpdatedAt: "2026-04-28T10:10:00.000Z",
            },
          ],
        }),
      ])
    );

    expect(summary).toMatchObject({
      created: 0,
      updated: 0,
      conflicted: 0,
      failed: 0,
    });
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

    expect(summary).toMatchObject({
      created: 0,
      updated: 0,
      conflicted: 0,
      failed: 0,
    });
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
      updatedAt: now,
    };

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([issue()])
    );

    expect(summary).toMatchObject({
      created: 0,
      updated: 0,
      conflicted: 0,
      failed: 0,
    });
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
      updatedAt: now,
    };

    const summary = await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      client([issue()])
    );

    expect(summary).toMatchObject({
      created: 0,
      updated: 0,
      conflicted: 0,
      failed: 0,
    });
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
            githubUpdatedAt: "2026-04-28T10:10:00.000Z",
          },
        ],
      }),
    ]);

    await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      githubClient
    );

    expect(repository.upsertedComments).toEqual([
      {
        githubIssueId: "github-issue-1",
        providerCommentId: "comment-1",
        body: "GitHub comment",
        url: "https://github.com/acme/web/issues/42#issuecomment-1",
        authorLogin: "octocat",
        githubCreatedAt: "2026-04-28T10:05:00.000Z",
        githubUpdatedAt: "2026-04-28T10:10:00.000Z",
      },
    ]);
    expect(repository.localPlatformComments).toHaveLength(0);
  });

  it("passes includeClosed false by default when importClosedIssues is not configured", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    const githubClient = client([]);

    await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      githubClient
    );

    expect(githubClient.calls).toEqual([
      {
        target: {
          owner: "acme",
          name: "web",
          fullName: "acme/web",
          installationId: "installation-1",
        },
        options: {
          includeClosed: false,
        },
      },
    ]);
  });

  it("accepts a null installation id in the snapshot target contract", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    if (repository.connection) {
      repository.connection.repository.installationId = null;
    }
    const githubClient = client([]);

    await importGithubIssuesForProject(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      githubClient
    );

    expect(githubClient.calls).toEqual([
      {
        target: {
          owner: "acme",
          name: "web",
          fullName: "acme/web",
          installationId: null,
        },
        options: {
          includeClosed: false,
        },
      },
    ]);
  });
});

describe("updateProjectGithubIssueSyncSettings", () => {
  it("requires admin access and persists project issue sync settings", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");
    repository.workflowStates = [
      ...repository.workflowStates,
      {
        id: "closed-state-1",
        projectId: "project-1",
        name: "Closed",
        category: "done",
        position: 1,
        color: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const settings = await updateProjectGithubIssueSyncSettings(
      repository,
      { userId: "user-1" },
      "acme",
      "WEB",
      {
        issueSyncEnabled: true,
        importClosedIssues: true,
        syncTitle: true,
        syncBody: false,
        syncState: true,
        closedWorkflowStateId: "closed-state-1",
        reopenedWorkflowStateId: null,
      }
    );

    expect(settings).toEqual({
      syncEnabled: true,
      importClosedIssues: true,
      syncTitle: true,
      syncBody: false,
      syncState: true,
      closedWorkflowStateId: "closed-state-1",
      reopenedWorkflowStateId: null,
    });
    expect(repository.settingsUpdates).toEqual([
      {
        projectId: "project-1",
        settings,
      },
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
    ...overrides,
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
    ...overrides,
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
      state: "open",
    });
    expect(repository.createdWorkItemsAndLinks).toHaveLength(1);
    expect(repository.createdWorkItemsAndLinks[0]).toMatchObject({
      workItem: {
        title: "GitHub issue",
        description: "GitHub issue body",
        status: "Todo",
      },
      link: {
        repositoryId: "repository-1",
        githubIssueId: "github-1001",
        source: "github_issue_webhook",
        syncStatus: "synced",
      },
    });
  });

  it("ignores issues payloads that represent pull requests", async () => {
    const repository = new FakeGithubIssueSyncRepository("admin");

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issues",
      {
        action: "opened",
        issue: githubIssuePayload({
          pull_request: { html_url: "https://github.com/acme/web/pull/42" },
        }),
      },
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
      lastSyncedTitleHash:
        "57f44bd39f117b9eda3418ac243c0ec12dd2f8431a96a79783c9a36ac67a43fe",
      lastSyncedBodyHash: null,
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
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
      updatedAt: "2026-04-28T10:30:00.000Z",
    };

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issues",
      {
        action: "edited",
        issue: githubIssuePayload({ title: "Changed on GitHub" }),
      },
      now
    );

    expect(result).toEqual({ ignored: false });
    expect(repository.updatedWorkItems).toHaveLength(0);
    expect(repository.upsertedLinks).toHaveLength(1);
    expect(repository.upsertedLinks[0]).toMatchObject({
      workItemId: "work-item-1",
      syncStatus: "conflict",
      conflictFields: ["title"],
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
      updatedAt: now,
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
      updatedAt: "2026-04-28T10:30:00.000Z",
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
      lastSyncedTitleHash:
        "7d94e2e7acad3b70eb76f83fbf6ce2314194503e524d5bc054df0bad880cd0eb",
      lastSyncedBodyHash:
        "3a370c18db71cdf372040daee6c8e55ddeb6719af5b2c9816d32863b9546ac26",
      lastSyncedState: "open",
      conflictFields: null,
      errorMessage: null,
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
      updatedAt: now,
    };

    await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "created",
        issue: githubIssuePayload(),
        comment: githubIssueCommentPayload(),
      },
      now
    );
    await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "edited",
        issue: githubIssuePayload(),
        comment: githubIssueCommentPayload({ body: "Edited GitHub comment" }),
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
        githubUpdatedAt: "2026-04-28T11:10:00.000Z",
      },
      {
        githubIssueId: "github-1001",
        providerCommentId: "9001",
        body: "Edited GitHub comment",
        url: "https://github.com/acme/web/issues/42#issuecomment-9001",
        authorLogin: "mona",
        githubCreatedAt: "2026-04-28T11:05:00.000Z",
        githubUpdatedAt: "2026-04-28T11:10:00.000Z",
      },
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
      updatedAt: now,
    };

    const result = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "deleted",
        issue: githubIssuePayload(),
        comment: githubIssueCommentPayload(),
      },
      now
    );

    expect(result).toEqual({ ignored: false });
    expect(repository.deletedComments).toEqual([
      {
        githubIssueId: "github-1001",
        providerCommentId: "9001",
        githubDeletedAt: now,
      },
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
        issue: githubIssuePayload({
          pull_request: { html_url: "https://github.com/acme/web/pull/42" },
        }),
        comment: githubIssueCommentPayload(),
      },
      now
    );

    expect(result).toEqual({
      ignored: true,
      reason: "pull_request_issue_comment",
    });
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
      updatedAt: now,
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
      updatedAt: now,
    };

    const createdResult = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "created",
        issue: githubIssuePayload({
          pull_request: { html_url: "https://github.com/acme/web/pull/42" },
        }),
        comment: githubIssueCommentPayload(),
      },
      now
    );
    const deletedResult = await projectGithubIssueWebhookEvent(
      repository,
      repository.connection!.repository,
      "issue_comment",
      {
        action: "deleted",
        issue: githubIssuePayload({
          pull_request: { html_url: "https://github.com/acme/web/pull/42" },
        }),
        comment: githubIssueCommentPayload(),
      },
      now
    );

    expect(createdResult).toEqual({
      ignored: true,
      reason: "pull_request_issue_comment",
    });
    expect(deletedResult).toEqual({
      ignored: true,
      reason: "pull_request_issue_comment",
    });
    expect(repository.upsertedComments).toHaveLength(0);
    expect(repository.deletedComments).toHaveLength(0);
    expect(repository.localPlatformComments).toHaveLength(0);
  });
});

describe("syncGithubWebhookRequest issue events", () => {
  it.each(["issues", "issue_comment"] as const)(
    "accepts %s as a supported event name",
    async (eventName) => {
      const repository = new FakeGithubIssueSyncRepository("admin");
      const request = new Request("https://example.test/api/webhooks/github", {
        method: "POST",
        headers: {
          "x-github-event": eventName,
          "x-github-delivery": `delivery-${eventName}`,
          "x-hub-signature-256": "sha256=test",
        },
        body: JSON.stringify({
          repository: {
            id: "repo-1",
          },
          issue: githubIssuePayload(),
        }),
      });
      const deliveries: string[] = [];

      const response = await syncGithubWebhookRequest(repository, request, {
        secret: "secret",
        verifySignature: () => true,
        now: () => new Date(now),
        processDelivery: async ({ eventName: processedEventName }) => {
          deliveries.push(processedEventName);
        },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ processed: true });
      expect(deliveries).toEqual([eventName]);
    }
  );
});
