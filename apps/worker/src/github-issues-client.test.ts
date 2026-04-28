import assert from "node:assert/strict";
import test from "node:test";

import type { GithubTokenProvider } from "./github-app-auth";
import { createGithubIssuesClient } from "./github-issues-client";

function createJsonResponse(body: unknown, init?: ResponseInit) {
  const responseInit: ResponseInit = {
    status: init?.status ?? 200,
    ...(init?.statusText ? { statusText: init.statusText } : {}),
    headers: {
      "content-type": "application/json"
    }
  };

  return new Response(JSON.stringify(body), {
    ...responseInit
  });
}

function serializeFetchUrl(url: string | URL | Request) {
  if (typeof url === "string") {
    return url;
  }

  if (url instanceof URL) {
    return url.href;
  }

  return url.url;
}

const target = {
  owner: "the-platform",
  name: "platform-ops",
  fullName: "the-platform/platform-ops",
  installationId: "installation-1"
};

const issuePayload = {
  id: 101,
  number: 7,
  title: "Sync issue title",
  body: "Issue body",
  html_url: "https://github.com/the-platform/platform-ops/issues/7",
  state: "open",
  user: { login: "octocat" },
  created_at: "2026-04-27T10:00:00Z",
  updated_at: "2026-04-27T11:00:00Z",
  closed_at: null
};

const commentPayload = {
  id: 201,
  body: "Comment body",
  html_url: "https://github.com/the-platform/platform-ops/issues/7#issuecomment-201",
  user: { login: "mona" },
  created_at: "2026-04-27T12:00:00Z",
  updated_at: "2026-04-27T12:30:00Z"
};

void test("getRepositoryIssuesSnapshot fetches open issues by default and comments for each issue", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = createGithubIssuesClient({
    baseUrl: "https://github.test",
    token: "ghs_static",
    fetch: (url, init) => {
      requests.push({ url: serializeFetchUrl(url), init: init ?? {} });

      if (serializeFetchUrl(url).endsWith("/issues?state=open&per_page=100")) {
        return Promise.resolve(createJsonResponse([issuePayload]));
      }

      return Promise.resolve(createJsonResponse([commentPayload]));
    }
  });

  const snapshot = await client.getRepositoryIssuesSnapshot(target);

  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://github.test/repos/the-platform/platform-ops/issues?state=open&per_page=100",
      "https://github.test/repos/the-platform/platform-ops/issues/7/comments?per_page=100"
    ]
  );
  assert.deepEqual(snapshot.issues, [
    {
      providerIssueId: "101",
      number: 7,
      title: "Sync issue title",
      body: "Issue body",
      url: "https://github.com/the-platform/platform-ops/issues/7",
      state: "open",
      authorLogin: "octocat",
      githubCreatedAt: "2026-04-27T10:00:00.000Z",
      githubUpdatedAt: "2026-04-27T11:00:00.000Z",
      githubClosedAt: null,
      comments: [
        {
          providerCommentId: "201",
          body: "Comment body",
          url: "https://github.com/the-platform/platform-ops/issues/7#issuecomment-201",
          authorLogin: "mona",
          githubCreatedAt: "2026-04-27T12:00:00.000Z",
          githubUpdatedAt: "2026-04-27T12:30:00.000Z"
        }
      ]
    }
  ]);
});

void test("getRepositoryIssuesSnapshot fetches all issues when includeClosed is true", async () => {
  const requests: string[] = [];
  const client = createGithubIssuesClient({
    baseUrl: "https://github.test",
    token: "ghs_static",
    fetch: (url) => {
      requests.push(serializeFetchUrl(url));
      return Promise.resolve(createJsonResponse([]));
    }
  });

  await client.getRepositoryIssuesSnapshot(target, { includeClosed: true });

  assert.deepEqual(requests, [
    "https://github.test/repos/the-platform/platform-ops/issues?state=all&per_page=100"
  ]);
});

void test("getRepositoryIssuesSnapshot excludes pull request issue payloads from returned issues", async () => {
  const requests: string[] = [];
  const client = createGithubIssuesClient({
    baseUrl: "https://github.test",
    token: "ghs_static",
    fetch: (url) => {
      requests.push(serializeFetchUrl(url));
      return Promise.resolve(
        createJsonResponse([
          issuePayload,
          {
            ...issuePayload,
            id: 102,
            number: 8,
            html_url: "https://github.com/the-platform/platform-ops/pull/8",
            pull_request: { url: "https://api.github.com/repos/the-platform/platform-ops/pulls/8" }
          }
        ])
      );
    }
  });

  const snapshot = await client.getRepositoryIssuesSnapshot(target);

  assert.deepEqual(requests, [
    "https://github.test/repos/the-platform/platform-ops/issues?state=open&per_page=100",
    "https://github.test/repos/the-platform/platform-ops/issues/7/comments?per_page=100"
  ]);
  assert.deepEqual(
    snapshot.issues.map((issue) => issue.number),
    [7]
  );
});

