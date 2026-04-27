import type { GithubInstallationRepository } from "./app-installation";

export interface GithubUserProfile {
  id: string;
  login: string;
}

export interface GithubUserInstallation {
  installationId: string;
  accountLogin: string | null;
}

export interface GithubUserAuthorizationClient {
  exchangeCodeForUserAccessToken(input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<string>;
  getUser(userAccessToken: string): Promise<GithubUserProfile>;
  listUserInstallations(
    userAccessToken: string
  ): Promise<GithubUserInstallation[]>;
  listUserInstallationRepositories(
    userAccessToken: string,
    installationId: string
  ): Promise<GithubInstallationRepository[]>;
}

export interface GithubUserAuthorizationClientOptions {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  apiBaseUrl?: string | undefined;
  githubBaseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
  env?: Record<string, string | undefined> | undefined;
}

const GITHUB_API_VERSION = "2022-11-28";

function readNonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeApiBaseUrl(baseUrl: string | undefined) {
  return (baseUrl ?? "https://api.github.com").replace(/\/+$/, "");
}

function normalizeGithubBaseUrl(baseUrl: string | undefined) {
  return (baseUrl ?? "https://github.com").replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }

  return readString(value);
}

function serializeUser(value: unknown): GithubUserProfile {
  if (!isRecord(value)) {
    throw new Error("GitHub user response was incomplete.");
  }

  const id = readId(value.id);
  const login = readString(value.login);
  if (!id || !login) {
    throw new Error("GitHub user response was incomplete.");
  }

  return { id, login };
}

function serializeInstallation(value: unknown): GithubUserInstallation | null {
  if (!isRecord(value)) {
    return null;
  }

  const installationId = readId(value.id);
  if (!installationId) {
    return null;
  }

  return {
    installationId,
    accountLogin: isRecord(value.account)
      ? readString(value.account.login)
      : null,
  };
}

function serializeRepository(
  value: unknown
): GithubInstallationRepository | null {
  if (!isRecord(value)) {
    return null;
  }

  const providerRepositoryId = readId(value.id);
  const name = readString(value.name);
  const fullName = readString(value.full_name);
  const defaultBranch = readString(value.default_branch);
  const owner = isRecord(value.owner) ? readString(value.owner.login) : null;

  if (!providerRepositoryId || !name || !fullName || !defaultBranch || !owner) {
    return null;
  }

  return {
    providerRepositoryId,
    owner,
    name,
    fullName,
    defaultBranch,
    htmlUrl: readString(value.html_url),
    isPrivate: value.private === true,
  };
}

