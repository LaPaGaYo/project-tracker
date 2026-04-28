import { describe, expect, it } from "vitest";

import {
  normalizeGithubIssueCommentPayload,
  normalizeGithubIssuePayload
} from "./parsers";

const fallbackTimestamp = "2026-04-27T12:00:00.000Z";

describe("github issue parsers", () => {
  it("normalizes a valid GitHub issue payload into an exact issue object", () => {
    const result = normalizeGithubIssuePayload(
      {
        id: 101,
        number: 7,
        title: "Sync issue title",
        body: "Issue body",
        html_url: "https://github.com/acme/platform/issues/7",
        state: "open",
        user: { login: "octocat" },
        created_at: "2026-04-27T10:00:00Z",
        updated_at: "2026-04-27T11:00:00Z",
        closed_at: null
      },
      fallbackTimestamp
    );

    expect(result).toEqual({
      providerIssueId: "101",
      number: 7,
      title: "Sync issue title",
      body: "Issue body",
      url: "https://github.com/acme/platform/issues/7",
      state: "open",
      authorLogin: "octocat",
      githubCreatedAt: "2026-04-27T10:00:00.000Z",
      githubUpdatedAt: "2026-04-27T11:00:00.000Z",
      githubClosedAt: null,
      isPullRequest: false
    });
  });

  it("marks issue payloads with pull_request as pull requests", () => {
    const result = normalizeGithubIssuePayload(
      {
        id: "102",
        number: "8",
        title: "PR",
        body: null,
        html_url: "https://github.com/acme/platform/pull/8",
        state: "open",
        pull_request: {
          url: "https://api.github.com/repos/acme/platform/pulls/8"
        },
        created_at: "2026-04-27T10:00:00Z",
        updated_at: "2026-04-27T10:00:00Z"
      },
      fallbackTimestamp
    );

    expect(result?.isPullRequest).toBe(true);
  });

  it("normalizes an issue comment payload into an exact comment object", () => {
    const result = normalizeGithubIssueCommentPayload(
      {
        id: 201,
        body: "Comment body",
        html_url: "https://github.com/acme/platform/issues/7#issuecomment-201",
        user: { login: "mona" },
        created_at: "2026-04-27T12:00:00Z",
        updated_at: "2026-04-27T12:30:00Z"
      },
      "2026-04-27T13:00:00.000Z"
    );

    expect(result).toEqual({
      providerCommentId: "201",
      body: "Comment body",
      url: "https://github.com/acme/platform/issues/7#issuecomment-201",
      authorLogin: "mona",
      githubCreatedAt: "2026-04-27T12:00:00.000Z",
      githubUpdatedAt: "2026-04-27T12:30:00.000Z"
    });
  });

  it("returns null for malformed required issue and comment fields instead of throwing", () => {
    expect(() => normalizeGithubIssuePayload(null, fallbackTimestamp)).not.toThrow();
    expect(() => normalizeGithubIssueCommentPayload([], fallbackTimestamp)).not.toThrow();

    expect(
      normalizeGithubIssuePayload(
        {
          id: 101,
          number: Number.POSITIVE_INFINITY,
          title: "Sync issue title",
          html_url: "https://github.com/acme/platform/issues/7"
        },
        fallbackTimestamp
      )
    ).toBeNull();
    expect(
      normalizeGithubIssueCommentPayload(
        {
          id: 201,
          body: "Comment body"
        },
        fallbackTimestamp
      )
    ).toBeNull();
  });

  it("normalizes invalid or missing timestamps to fallback timestamp ISO", () => {
    const issue = normalizeGithubIssuePayload(
      {
        id: 103,
        number: 9,
        title: "Fallback timestamps",
        body: "",
        html_url: "https://github.com/acme/platform/issues/9",
        state: "not-closed",
        created_at: "not-a-date",
        closed_at: "not-a-date"
      },
      fallbackTimestamp
    );
    const comment = normalizeGithubIssueCommentPayload(
      {
        id: 202,
        body: "Comment body",
        html_url: "https://github.com/acme/platform/issues/9#issuecomment-202",
        created_at: "not-a-date"
      },
      fallbackTimestamp
    );

    expect(issue).toMatchObject({
      state: "open",
      authorLogin: null,
      githubCreatedAt: fallbackTimestamp,
      githubUpdatedAt: fallbackTimestamp,
      githubClosedAt: null
    });
    expect(comment).toMatchObject({
      authorLogin: null,
      githubCreatedAt: fallbackTimestamp,
      githubUpdatedAt: fallbackTimestamp
    });
  });
});
