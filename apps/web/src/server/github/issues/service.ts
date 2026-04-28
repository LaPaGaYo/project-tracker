import { createHash, createSign } from "node:crypto";

import type { GithubIssueState, TaskStatus, WorkflowStateRecord } from "@the-platform/shared";

import { resolveWorkspaceContext } from "../../work-management/utils";
import { WorkspaceError } from "../../workspaces/core";
import type { AppSession } from "../../workspaces/types";

import { normalizeGithubIssueCommentPayload, normalizeGithubIssuePayload } from "./parsers";
import type {
  GithubIssueImportClient,
  GithubIssueImportTarget,
  GithubIssueLinkRecord,
  GithubIssueProjectionRecord,
  GithubIssueSyncRepository,
  GithubIssueSyncSettings,
  GithubIssueUpdateClient,
  GithubIssueUpdateInput,
  GithubIssueWithComments,
  ImportGithubIssuesSummary,
  ProjectGithubConnectionWithRepository
} from "./types";

const defaultGithubIssueSyncSettings: GithubIssueSyncSettings = {
  syncEnabled: false,
  importClosedIssues: false,
  syncTitle: true,
  syncBody: true,
  syncState: true,
  closedWorkflowStateId: null,
  reopenedWorkflowStateId: null
};

function hashBaseline(value: string | null) {
  return createHash("sha256").update(value ?? "").digest("hex");
}

function readNonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeApiBaseUrl(baseUrl: string | undefined) {
  return (baseUrl ?? "https://api.github.com").replace(/\/+$/, "");
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createGithubAppJwt(input: { appId: string; privateKey: string; now: Date }) {
  const issuedAt = Math.floor(input.now.getTime() / 1000) - 60;
  const unsigned = [
    base64UrlJson({ alg: "RS256", typ: "JWT" }),
    base64UrlJson({ iat: issuedAt, exp: issuedAt + 9 * 60, iss: input.appId })
  ].join(".");
  const signature = createSign("RSA-SHA256").update(unsigned).sign(input.privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

function privateKeyFromEnv(env: Record<string, string | undefined>) {
  const privateKey = readNonEmpty(env.GITHUB_APP_PRIVATE_KEY);
  if (privateKey) {
    return privateKey.replace(/\\n/g, "\n");
  }

  const base64PrivateKey = readNonEmpty(env.GITHUB_APP_PRIVATE_KEY_BASE64);
  return base64PrivateKey ? Buffer.from(base64PrivateKey, "base64").toString("utf8") : undefined;
}

async function mintInstallationToken(input: {
  installationId: string;
  apiBaseUrl: string;
  appId: string;
  privateKey: string;
  fetchImpl: typeof fetch;
  now: Date;
}) {
  const jwt = createGithubAppJwt({ appId: input.appId, privateKey: input.privateKey, now: input.now });
  const response = await input.fetchImpl(
    `${input.apiBaseUrl}/app/installations/${encodeURIComponent(input.installationId)}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "x-github-api-version": "2022-11-28"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub App installation token request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error("GitHub App installation token response was incomplete.");
  }

  return body.token;
}

export function createGithubIssuesClient(options?: {
  appId?: string | undefined;
  privateKey?: string | undefined;
  privateKeyBase64?: string | undefined;
  apiBaseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
  env?: Record<string, string | undefined> | undefined;
  now?: (() => Date) | undefined;
}): GithubIssueUpdateClient {
  const env = options?.env ?? process.env;
  const appId = readNonEmpty(options?.appId) ?? readNonEmpty(env.GITHUB_APP_ID);
  const privateKey =
    readNonEmpty(options?.privateKey)?.replace(/\\n/g, "\n") ??
    (options?.privateKeyBase64 ? Buffer.from(options.privateKeyBase64, "base64").toString("utf8") : undefined) ??
    privateKeyFromEnv(env);
  const apiBaseUrl = normalizeApiBaseUrl(options?.apiBaseUrl ?? env.GITHUB_API_BASE_URL);
  const fetchImpl = options?.fetch ?? fetch;
  const now = options?.now ?? (() => new Date());

  return {
    async updateIssue(target, issueNumber, input) {
      if (!target.installationId) {
        throw new Error("GitHub installation id is required to update issues.");
      }
      if (!appId || !privateKey) {
        throw new Error("GitHub App credentials are required to update issues.");
      }

      const token = await mintInstallationToken({
        installationId: target.installationId,
        apiBaseUrl,
        appId,
        privateKey,
        fetchImpl,
        now: now()
      });
      const response = await fetchImpl(
        `${apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/issues/${issueNumber}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-github-api-version": "2022-11-28"
          },
          body: JSON.stringify(input)
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub issue update failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const issue = normalizeGithubIssuePayload(payload, now().toISOString());
      if (!issue) {
        throw new Error("GitHub issue update response was incomplete.");
      }

      return { ...issue, comments: [] };
    }
  };
}

function statusFromGithubState(state: GithubIssueState): TaskStatus {
  return state === "closed" ? "Done" : "Todo";
}

function completedAtFromGithubIssue(issue: GithubIssueWithComments) {
  if (issue.state !== "closed") {
    return null;
  }

  return issue.githubClosedAt ?? issue.githubUpdatedAt;
}

function firstBacklogState(states: WorkflowStateRecord[]) {
  return states.find((state) => state.category === "backlog")?.id ?? null;
}

function workflowStateForUpdate(issue: GithubIssueWithComments, settings: GithubIssueSyncSettings) {
  if (issue.state === "closed") {
    return settings.closedWorkflowStateId ?? undefined;
  }

  return settings.reopenedWorkflowStateId ?? undefined;
}

function workItemGithubState(status: TaskStatus): GithubIssueWithComments["state"] {
  return status === "Done" ? "closed" : "open";
}

function sanitizeGithubError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

function outboundGithubState(changedFields: Record<string, unknown>) {
  if (changedFields.state === "open" || changedFields.state === "closed") {
    return changedFields.state;
  }

  if (changedFields.status !== undefined) {
    return changedFields.status === "Done" ? "closed" : "open";
  }

  if (Object.hasOwn(changedFields, "completedAt")) {
    return changedFields.completedAt ? "closed" : "open";
  }

  return undefined;
}

function buildGithubIssueUpdate(link: GithubIssueLinkRecord, changedFields: Record<string, unknown>): GithubIssueUpdateInput {
  const update: GithubIssueUpdateInput = {};

  if (link.syncTitle && typeof changedFields.title === "string") {
    update.title = changedFields.title;
  }

  const body = Object.hasOwn(changedFields, "body") ? changedFields.body : changedFields.description;
  if (link.syncBody && (typeof body === "string" || body === null)) {
    update.body = body;
  }

  const state = outboundGithubState(changedFields);
  if (link.syncState && state) {
    update.state = state;
  }

  return update;
}

function stableOperationKey(input: {
  linkId: string;
  targetFields: GithubIssueUpdateInput;
  githubUpdatedAtBefore: string | null;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        linkId: input.linkId,
        targetFields: Object.fromEntries(Object.entries(input.targetFields).sort(([left], [right]) => left.localeCompare(right))),
        githubUpdatedAtBefore: input.githubUpdatedAtBefore
      })
    )
    .digest("hex");
}