function createRestHeaders(userAccessToken: string) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${userAccessToken}`,
    "x-github-api-version": GITHUB_API_VERSION,
  };
}

function readNextLink(response: Response) {
  const linkHeader = response.headers.get("link");
  if (!linkHeader) {
    return null;
  }

  for (const link of linkHeader.split(",")) {
    const match = link.match(/^\s*<([^>]+)>;\s*rel="next"\s*$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function readArrayProperty(value: unknown, propertyName: string): unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  const propertyValue = value[propertyName];
  return Array.isArray(propertyValue) ? Array.from(propertyValue) : [];
}

async function fetchPaginatedGithubItems(input: {
  fetchImpl: typeof fetch;
  initialUrl: string;
  headers: ReturnType<typeof createRestHeaders>;
  step: string;
  readItems(body: unknown): unknown[];
}) {
  const items: unknown[] = [];
  let nextUrl: string | null = input.initialUrl;

  while (nextUrl) {
    const response = await input.fetchImpl(nextUrl, {
      headers: input.headers,
    });

    if (!response.ok) {
      throw new Error(
        `${input.step} failed: ${response.status} ${response.statusText}`
      );
    }

    items.push(...input.readItems(await response.json()));
    nextUrl = readNextLink(response);
  }

  return items;
}

export function buildGithubAppUserAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  githubBaseUrl?: string | undefined;
}) {
  const url = new URL(
    "/login/oauth/authorize",
    normalizeGithubBaseUrl(input.githubBaseUrl)
  );
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function getGithubUserAuthorizationMissingConfiguration(
  env: Record<string, string | undefined> = process.env
) {
  const missing: string[] = [];

  if (!readNonEmpty(env.GITHUB_APP_CLIENT_ID)) {
    missing.push("GITHUB_APP_CLIENT_ID");
  }

  if (!readNonEmpty(env.GITHUB_APP_CLIENT_SECRET)) {
    missing.push("GITHUB_APP_CLIENT_SECRET");
  }

  if (!readNonEmpty(env.GITHUB_USER_AUTH_STATE_SECRET)) {
    missing.push("GITHUB_USER_AUTH_STATE_SECRET");
  }

  return missing;
}

export function createGithubUserAuthorizationClient(
  options: GithubUserAuthorizationClientOptions = {}
): GithubUserAuthorizationClient {
  const env = options.env ?? process.env;
  const clientId =
    readNonEmpty(options.clientId) ?? readNonEmpty(env.GITHUB_APP_CLIENT_ID);
  const clientSecret =
    readNonEmpty(options.clientSecret) ??
    readNonEmpty(env.GITHUB_APP_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error(
      "GitHub App OAuth client credentials are required for user authorization."
    );
  }

  const apiBaseUrl = normalizeApiBaseUrl(
    options.apiBaseUrl ?? env.GITHUB_API_URL
  );
  const githubBaseUrl = normalizeGithubBaseUrl(
    options.githubBaseUrl ?? env.GITHUB_BASE_URL
  );
  const fetchImpl = options.fetch ?? fetch;

  return {
    async exchangeCodeForUserAccessToken(input) {
      const body = new URLSearchParams();
      body.set("client_id", clientId);
      body.set("client_secret", clientSecret);
      body.set("code", input.code);
      body.set("redirect_uri", input.redirectUri);
      body.set("code_verifier", input.codeVerifier);

      const response = await fetchImpl(
        `${githubBaseUrl}/login/oauth/access_token`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
          },
          body,
        }
      );

      if (!response.ok) {
        throw new Error(
          `GitHub user token exchange failed: ${response.status} ${response.statusText}`
        );
      }

      const responseBody = (await response.json()) as {
        access_token?: unknown;
      };
      const token = readString(responseBody.access_token);
      if (!token) {
        throw new Error("GitHub user token exchange response was incomplete.");
      }

      return token;
    },

    async getUser(userAccessToken) {
      const response = await fetchImpl(`${apiBaseUrl}/user`, {
        headers: createRestHeaders(userAccessToken),
      });

      if (!response.ok) {
        throw new Error(
          `GitHub user request failed: ${response.status} ${response.statusText}`
        );
      }

      return serializeUser(await response.json());
    },

    async listUserInstallations(userAccessToken) {
      const url = new URL(`${apiBaseUrl}/user/installations`);
      url.searchParams.set("per_page", "100");

      const installations = await fetchPaginatedGithubItems({
        fetchImpl,
        initialUrl: url.toString(),
        headers: createRestHeaders(userAccessToken),
        step: "GitHub user installations request",
        readItems(body) {
          return readArrayProperty(body, "installations");
        },
      });

      return installations
        .map(serializeInstallation)
        .filter((installation): installation is GithubUserInstallation =>
          Boolean(installation)
        );
    },

    async listUserInstallationRepositories(userAccessToken, installationId) {
      const url = new URL(
        `${apiBaseUrl}/user/installations/${encodeURIComponent(installationId)}/repositories`
      );
      url.searchParams.set("per_page", "100");

      const repositories = await fetchPaginatedGithubItems({
        fetchImpl,
        initialUrl: url.toString(),
        headers: createRestHeaders(userAccessToken),
        step: "GitHub user installation repositories request",
        readItems(body) {
          return readArrayProperty(body, "repositories");
        },
      });

      return repositories
        .map(serializeRepository)
        .filter((repository): repository is GithubInstallationRepository =>
          Boolean(repository)
        );
    },
  };
}
