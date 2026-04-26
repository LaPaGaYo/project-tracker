import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubPullRequestState
} from "@the-platform/shared";

export interface GithubSnapshotPullRequest {
  providerPullRequestId: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: GithubPullRequestState;
  isDraft: boolean;
  authorLogin: string | null;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  titleIdentifiers: string[];
  bodyIdentifiers: string[];
  branchIdentifiers: string[];
}

export interface GithubSnapshotCheckRollup {
  headSha: string;
  status: GithubCheckRollupStatus;
  url: string | null;
  checkCount: number;
  completedAt: string | null;
}

export interface GithubSnapshotDeployment {
  providerDeploymentId: string;
  headSha: string;
  environmentName: string | null;
  environment: GithubDeploymentEnvironment;
  status: GithubDeploymentStatus;
  url: string | null;
}

export interface GithubRepositorySnapshot {
  fetchedAt: string;
  pullRequests: GithubSnapshotPullRequest[];
  checkRollups: GithubSnapshotCheckRollup[];
  deployments: GithubSnapshotDeployment[];
}

export interface GithubClientTarget {
  owner: string;
  name: string;
  fullName: string;
}

export interface GithubClient {
  getRepositorySnapshot(target: GithubClientTarget): Promise<GithubRepositorySnapshot>;
}

interface GithubRestClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  token?: string;
}

interface GithubRestPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  draft?: boolean;
  user?: {
    login?: string | null;
  } | null;
  base: {
    ref: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
}

interface GithubRestCheckRun {
  html_url?: string | null;
  completed_at?: string | null;
  status?: string | null;
  conclusion?: string | null;
}

interface GithubRestCheckRunResponse {
  total_count?: number;
  check_runs?: GithubRestCheckRun[];
}

interface GithubRestDeployment {
  id: number;
  sha: string;
  environment?: string | null;
}

interface GithubRestDeploymentStatus {
  state?: string | null;
  environment?: string | null;
  environment_url?: string | null;
  log_url?: string | null;
  target_url?: string | null;
}

function readToken(token: string | undefined) {
  return token ?? process.env.GITHUB_TOKEN ?? process.env.GITHUB_APP_INSTALLATION_TOKEN ?? "";
}

function normalizeApiBaseUrl(baseUrl: string | undefined) {
  return (baseUrl ?? process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/+$/, "");
}

function extractIdentifiers(value: string | null) {
  if (!value) {
    return [];
  }

  return Array.from(new Set(value.toUpperCase().match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []));
}