function shouldSkipLinkedWorkItemUpdate(link: GithubIssueLinkRecord) {
  return !link.syncEnabled || link.syncStatus === "conflict" || link.syncStatus === "paused" || link.syncStatus === "error";
}

function hasWorkItemUpdatePatch(input: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0]) {
  return (
    input.title !== undefined ||
    input.description !== undefined ||
    input.status !== undefined ||
    input.workflowStateId !== undefined ||
    input.completedAt !== undefined
  );
}

async function upsertComments(
  repository: GithubIssueSyncRepository,
  githubIssueId: string,
  comments: GithubIssueWithComments["comments"]
) {
  for (const comment of comments) {
    await repository.upsertGithubIssueComment({
      githubIssueId,
      providerCommentId: comment.providerCommentId,
      body: comment.body,
      url: comment.url,
      authorLogin: comment.authorLogin,
      githubCreatedAt: comment.githubCreatedAt,
      githubUpdatedAt: comment.githubUpdatedAt
    });
  }
}

export async function syncWorkItemGithubOwnedFields(
  repository: GithubIssueSyncRepository,
  client: GithubIssueUpdateClient,
  input: {
    actorId: string;
    projectId: string;
    workItemId: string;
    changedFields: Record<string, unknown>;
    now?: () => Date;
  }
): Promise<{ attempted: false } | { attempted: true; succeeded: boolean }> {
  if (!repository.getGithubIssueLinkForWorkItem) {
    return { attempted: false };
  }

  const linked = await repository.getGithubIssueLinkForWorkItem(input.workItemId);
  if (!linked || linked.issue.repositoryId !== linked.repository.id) {
    return { attempted: false };
  }

  if (linked.link.syncStatus !== "synced" || !linked.link.syncEnabled) {
    return { attempted: false };
  }

  const patch = buildGithubIssueUpdate(linked.link, input.changedFields);
  const fields = Object.keys(patch).sort();
  if (fields.length === 0) {
    return { attempted: false };
  }

  if (
    !repository.createGithubIssueSyncOperation ||
    !repository.completeGithubIssueSyncOperation ||
    !repository.failGithubIssueSyncOperation ||
    !repository.markGithubIssueLinkError ||
    !repository.updateIssueProjectionFromOutbound ||
    !repository.updateGithubIssueLinkBaseline
  ) {
    return { attempted: false };
  }

  const operation = await repository.createGithubIssueSyncOperation({
    linkId: linked.link.id,
    operationKey: stableOperationKey({
      linkId: linked.link.id,
      targetFields: patch,
      githubUpdatedAtBefore: linked.issue.githubUpdatedAt
    }),
    operationType: "update_issue",
    status: "pending",
    requestedBy: input.actorId,
    githubUpdatedAtBefore: linked.issue.githubUpdatedAt,
    targetFields: { ...patch }
  });

  const target: GithubIssueImportTarget = {
    owner: linked.repository.owner,
    name: linked.repository.name,
    fullName: linked.repository.fullName,
    installationId: linked.repository.installationId
  };

  try {
    const issue = await client.updateIssue(target, linked.issue.number, patch);
    await repository.updateIssueProjectionFromOutbound({
      githubIssueId: linked.issue.id,
      issue
    });
    await repository.updateGithubIssueLinkBaseline({
      linkId: linked.link.id,
      issue
    });
    await repository.completeGithubIssueSyncOperation({ operationId: operation.id });
    return { attempted: true, succeeded: true };
  } catch (error) {
    const errorMessage = sanitizeGithubError(error);
    await repository.failGithubIssueSyncOperation({ operationId: operation.id, errorMessage });
    await repository.markGithubIssueLinkError({ linkId: linked.link.id, errorMessage });
    return { attempted: true, succeeded: false };
  }
}

