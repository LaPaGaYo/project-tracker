import type { GithubIssueState } from "@the-platform/shared";

import { createGithubTokenProvider, type GithubTokenProvider } from "./github-app-auth";
import type { GithubClientTarget } from "./github-client";

export interface GithubIssueSnapshot {
  providerIssueId: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: GithubIssueState;
  authorLogin: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
  githubClosedAt: string | null;
  comments: GithubIssueCommentSnapshot[];
}

export interface GithubIssueCommentSnapshot {
  providerCommentId: string;
  body: string;
  url: string;
  authorLogin: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
}

export interface GithubIssuesClient {
  getRepositoryIssuesSnapshot(
    target: GithubClientTarget,
    options?: { includeClosed?: boolean }
  ): Promise<{ fetchedAt: string; issues: GithubIssueSnapshot[] }>;
  updateIssue(
    target: GithubClientTarget,
    issueNumber: number,
    input: { title?: string; body?: string; state?: GithubIssueState }
  ): Promise<GithubIssueSnapshot>;
}

interface GithubIssuesClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  token?: string;
  tokenProvider?: GithubTokenProvider;
}

interface GithubRestIssue {
  id: string | number;
  number: string | number;
  title: string;
  body?: string | null;
  html_url: string;
  state?: string | null;
  user?: {
    login?: string | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  pull_request?: unknown;
}

interface GithubRestIssueComment {
  id: string | number;
  body: string;
  html_url: string;
  user?: {
    login?: string | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function normalizeApiBaseUrl(baseUrl: string | undefined) {
  return (baseUrl ?? process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/+$/, "");
}

function encodePathSegment(value: string | number) {
  return encodeURIComponent(String(value));
}

function repositoryPath(target: GithubClientTarget) {
  return `/repos/${encodePathSegment(target.owner)}/${encodePathSegment(target.name)}`;
}

function normalizeIssueState(value: string | null | undefined): GithubIssueState {
  return value === "closed" ? "closed" : "open";
}

function readIsoString(value: unknown, fallback: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function readOptionalIsoString(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeIssueComment(comment: GithubRestIssueComment, fallbackTimestamp: string): GithubIssueCommentSnapshot {
  return {
    providerCommentId: `${comment.id}`,
    body: comment.body,
    url: comment.html_url,
    authorLogin: comment.user?.login ?? null,
    githubCreatedAt: readIsoString(comment.created_at, fallbackTimestamp),
    githubUpdatedAt: readIsoString(comment.updated_at, fallbackTimestamp)
  };
}

function normalizeIssue(
  issue: GithubRestIssue,
  comments: GithubIssueCommentSnapshot[],
  fallbackTimestamp: string
): GithubIssueSnapshot {
  return {
    providerIssueId: `${issue.id}`,
    number: Number(issue.number),
    title: issue.title,
    body: issue.body ?? null,
    url: issue.html_url,
    state: normalizeIssueState(issue.state),
    authorLogin: issue.user?.login ?? null,
    githubCreatedAt: readIsoString(issue.created_at, fallbackTimestamp),
    githubUpdatedAt: readIsoString(issue.updated_at, fallbackTimestamp),
    githubClosedAt: readOptionalIsoString(issue.closed_at),
    comments
  };
}

async function requestGithubJson<T>(
  requestFetch: typeof fetch,
  baseUrl: string,
  token: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await requestFetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${path}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchIssueComments(
  requestFetch: typeof fetch,
  baseUrl: string,
  token: string,
  target: GithubClientTarget,
  issueNumber: number,
  fallbackTimestamp: string
) {
  const comments = await requestGithubJson<GithubRestIssueComment[]>(
    requestFetch,
    baseUrl,
    token,
    `${repositoryPath(target)}/issues/${encodePathSegment(issueNumber)}/comments?per_page=100`
  );

  return comments.map((comment) => normalizeIssueComment(comment, fallbackTimestamp));
}

export function createGithubIssuesClient(options: GithubIssuesClientOptions = {}): GithubIssuesClient {
  const requestFetch = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);
  const tokenProvider =
    options.tokenProvider ??
    createGithubTokenProvider({
      token: options.token,
      apiBaseUrl: baseUrl,
      fetch: requestFetch
    });

  return {
    async getRepositoryIssuesSnapshot(target, options = {}) {
      const fallbackTimestamp = now().toISOString();
      const token = await tokenProvider.getToken(target);
      const state = options.includeClosed === true ? "all" : "open";
      const issues = await requestGithubJson<GithubRestIssue[]>(
        requestFetch,
        baseUrl,
        token,
        `${repositoryPath(target)}/issues?state=${state}&per_page=100`
      );
      const issueSnapshots = await Promise.all(
        issues
          .filter((issue) => !issue.pull_request)
          .map(async (issue) => {
            const comments = await fetchIssueComments(
              requestFetch,
              baseUrl,
              token,
              target,
              Number(issue.number),
              fallbackTimestamp
            );
            return normalizeIssue(issue, comments, fallbackTimestamp);
          })
      );

      return {
        fetchedAt: fallbackTimestamp,
        issues: issueSnapshots
      };
    },

    async updateIssue(target, issueNumber, input) {
      const fallbackTimestamp = now().toISOString();
      const token = await tokenProvider.getToken(target);
      const issue = await requestGithubJson<GithubRestIssue>(
        requestFetch,
        baseUrl,
        token,
        `${repositoryPath(target)}/issues/${encodePathSegment(issueNumber)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input)
        }
      );
      const comments = await fetchIssueComments(
        requestFetch,
        baseUrl,
        token,
        target,
        Number(issue.number),
        fallbackTimestamp
      );

      return normalizeIssue(issue, comments, fallbackTimestamp);
    }
  };
}