function parsePullRequestState(pullRequest: GithubRestPullRequest): GithubPullRequestState {
  if (pullRequest.merged_at) {
    return "merged";
  }

  return pullRequest.state === "closed" ? "closed" : "open";
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

function parseDeploymentStatus(state: string | null | undefined): GithubDeploymentStatus {
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

function combineCheckRunStatus(checkRuns: GithubRestCheckRun[]): GithubCheckRollupStatus {
  if (checkRuns.some((run) => run.status !== "completed")) {
    return "pending";
  }

  const conclusions = checkRuns.map((run) => run.conclusion ?? "unknown");

  if (conclusions.some((conclusion) => conclusion === "failure" || conclusion === "timed_out" || conclusion === "startup_failure" || conclusion === "action_required")) {
    return "failing";
  }

  if (conclusions.some((conclusion) => conclusion === "cancelled")) {
    return "cancelled";
  }

  if (conclusions.every((conclusion) => conclusion === "skipped")) {
    return "skipped";
  }

  if (conclusions.some((conclusion) => conclusion === "success" || conclusion === "neutral")) {
    return "passing";
  }

  return "unknown";
}

async function requestGithubJson<T>(requestFetch: typeof fetch, baseUrl: string, token: string, path: string) {
  const response = await requestFetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${path}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchCheckRollups(
  requestFetch: typeof fetch,
  baseUrl: string,
  token: string,
  target: GithubClientTarget,
  headShas: string[]
) {
  const uniqueHeadShas = Array.from(new Set(headShas.filter(Boolean)));

  const checkRollups = await Promise.all(
    uniqueHeadShas.map(async (headSha): Promise<GithubSnapshotCheckRollup> => {
      const response = await requestGithubJson<GithubRestCheckRunResponse>(
        requestFetch,
        baseUrl,
        token,
        `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/commits/${encodeURIComponent(headSha)}/check-runs?per_page=100`
      );
      const checkRuns = response.check_runs ?? [];

      return {
        headSha,
        status: combineCheckRunStatus(checkRuns),
        url: checkRuns.find((run) => run.html_url)?.html_url ?? null,
        checkCount: response.total_count ?? checkRuns.length,
        completedAt:
          checkRuns
            .map((run) => run.completed_at)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null
      };
    })
  );

  return checkRollups.filter((rollup) => rollup.checkCount > 0);
}

async function fetchDeployments(
  requestFetch: typeof fetch,
  baseUrl: string,
  token: string,
  target: GithubClientTarget,
  headShas: string[]
) {
  const uniqueHeadShas = Array.from(new Set(headShas.filter(Boolean)));
  const deploymentGroups = await Promise.all(
    uniqueHeadShas.map(async (headSha) => {
      const deployments = await requestGithubJson<GithubRestDeployment[]>(
        requestFetch,
        baseUrl,
        token,
        `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/deployments?sha=${encodeURIComponent(headSha)}&per_page=20`
      );

      return Promise.all(
        deployments.map(async (deployment): Promise<GithubSnapshotDeployment | null> => {
          const statuses = await requestGithubJson<GithubRestDeploymentStatus[]>(
            requestFetch,
            baseUrl,
            token,
            `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/deployments/${deployment.id}/statuses?per_page=1`
          );
          const latestStatus = statuses[0];
          if (!latestStatus) {
            return null;
          }

          const environmentName = latestStatus.environment ?? deployment.environment ?? null;

          return {
            providerDeploymentId: `${deployment.id}`,
            headSha,
            environmentName,
            environment: classifyDeploymentEnvironment(environmentName),
            status: parseDeploymentStatus(latestStatus.state),
            url: latestStatus.environment_url ?? latestStatus.log_url ?? latestStatus.target_url ?? null
          };
        })
      );
    })
  );

  return deploymentGroups.flat().filter((deployment): deployment is GithubSnapshotDeployment => Boolean(deployment));
}

export function createGithubClient(options: GithubRestClientOptions = {}): GithubClient {
  const token = readToken(options.token);
  if (!token) {
    throw new Error("GITHUB_TOKEN or GITHUB_APP_INSTALLATION_TOKEN is required for worker reconciliation.");
  }

  const requestFetch = options.fetch ?? fetch;
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    async getRepositorySnapshot(target) {
      const pullRequests = await requestGithubJson<GithubRestPullRequest[]>(
        requestFetch,
        baseUrl,
        token,
        `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/pulls?state=all&per_page=100`
      );

      const normalizedPullRequests: GithubSnapshotPullRequest[] = pullRequests.map((pullRequest) => ({
        providerPullRequestId: `${pullRequest.id}`,
        number: pullRequest.number,
        title: pullRequest.title,
        body: pullRequest.body ?? null,
        url: pullRequest.html_url,
        state: parsePullRequestState(pullRequest),
        isDraft: pullRequest.draft === true,
        authorLogin: pullRequest.user?.login ?? null,
        baseBranch: pullRequest.base.ref,
        headBranch: pullRequest.head.ref,
        headSha: pullRequest.head.sha,
        createdAt: pullRequest.created_at,
        updatedAt: pullRequest.updated_at,
        mergedAt: pullRequest.merged_at ?? null,
        closedAt: pullRequest.closed_at ?? null,
        titleIdentifiers: extractIdentifiers(pullRequest.title),
        bodyIdentifiers: extractIdentifiers(pullRequest.body ?? null),
        branchIdentifiers: extractIdentifiers(pullRequest.head.ref)
      }));

      const headShas = normalizedPullRequests.map((pullRequest) => pullRequest.headSha);
      const [checkRollups, deployments] = await Promise.all([
        fetchCheckRollups(requestFetch, baseUrl, token, target, headShas),
        fetchDeployments(requestFetch, baseUrl, token, target, headShas)
      ]);

      return {
        fetchedAt: new Date().toISOString(),
        pullRequests: normalizedPullRequests,
        checkRollups,
        deployments
      };
    }
  };
}