void test("getRepositoryIssuesSnapshot resolves a repository token from the configured provider", async () => {
  const providerCalls: string[] = [];
  const tokenProvider: GithubTokenProvider = {
    getToken(repositoryTarget) {
      providerCalls.push(`${repositoryTarget.fullName}:${repositoryTarget.installationId ?? "none"}`);
      return Promise.resolve("ghs_repository_installation");
    }
  };
  const client = createGithubIssuesClient({
    baseUrl: "https://github.test",
    tokenProvider,
    fetch: () => Promise.resolve(createJsonResponse([]))
  });

  await client.getRepositoryIssuesSnapshot(target);

  assert.deepEqual(providerCalls, ["the-platform/platform-ops:installation-1"]);
});

void test("updateIssue patches issue fields and returns a normalized issue snapshot", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = createGithubIssuesClient({
    baseUrl: "https://github.test",
    token: "ghs_static",
    fetch: (url, init) => {
      requests.push({ url: serializeFetchUrl(url), init: init ?? {} });

      if ((init?.method ?? "GET") === "PATCH") {
        return Promise.resolve(
          createJsonResponse({
            ...issuePayload,
            title: "Updated title",
            body: "Updated body",
            state: "closed",
            closed_at: "2026-04-27T14:00:00Z"
          })
        );
      }

      return Promise.resolve(createJsonResponse([commentPayload]));
    }
  });

  const snapshot = await client.updateIssue(target, 7, {
    title: "Updated title",
    body: "Updated body",
    state: "closed"
  });

  assert.equal(requests[0]?.url, "https://github.test/repos/the-platform/platform-ops/issues/7");
  assert.equal(requests[0]?.init.method, "PATCH");
  assert.deepEqual(JSON.parse(String(requests[0]?.init.body)), {
    title: "Updated title",
    body: "Updated body",
    state: "closed"
  });
  assert.equal(snapshot.title, "Updated title");
  assert.equal(snapshot.state, "closed");
  assert.equal(snapshot.githubClosedAt, "2026-04-27T14:00:00.000Z");
  assert.equal(snapshot.comments.length, 1);
});

void test("GitHub non-2xx response throws a sanitized error with status, status text, and path", async () => {
  const client = createGithubIssuesClient({
    baseUrl: "https://github.test",
    token: "ghs_static",
    fetch: () =>
      Promise.resolve(
        createJsonResponse(
          {
            message: "sensitive body"
          },
          {
            status: 403,
            statusText: "Forbidden"
          }
        )
      )
  });

  await assert.rejects(
    () => client.getRepositoryIssuesSnapshot(target),
    (error) => {
      assert(error instanceof Error);
      assert.equal(
        error.message,
        "GitHub API request failed for /repos/the-platform/platform-ops/issues?state=open&per_page=100: 403 Forbidden"
      );
      assert.equal(error.message.includes("sensitive body"), false);
      return true;
    }
  );
});

void test("getRepositoryIssuesSnapshot normalizes invalid and missing timestamps to a controlled fallback", async () => {
  const client = createGithubIssuesClient({
    baseUrl: "https://github.test",
    token: "ghs_static",
    now: () => new Date("2026-04-27T15:00:00.000Z"),
    fetch: (url) => {
      if (serializeFetchUrl(url).endsWith("/issues?state=open&per_page=100")) {
        return Promise.resolve(
          createJsonResponse([
            {
              ...issuePayload,
              created_at: "not-a-date",
              updated_at: undefined,
              closed_at: "not-a-date"
            }
          ])
        );
      }

      return Promise.resolve(
        createJsonResponse([
          {
            ...commentPayload,
            created_at: "not-a-date",
            updated_at: undefined
          }
        ])
      );
    }
  });

  const snapshot = await client.getRepositoryIssuesSnapshot(target);

  assert.equal(snapshot.fetchedAt, "2026-04-27T15:00:00.000Z");
  assert.equal(snapshot.issues[0]?.githubCreatedAt, "2026-04-27T15:00:00.000Z");
  assert.equal(snapshot.issues[0]?.githubUpdatedAt, "2026-04-27T15:00:00.000Z");
  assert.equal(snapshot.issues[0]?.githubClosedAt, null);
  assert.equal(snapshot.issues[0]?.comments[0]?.githubCreatedAt, "2026-04-27T15:00:00.000Z");
  assert.equal(snapshot.issues[0]?.comments[0]?.githubUpdatedAt, "2026-04-27T15:00:00.000Z");
});
