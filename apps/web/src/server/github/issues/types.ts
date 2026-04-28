import type { GithubIssueState, GithubIssueSyncStatus } from "@the-platform/shared";

export interface NormalizedGithubIssue {
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
  isPullRequest: boolean;
}

export interface NormalizedGithubIssueComment {
  providerCommentId: string;
  body: string;
  url: string;
  authorLogin: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
}

export interface GithubIssueSyncView {
  status: GithubIssueSyncStatus;
  issueNumber: number;
  issueUrl: string;
  repositoryFullName: string;
  conflictFields: string[];
  errorMessage: string | null;
  syncEnabled: boolean;
}
