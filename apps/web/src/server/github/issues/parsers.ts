import type { GithubIssueState } from "@the-platform/shared";

import type { NormalizedGithubIssue, NormalizedGithubIssueComment } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRequiredString(value: unknown) {
  return readOptionalString(value);
}

function readContentString(value: unknown) {
  return typeof value === "string" ? value : null;
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
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
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

function readOptionalIsoString(value: unknown) {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readAuthorLogin(payload: Record<string, unknown>) {
  return isRecord(payload.user) ? readOptionalString(payload.user.login) : null;
}

function normalizeIssueState(value: unknown): GithubIssueState {
  return value === "closed" ? "closed" : "open";
}

export function normalizeGithubIssuePayload(
  payload: unknown,
  fallbackTimestamp: string
): NormalizedGithubIssue | null {
  if (!isRecord(payload)) {
    return null;
  }

  const providerIssueId = readRequiredIdentifier(payload.id);
  const number = readRequiredNumber(payload.number);
  const title = readRequiredString(payload.title);
  const url = readRequiredString(payload.html_url);

  if (!providerIssueId || number === null || !title || !url) {
    return null;
  }

  return {
    providerIssueId,
    number,
    title,
    body: readContentString(payload.body),
    url,
    state: normalizeIssueState(payload.state),
    authorLogin: readAuthorLogin(payload),
    githubCreatedAt: readIsoString(payload.created_at, fallbackTimestamp),
    githubUpdatedAt: readIsoString(payload.updated_at, fallbackTimestamp),
    githubClosedAt: readOptionalIsoString(payload.closed_at),
    isPullRequest: isRecord(payload.pull_request)
  };
}

export function normalizeGithubIssueCommentPayload(
  payload: unknown,
  fallbackTimestamp: string
): NormalizedGithubIssueComment | null {
  if (!isRecord(payload)) {
    return null;
  }

  const providerCommentId = readRequiredIdentifier(payload.id);
  const body = readContentString(payload.body);
  const url = readRequiredString(payload.html_url);

  if (!providerCommentId || body === null || !url) {
    return null;
  }

  return {
    providerCommentId,
    body,
    url,
    authorLogin: readAuthorLogin(payload),
    githubCreatedAt: readIsoString(payload.created_at, fallbackTimestamp),
    githubUpdatedAt: readIsoString(payload.updated_at, fallbackTimestamp)
  };
}