async function upsertSyncedLink(
  repository: GithubIssueSyncRepository,
  input: {
    link: GithubIssueLinkRecord | null;
    workItemId: string;
    repositoryId: string;
    githubIssueId: string;
    issue: GithubIssueWithComments;
    settings: GithubIssueSyncSettings;
    source: string;
    lastSyncedWorkItemUpdatedAt: string | null;
  }
) {
  await repository.upsertGithubIssueLink({
    workItemId: input.workItemId,
    repositoryId: input.repositoryId,
    githubIssueId: input.githubIssueId,
    source: input.link?.source ?? input.source,
    syncStatus: "synced",
    syncEnabled: input.link?.syncEnabled ?? input.settings.syncEnabled,
    syncTitle: input.link?.syncTitle ?? input.settings.syncTitle,
    syncBody: input.link?.syncBody ?? input.settings.syncBody,
    syncState: input.link?.syncState ?? input.settings.syncState,
    lastSyncedGithubUpdatedAt: input.issue.githubUpdatedAt,
    lastSyncedWorkItemUpdatedAt: input.lastSyncedWorkItemUpdatedAt,
    lastSyncedTitleHash: hashBaseline(input.issue.title),
    lastSyncedBodyHash: hashBaseline(input.issue.body),
    lastSyncedState: input.issue.state,
    conflictFields: null,
    errorMessage: null
  });
}

