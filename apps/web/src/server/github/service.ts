import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubPullRequestState,
  GithubRepositoryRecord,
  GithubWebhookEventName
} from "@the-platform/shared";

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
  receivedAt: string
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
    return;
  }

  if (eventName === "check_run" || eventName === "check_suite") {
    const event = parseCheckWebhookEvent(eventName, payload, receivedAt);
    if (!event) {
      return;
    }

    await repository.applyCheckRollupWebhookProjection({
      repositoryId: githubRepository.id,
      ...event
    });
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
  }
}
