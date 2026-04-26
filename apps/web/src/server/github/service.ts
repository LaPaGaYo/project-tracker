import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubPullRequestState,
  GithubRepositoryRecord,
  GithubWebhookEventName
} from "@the-platform/shared";

import { createNotificationForWorkspace } from "../notifications/service";
import type { NotificationRecipientInput, NotificationRepository } from "../notifications/types";
import { WorkspaceError } from "../workspaces/core";
import {
  normalizeOptionalString,
  requireNonEmptyString,
  requireRoleAtLeast,
  resolveWorkspaceContext
} from "../work-management/utils";

import type { AppSession } from "../workspaces/types";

import type {
  CreateProjectGithubConnectionInput,
  GithubConnectionRepository,
  GithubNotificationDependencies,
  GithubNotificationTarget,
  GithubWebhookRepository,
  ProjectGithubConnectionView
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRequiredString(value: unknown) {
  const normalized = readOptionalString(value);
  return normalized ?? null;
}

function readRequiredNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readRequiredIdentifier(value: unknown) {
  const numeric = readRequiredNumber(value);
  if (numeric !== null) {
    return `${numeric}`;
  }

  return readRequiredString(value);
}

function readIsoString(value: unknown, fallback: string) {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return fallback;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function extractIdentifiers(value: string | null) {
  if (!value) {
    return [];
  }

  return Array.from(new Set(value.toUpperCase().match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []));
}

function uniqueRecipients(recipients: NotificationRecipientInput[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const key = `${recipient.recipientId}:${recipient.reason}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function githubTargetRecipients(
  notificationRepository: NotificationRepository,
  target: GithubNotificationTarget
) {
  const participants = await notificationRepository.getWorkItemParticipants(target.workItemId);

  return uniqueRecipients([
    ...(target.assigneeId
      ? [
          {
            recipientId: target.assigneeId,
            reason: "assigned" as const
          }
        ]
      : []),
    ...participants
      .filter((participantId) => participantId !== target.assigneeId)
      .map(
        (participantId): NotificationRecipientInput => ({
          recipientId: participantId,
          reason: "participant"
        })
      )
  ]);
}

function githubTargetUrl(target: GithubNotificationTarget) {
  return `/workspaces/${target.workspaceSlug}/projects/${target.projectKey}/items/${target.workItemIdentifier ?? target.workItemId}`;
}

function normalizeFullName(owner: string, name: string, fullName: unknown) {
  return normalizeOptionalString(fullName) ?? `${owner}/${name}`;
}

function translateConnectionError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "project already has a primary GitHub repository.") {
      throw new WorkspaceError(409, error.message);
    }

    if (error.message === "repository is already connected to another project.") {
      throw new WorkspaceError(409, error.message);
    }
  }

  throw error;
}

async function resolveProjectContext(
  repository: GithubConnectionRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { workspace, membership } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");
  const project = await repository.getProjectByKey(workspace.id, projectKey);

  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  return {
    workspace,
    membership,
    project
  };
}

function parsePullRequestState(pullRequest: Record<string, unknown>): GithubPullRequestState {
  const rawState = readOptionalString(pullRequest.state);
  const mergedAt = readOptionalString(pullRequest.merged_at);
  const merged = pullRequest.merged === true || Boolean(mergedAt);

  if (merged) {
    return "merged";
  }

  return rawState === "closed" ? "closed" : "open";
}

function parsePullRequestWebhookEvent(payload: Record<string, unknown>, fallbackTimestamp: string) {
  const pullRequest = isRecord(payload.pull_request) ? payload.pull_request : null;
  if (!pullRequest) {
    return null;
  }

  const providerPullRequestId = readRequiredIdentifier(pullRequest.id);
  const number = readRequiredNumber(pullRequest.number);
  const title = readRequiredString(pullRequest.title);
  const url = readRequiredString(pullRequest.html_url);
  const base = isRecord(pullRequest.base) ? pullRequest.base : null;
  const head = isRecord(pullRequest.head) ? pullRequest.head : null;
  const baseBranch = readRequiredString(base?.ref);
  const headBranch = readRequiredString(head?.ref);
  const headSha = readRequiredString(head?.sha);

  if (!providerPullRequestId || number === null || !title || !url || !baseBranch || !headBranch || !headSha) {
    return null;
  }

  const body = readOptionalString(pullRequest.body);

  return {
    action: readOptionalString(payload.action),
    providerPullRequestId,
    number,
    title,
    body,
    url,
    state: parsePullRequestState(pullRequest),
    isDraft: pullRequest.draft === true,
    authorLogin: isRecord(pullRequest.user) ? readOptionalString(pullRequest.user.login) : null,
    baseBranch,
    headBranch,
    headSha,
    createdAt: readIsoString(pullRequest.created_at, fallbackTimestamp),
    updatedAt: readIsoString(pullRequest.updated_at, fallbackTimestamp),
    mergedAt: readOptionalString(pullRequest.merged_at),
    closedAt: readOptionalString(pullRequest.closed_at),
    titleIdentifiers: extractIdentifiers(title),
    bodyIdentifiers: extractIdentifiers(body),
    branchIdentifiers: extractIdentifiers(headBranch)
  };
}

function githubPullRequestNotificationKind(event: ReturnType<typeof parsePullRequestWebhookEvent>) {
  if (!event) {
    return null;
  }

  if (event.action === "review_requested") {
    return "review_requested";
  }

  if (event.state === "merged") {
    return "merged";
  }

  if (event.state === "closed") {
    return "closed";
  }

  if (event.state === "open" && (event.action === "opened" || event.action === "reopened" || event.action === "ready_for_review")) {
    return "open";
  }

  return null;
}

function githubPullRequestNotificationTitle(kind: string, event: NonNullable<ReturnType<typeof parsePullRequestWebhookEvent>>) {
  if (kind === "review_requested") {
    return `PR #${event.number} requested review`;
  }

  if (kind === "merged") {
    return `PR #${event.number} merged`;
  }

  if (kind === "closed") {
    return `PR #${event.number} closed`;
  }

  return `PR #${event.number} opened`;
}

function shouldNotifyCheckStatus(previousStatus: GithubCheckRollupStatus | null, nextStatus: GithubCheckRollupStatus) {
  if (nextStatus === "failing") {
    return previousStatus !== "failing";
  }

  if (nextStatus === "passing") {
    return previousStatus === "failing" || previousStatus === "cancelled";
  }

  return false;
}

function shouldNotifyDeployment(event: ReturnType<typeof parseDeploymentWebhookEvent>) {
  return Boolean(
    event &&
      event.status === "success" &&
      (event.environment === "staging" || event.environment === "production")
  );
}

async function notifyGithubTargets(
  notificationRepository: NotificationRepository | undefined,
  targets: GithubNotificationTarget[],
  input: {
    sourceId: string;
    eventType: "github_pr_changed" | "github_check_changed" | "github_deploy_changed";
    priority?: "low" | "normal" | "high";
    title: string;
    body: string | null;
    metadata: Record<string, unknown>;
  }
) {
  if (!notificationRepository || targets.length === 0) {
    return;
  }

  for (const target of targets) {
    await createNotificationForWorkspace(notificationRepository, {
      workspaceId: target.workspaceId,
      projectId: target.projectId,
      workItemId: target.workItemId,
      sourceType: "github",
      sourceId: `${input.sourceId}:${target.workItemId}`,
      eventType: input.eventType,
      actorId: null,
      priority: input.priority ?? "normal",
      title: input.title,
      body: input.body,
      url: githubTargetUrl(target),
      metadata: {
        ...input.metadata,
        identifier: target.workItemIdentifier
      },
      recipients: await githubTargetRecipients(notificationRepository, target)
    });
  }
}

function parseCheckRollupStatus(status: string | null, conclusion: string | null): GithubCheckRollupStatus {
  if (status !== "completed") {
    return status === "queued" || status === "in_progress" ? "pending" : "unknown";
  }

  if (conclusion === "success" || conclusion === "neutral") {
    return "passing";
  }

  if (conclusion === "skipped") {
    return "skipped";
  }

  if (conclusion === "cancelled") {
    return "cancelled";
  }

  if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "action_required" || conclusion === "startup_failure") {
    return "failing";
  }

  return "unknown";
}

function parseCheckWebhookEvent(
  eventName: Extract<GithubWebhookEventName, "check_run" | "check_suite">,
  payload: Record<string, unknown>,
  fallbackTimestamp: string
) {
  const envelope = isRecord(payload[eventName]) ? payload[eventName] : null;
  if (!envelope) {
    return null;
  }

  const headSha = readRequiredString(envelope.head_sha);
  if (!headSha) {
    return null;
  }

  return {
    headSha,
    status: parseCheckRollupStatus(readOptionalString(envelope.status), readOptionalString(envelope.conclusion)),
    url: readOptionalString(envelope.html_url),
    checkCount: readRequiredNumber(envelope.latest_check_runs_count) ?? 1,
    completedAt: readOptionalString(envelope.completed_at)
      ? readIsoString(envelope.completed_at, fallbackTimestamp)
      : null
  };
}

function classifyDeploymentEnvironment(environmentName: string | null): GithubDeploymentEnvironment {
  const normalized = environmentName?.trim().toLowerCase() ?? "";

  if (normalized.includes("prod")) {
    return "production";
  }

  if (normalized.includes("stag")) {
    return "staging";
  }

  if (normalized.includes("preview")) {
    return "preview";
  }

  if (normalized.includes("dev")) {
    return "development";
  }

  return "other";
}

function parseDeploymentStatus(state: string | null): GithubDeploymentStatus {
  if (
    state === "queued" ||
    state === "in_progress" ||
    state === "success" ||
    state === "failure" ||
    state === "inactive"
  ) {
    return state;
  }

  return "unknown";
}

function parseDeploymentWebhookEvent(
  eventName: Extract<GithubWebhookEventName, "deployment" | "deployment_status">,
  payload: Record<string, unknown>
) {
  const deployment = isRecord(payload.deployment) ? payload.deployment : null;
  if (!deployment) {
    return null;
  }

  const providerDeploymentId = readRequiredIdentifier(deployment.id);
  const headSha = readRequiredString(deployment.sha);
  if (!providerDeploymentId || !headSha) {
    return null;
  }

  const deploymentStatus = eventName === "deployment_status" && isRecord(payload.deployment_status)
    ? payload.deployment_status
    : null;
  const environmentName =
    readOptionalString(deploymentStatus?.environment) ?? readOptionalString(deployment.environment);

  return {
    providerDeploymentId,
    headSha,
    environmentName,
    environment: classifyDeploymentEnvironment(environmentName),
    status: parseDeploymentStatus(
      eventName === "deployment_status"
        ? readOptionalString(deploymentStatus?.state)
        : readOptionalString(deployment.task) === "deploy"
          ? "queued"
          : "queued"
    ),
    url:
      readOptionalString(deploymentStatus?.environment_url) ??
      readOptionalString(deploymentStatus?.target_url) ??
      readOptionalString(deploymentStatus?.log_url) ??
      null
  };
}

export async function connectProjectGithubRepositoryForUser(
  repository: GithubConnectionRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  input: CreateProjectGithubConnectionInput
): Promise<ProjectGithubConnectionView> {
  const { workspace, membership, project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can connect GitHub repositories.");

  const existingConnection = await repository.getProjectGithubConnection(project.id);
  if (existingConnection) {
    throw new WorkspaceError(409, "project already has a primary GitHub repository.");
  }

  const owner = requireNonEmptyString(input.owner, "owner");
  const name = requireNonEmptyString(input.name, "name");

  try {
    return await repository.createProjectGithubConnection({
      projectId: project.id,
      workspaceId: workspace.id,
      providerRepositoryId: requireNonEmptyString(input.providerRepositoryId, "providerRepositoryId"),
      owner,
      name,
      fullName: normalizeFullName(owner, name, input.fullName),
      defaultBranch: requireNonEmptyString(input.defaultBranch, "defaultBranch"),
      installationId: requireNonEmptyString(input.installationId, "installationId"),
      stagingEnvironmentName: normalizeOptionalString(input.stagingEnvironmentName) ?? null,
      productionEnvironmentName: normalizeOptionalString(input.productionEnvironmentName) ?? null,
      actorId: session.userId
    });
  } catch (error) {
    translateConnectionError(error);
  }
}

export async function getProjectGithubConnectionForUser(
  repository: GithubConnectionRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { project } = await resolveProjectContext(repository, session, workspaceSlug, projectKey);
  return repository.getProjectGithubConnection(project.id);
}

export async function projectGithubWebhookEvent(
  repository: GithubConnectionRepository,
  githubRepository: GithubRepositoryRecord,
  eventName: GithubWebhookEventName,
  payload: Record<string, unknown>,
  receivedAt: string,
  dependencies: GithubNotificationDependencies = {}
) {
  if (eventName === "pull_request") {
    const event = parsePullRequestWebhookEvent(payload, receivedAt);
    if (!event) {
      return;
    }

    await repository.applyPullRequestWebhookProjection({
      repositoryId: githubRepository.id,
      ...event
    });

    const kind = githubPullRequestNotificationKind(event);
    if (kind) {
      const targets = await repository.listGithubNotificationTargetsForPullRequest(
        githubRepository.id,
        event.providerPullRequestId
      );
      await notifyGithubTargets(dependencies.notificationRepository, targets, {
        sourceId: `${githubRepository.id}:pr:${event.providerPullRequestId}:${kind}:${event.updatedAt}`,
        eventType: "github_pr_changed",
        title: githubPullRequestNotificationTitle(kind, event),
        body: event.title,
        metadata: {
          repositoryId: githubRepository.id,
          repositoryFullName: githubRepository.fullName,
          providerPullRequestId: event.providerPullRequestId,
          number: event.number,
          state: event.state,
          action: event.action,
          kind,
          url: event.url
        }
      });
    }
    return;
  }

  if (eventName === "check_run" || eventName === "check_suite") {
    const event = parseCheckWebhookEvent(eventName, payload, receivedAt);
    if (!event) {
      return;
    }

    const previousStatus = await repository.getGithubCheckRollupStatus(githubRepository.id, event.headSha);
    await repository.applyCheckRollupWebhookProjection({
      repositoryId: githubRepository.id,
      ...event
    });

    if (shouldNotifyCheckStatus(previousStatus, event.status)) {
      const targets = await repository.listGithubNotificationTargetsForHeadSha(githubRepository.id, event.headSha);
      await notifyGithubTargets(dependencies.notificationRepository, targets, {
        sourceId: `${githubRepository.id}:check:${event.headSha}:${event.status}:${event.completedAt ?? receivedAt}`,
        eventType: "github_check_changed",
        priority: event.status === "failing" ? "high" : "normal",
        title: event.status === "failing" ? "GitHub checks are failing" : "GitHub checks recovered",
        body: event.url,
        metadata: {
          repositoryId: githubRepository.id,
          repositoryFullName: githubRepository.fullName,
          headSha: event.headSha,
          status: event.status,
          previousStatus,
          url: event.url
        }
      });
    }
    return;
  }

  if (eventName === "deployment" || eventName === "deployment_status") {
    const event = parseDeploymentWebhookEvent(eventName, payload);
    if (!event) {
      return;
    }

    await repository.applyDeploymentWebhookProjection({
      repositoryId: githubRepository.id,
      ...event
    });

    if (shouldNotifyDeployment(event)) {
      const targets = await repository.listGithubNotificationTargetsForHeadSha(githubRepository.id, event.headSha);
      await notifyGithubTargets(dependencies.notificationRepository, targets, {
        sourceId: `${githubRepository.id}:deploy:${event.providerDeploymentId}:${event.environment}:${event.status}`,
        eventType: "github_deploy_changed",
        title: `${event.environment === "production" ? "Production" : "Staging"} deploy succeeded`,
        body: event.url,
        metadata: {
          repositoryId: githubRepository.id,
          repositoryFullName: githubRepository.fullName,
          providerDeploymentId: event.providerDeploymentId,
          headSha: event.headSha,
          environment: event.environment,
          environmentName: event.environmentName,
          status: event.status,
          url: event.url
        }
      });
    }
  }
}

export async function notifyGithubWebhookDeliveryFailure(
  repository: GithubWebhookRepository,
  notificationRepository: NotificationRepository,
  githubRepository: GithubRepositoryRecord,
  input: {
    deliveryId: string;
    eventName: GithubWebhookEventName;
    errorMessage: string;
  }
) {
  const context = await repository.getGithubRepositoryNotificationContext(githubRepository.id);
  if (!context || context.adminRecipientIds.length === 0) {
    return;
  }

  await createNotificationForWorkspace(notificationRepository, {
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    workItemId: null,
    sourceType: "github",
    sourceId: `${githubRepository.id}:delivery:${input.deliveryId}:failed`,
    eventType: "github_webhook_failed",
    actorId: null,
    priority: "high",
    title: "GitHub webhook processing failed",
    body: input.errorMessage,
    url: `/workspaces/${context.workspaceSlug}/projects/${context.projectKey}`,
    metadata: {
      repositoryId: githubRepository.id,
      repositoryFullName: context.repositoryFullName,
      deliveryId: input.deliveryId,
      eventName: input.eventName,
      errorMessage: input.errorMessage
    },
    recipients: context.adminRecipientIds.map(
      (recipientId): NotificationRecipientInput => ({
        recipientId,
        reason: "github"
      })
    )
  });
}