async function applyLinkedWorkItemIssueSync(
  repository: GithubIssueSyncRepository,
  input: {
    link: GithubIssueLinkRecord;
    projectId: string;
    workspaceId: string;
    repositoryId: string;
    githubIssueId: string;
    issue: GithubIssueWithComments;
    settings: GithubIssueSyncSettings;
    actorId: string;
  }
) {
  if (shouldSkipLinkedWorkItemUpdate(input.link)) {
    return { conflicted: input.link.syncStatus === "conflict", updated: false, failed: false };
  }

  const workItem = repository.getWorkItemForGithubIssueLink
    ? await repository.getWorkItemForGithubIssueLink(input.link.workItemId)
    : null;
  if (!workItem) {
    return { conflicted: false, updated: false, failed: true };
  }

  const conflictFields: string[] = [];
  const syncTitle = input.settings.syncTitle && input.link.syncTitle;
  const syncBody = input.settings.syncBody && input.link.syncBody;
  const syncState = input.settings.syncState && input.link.syncState;

  if (
    syncTitle &&
    input.link.lastSyncedTitleHash &&
    hashBaseline(workItem.title) !== input.link.lastSyncedTitleHash &&
    hashBaseline(input.issue.title) !== input.link.lastSyncedTitleHash &&
    workItem.title !== input.issue.title
  ) {
    conflictFields.push("title");
  }

  if (
    syncBody &&
    input.link.lastSyncedBodyHash &&
    hashBaseline(workItem.description) !== input.link.lastSyncedBodyHash &&
    hashBaseline(input.issue.body) !== input.link.lastSyncedBodyHash &&
    workItem.description !== (input.issue.body ?? "")
  ) {
    conflictFields.push("body");
  }

  if (
    syncState &&
    input.link.lastSyncedState &&
    workItemGithubState(workItem.status) !== input.link.lastSyncedState &&
    input.issue.state !== input.link.lastSyncedState &&
    workItemGithubState(workItem.status) !== input.issue.state
  ) {
    conflictFields.push("state");
  }

  if (conflictFields.length > 0) {
    await repository.upsertGithubIssueLink({
      workItemId: input.link.workItemId,
      repositoryId: input.repositoryId,
      githubIssueId: input.githubIssueId,
      source: input.link.source,
      syncStatus: "conflict",
      syncEnabled: input.link.syncEnabled,
      syncTitle: input.link.syncTitle,
      syncBody: input.link.syncBody,
      syncState: input.link.syncState,
      lastSyncedGithubUpdatedAt: input.link.lastSyncedGithubUpdatedAt,
      lastSyncedWorkItemUpdatedAt: input.link.lastSyncedWorkItemUpdatedAt,
      lastSyncedTitleHash: input.link.lastSyncedTitleHash,
      lastSyncedBodyHash: input.link.lastSyncedBodyHash,
      lastSyncedState: input.link.lastSyncedState,
      conflictFields,
      errorMessage: null
    });
    return { conflicted: true, updated: false, failed: false };
  }

  const updateInput: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0] = {
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    workItemId: input.link.workItemId,
    actorId: input.actorId
  };
  if (syncTitle) {
    updateInput.title = input.issue.title;
  }
  if (syncBody) {
    updateInput.description = input.issue.body ?? "";
  }
  if (syncState) {
    updateInput.status = statusFromGithubState(input.issue.state);
    updateInput.completedAt = completedAtFromGithubIssue(input.issue);
    const workflowStateId = workflowStateForUpdate(input.issue, input.settings);
    if (workflowStateId !== undefined) {
      updateInput.workflowStateId = workflowStateId;
    }
  }

  if (!hasWorkItemUpdatePatch(updateInput)) {
    return { conflicted: false, updated: false, failed: false };
  }

  const updateResult = await repository.updateWorkItemFromGithubIssue(updateInput);
  if (!updateResult) {
    return { conflicted: false, updated: false, failed: true };
  }

  await upsertSyncedLink(repository, {
    link: input.link,
    workItemId: input.link.workItemId,
    repositoryId: input.repositoryId,
    githubIssueId: input.githubIssueId,
    issue: input.issue,
    settings: input.settings,
    source: input.link.source,
    lastSyncedWorkItemUpdatedAt: updateResult.workItem.updatedAt
  });

  return { conflicted: false, updated: updateResult.changed, failed: false };
}

async function createOrFindLinkedWorkItemForIssue(
  repository: GithubIssueSyncRepository,
  input: {
    connection: ProjectGithubConnectionWithRepository | null;
    projection: GithubIssueProjectionRecord;
    issue: GithubIssueWithComments;
    settings: GithubIssueSyncSettings;
    workflowStates: Awaited<ReturnType<GithubIssueSyncRepository["listWorkflowStates"]>>;
    actorId: string;
  }
) {
  if (!input.connection) {
    return;
  }

  await repository.createWorkItemAndLinkGithubIssue({
    projectId: input.connection.connection.projectId,
    workspaceId: input.connection.repository.workspaceId,
    workItem: {
      title: input.issue.title,
      description: input.issue.body ?? "",
      type: "task",
      priority: "none",
      status: statusFromGithubState(input.issue.state),
      workflowStateId: firstBacklogState(input.workflowStates),
      stageId: null,
      planItemId: null,
      position: 0,
      completedAt: completedAtFromGithubIssue(input.issue)
    },
    link: {
      repositoryId: input.connection.repository.id,
      githubIssueId: input.projection.id,
      source: "github_issue_webhook",
      syncStatus: "synced",
      syncEnabled: input.settings.syncEnabled,
      syncTitle: input.settings.syncTitle,
      syncBody: input.settings.syncBody,
      syncState: input.settings.syncState,
      lastSyncedGithubUpdatedAt: input.issue.githubUpdatedAt,
      lastSyncedTitleHash: hashBaseline(input.issue.title),
      lastSyncedBodyHash: hashBaseline(input.issue.body),
      lastSyncedState: input.issue.state,
      conflictFields: null,
      errorMessage: null
    },
    actorId: input.actorId
  });
}

export async function projectGithubIssueWebhookEvent(
  repository: GithubIssueSyncRepository,
  githubRepository: { id: string },
  eventName: "issues" | "issue_comment",
  payload: Record<string, unknown>,
  receivedAt: string
): Promise<{ ignored: boolean; reason?: string }> {
  const issue = normalizeGithubIssuePayload(payload.issue, receivedAt);
  if (!issue) {
    return { ignored: true, reason: "invalid_issue" };
  }

  if (issue.isPullRequest && eventName === "issues") {
    return {
      ignored: true,
      reason: "pull_request_issue"
    };
  }

  if (issue.isPullRequest) {
    return { ignored: true, reason: "pull_request_issue_comment" };
  }

  const connection = repository.getProjectGithubConnectionByRepositoryId
    ? await repository.getProjectGithubConnectionByRepositoryId(githubRepository.id)
    : null;
  if (!connection) {
    return { ignored: true, reason: "repository_not_connected" };
  }

  const settings = {
    ...defaultGithubIssueSyncSettings,
    ...((await repository.getGithubIssueSyncSettings(connection.connection.projectId)) ?? {})
  };
  const issueWithComments: GithubIssueWithComments = { ...issue, comments: [] };
  const projection = await repository.upsertGithubIssue({
    repositoryId: githubRepository.id,
    providerIssueId: issue.providerIssueId,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    url: issue.url,
    state: issue.state,
    authorLogin: issue.authorLogin,
    githubCreatedAt: issue.githubCreatedAt,
    githubUpdatedAt: issue.githubUpdatedAt,
    githubClosedAt: issue.githubClosedAt
  });
  const link = await repository.getGithubIssueLinkByIssueId(projection.id);

  if (eventName === "issues") {
    if (link) {
      await applyLinkedWorkItemIssueSync(repository, {
        link,
        projectId: connection.connection.projectId,
        workspaceId: connection.repository.workspaceId,
        repositoryId: githubRepository.id,
        githubIssueId: projection.id,
        issue: issueWithComments,
        settings,
        actorId: "github-webhook"
      });
    } else {
      await createOrFindLinkedWorkItemForIssue(repository, {
        connection,
        projection,
        issue: issueWithComments,
        settings,
        workflowStates: await repository.listWorkflowStates(connection.connection.projectId),
        actorId: "github-webhook"
      });
    }

    return { ignored: false };
  }

  const comment = normalizeGithubIssueCommentPayload(payload.comment, receivedAt);
  if (!comment) {
    return { ignored: true, reason: "invalid_comment" };
  }

  if (payload.action === "deleted") {
    if (!repository.markGithubIssueCommentDeleted) {
      return { ignored: true, reason: "comment_delete_not_supported" };
    }
    await repository.markGithubIssueCommentDeleted({
      githubIssueId: projection.id,
      providerCommentId: comment.providerCommentId,
      githubDeletedAt: receivedAt
    });
    return { ignored: false };
  }

  if (payload.action !== "created" && payload.action !== "edited") {
    return { ignored: true, reason: "unsupported_comment_action" };
  }

  await repository.upsertGithubIssueComment({
    githubIssueId: projection.id,
    providerCommentId: comment.providerCommentId,
    body: comment.body,
    url: comment.url,
    authorLogin: comment.authorLogin,
    githubCreatedAt: comment.githubCreatedAt,
    githubUpdatedAt: comment.githubUpdatedAt
  });

  return { ignored: false };
}

export async function importGithubIssuesForProject(
  repository: GithubIssueSyncRepository,
  session: { userId: string },
  workspaceSlug: string,
  projectKey: string,
  client: GithubIssueImportClient,
  options?: { settings?: Partial<GithubIssueSyncSettings> }
): Promise<ImportGithubIssuesSummary> {
  const { workspace } = await resolveWorkspaceContext(repository, session as AppSession, workspaceSlug, "admin");
  const project = await repository.getProjectByKey(workspace.id, projectKey);
  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  const connection = await repository.getProjectGithubConnection(project.id);
  if (!connection) {
    throw new WorkspaceError(409, "project GitHub connection is required before importing issues.");
  }

  const storedSettings = await repository.getGithubIssueSyncSettings(project.id);
  const settings = {
    ...defaultGithubIssueSyncSettings,
    ...(storedSettings ?? {}),
    ...(options?.settings ?? {})
  };
  const workflowStates = await repository.listWorkflowStates(project.id);
  const snapshot = await client.getRepositoryIssuesSnapshot(
    {
      owner: connection.repository.owner,
      name: connection.repository.name,
      fullName: connection.repository.fullName,
      installationId: connection.repository.installationId
    },
    { includeClosed: settings.importClosedIssues }
  );
  const issues = snapshot.issues;

  const summary: ImportGithubIssuesSummary = {
    created: 0,
    updated: 0,
    skippedPullRequests: 0,
    conflicted: 0,
    failed: 0
  };

  for (const issue of issues) {
    if (issue.isPullRequest) {
      summary.skippedPullRequests += 1;
      continue;
    }

    try {
      const projection = await repository.upsertGithubIssue({
        repositoryId: connection.repository.id,
        providerIssueId: issue.providerIssueId,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        url: issue.url,
        state: issue.state,
        authorLogin: issue.authorLogin,
        githubCreatedAt: issue.githubCreatedAt,
        githubUpdatedAt: issue.githubUpdatedAt,
        githubClosedAt: issue.githubClosedAt
      });
      const link = await repository.getGithubIssueLinkByIssueId(projection.id);

      if (link) {
        if (shouldSkipLinkedWorkItemUpdate(link)) {
          if (link.syncStatus === "conflict") {
            summary.conflicted += 1;
          }
          await upsertComments(repository, projection.id, issue.comments);
          continue;
        }

        const updateInput: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0] = {
          projectId: project.id,
          workspaceId: workspace.id,
          workItemId: link.workItemId,
          actorId: session.userId
        };
        if (settings.syncTitle && link.syncTitle) {
          updateInput.title = issue.title;
        }
        if (settings.syncBody && link.syncBody) {
          updateInput.description = issue.body ?? "";
        }
        if (settings.syncState && link.syncState) {
          updateInput.status = statusFromGithubState(issue.state);
          updateInput.completedAt = completedAtFromGithubIssue(issue);
          const workflowStateId = workflowStateForUpdate(issue, settings);
          if (workflowStateId !== undefined) {
            updateInput.workflowStateId = workflowStateId;
          }
        }

        if (!hasWorkItemUpdatePatch(updateInput)) {
          await upsertComments(repository, projection.id, issue.comments);
          continue;
        }

        const updateResult = await repository.updateWorkItemFromGithubIssue(updateInput);

        if (updateResult?.changed) {
          await upsertSyncedLink(repository, {
            link,
            workItemId: link.workItemId,
            repositoryId: connection.repository.id,
            githubIssueId: projection.id,
            issue,
            settings,
            source: "initial_import",
            lastSyncedWorkItemUpdatedAt: updateResult.workItem.updatedAt
          });
          summary.updated += 1;
        } else if (!updateResult) {
          summary.failed += 1;
        }
      } else {
        const createResult = await repository.createWorkItemAndLinkGithubIssue({
          projectId: project.id,
          workspaceId: workspace.id,
          workItem: {
            title: issue.title,
            description: issue.body ?? "",
            type: "task",
            priority: "none",
            status: statusFromGithubState(issue.state),
            workflowStateId: firstBacklogState(workflowStates),
            stageId: null,
            planItemId: null,
            position: 0,
            completedAt: completedAtFromGithubIssue(issue)
          },
          link: {
            repositoryId: connection.repository.id,
            githubIssueId: projection.id,
            source: "initial_import",
            syncStatus: "synced",
            syncEnabled: settings.syncEnabled,
            syncTitle: settings.syncTitle,
            syncBody: settings.syncBody,
            syncState: settings.syncState,
            lastSyncedGithubUpdatedAt: issue.githubUpdatedAt,
            lastSyncedTitleHash: hashBaseline(issue.title),
            lastSyncedBodyHash: hashBaseline(issue.body),
            lastSyncedState: issue.state,
            conflictFields: null,
            errorMessage: null
          },
          actorId: session.userId
        });
        if (createResult.created) {
          summary.created += 1;
        }
      }

      await upsertComments(repository, projection.id, issue.comments);
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
