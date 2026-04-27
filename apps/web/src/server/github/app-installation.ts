import { createSign } from "node:crypto";

export interface GithubInstallationRepository {
  providerRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string | null;
  isPrivate: boolean;
}

export interface GithubAppInstallationClient {
  listRepositories(installationId: string): Promise<GithubInstallationRepository[]>;
}

export interface GithubAppInstallationClientOptions {
  appId?: string | undefined;
  privateKey?: string | undefined;
  privateKeyBase64?: string | undefined;
  apiBaseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
  env?: Record<string, string | undefined> | undefined;
  now?: (() => Date) | undefined;
}

interface InstallationTokenResponse {
  token?: string;
  expires_at?: string;
}

const GITHUB_API_VERSION = "2022-11-28";
const APP_JWT_TTL_SECONDS = 9 * 60;
const APP_JWT_CLOCK_SKEW_SECONDS = 60;

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

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRepositoryId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }

  return readString(value);
}

function createGithubAppJwt(input: { appId: string; privateKey: string; now: Date }) {
  const issuedAt = Math.floor(input.now.getTime() / 1000) - APP_JWT_CLOCK_SKEW_SECONDS;
  const unsigned = [
    base64UrlJson({
      alg: "RS256",
      typ: "JWT"
    }),
    base64UrlJson({
      iat: issuedAt,
      exp: issuedAt + APP_JWT_TTL_SECONDS,
      iss: input.appId
    })
  ].join(".");

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();

  return `${unsigned}.${signer.sign(input.privateKey).toString("base64url")}`;
}

function serializeRepository(value: unknown): GithubInstallationRepository | null {
  if (!isRecord(value)) {
    return null;
  }

  const providerRepositoryId = readRepositoryId(value.id);
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
    isPrivate: value.private === true
  };
}

export function buildGithubAppInstallUrl(input: {
  appSlug: string;
  workspaceSlug: string;
  githubBaseUrl?: string | undefined;
}) {
  const appSlug = readNonEmpty(input.appSlug);
  const workspaceSlug = readNonEmpty(input.workspaceSlug);

  if (!appSlug) {
    throw new Error("GITHUB_APP_SLUG is required to build the GitHub App install URL.");
  }

  if (!workspaceSlug) {
    throw new Error("workspaceSlug is required to build the GitHub App install URL.");
  }

  const url = new URL(`/apps/${appSlug}/installations/new`, normalizeGithubBaseUrl(input.githubBaseUrl));
  url.searchParams.set("state", workspaceSlug);
  return url.toString();
}

export function normalizeGithubAppPrivateKey(input: {
  privateKey?: string | undefined;
  privateKeyBase64?: string | undefined;
}) {
  const base64Value = readNonEmpty(input.privateKeyBase64);
  if (base64Value) {
    return Buffer.from(base64Value, "base64").toString("utf8").replaceAll("\\n", "\n").trim();
  }

  return readNonEmpty(input.privateKey)?.replaceAll("\\n", "\n").trim();
}

export function hasGithubAppCredentials(env: Record<string, string | undefined> = process.env) {
  return Boolean(
    readNonEmpty(env.GITHUB_APP_ID) &&
      normalizeGithubAppPrivateKey({
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
        privateKeyBase64: env.GITHUB_APP_PRIVATE_KEY_BASE64
      })
  );
}

export function getGithubAppMissingConfiguration(env: Record<string, string | undefined> = process.env) {
  const missing: string[] = [];

  if (!readNonEmpty(env.GITHUB_APP_SLUG)) {
    missing.push("GITHUB_APP_SLUG");
  }

  if (!readNonEmpty(env.GITHUB_APP_ID)) {
    missing.push("GITHUB_APP_ID");
  }

  if (
    !normalizeGithubAppPrivateKey({
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      privateKeyBase64: env.GITHUB_APP_PRIVATE_KEY_BASE64
    })
  ) {
    missing.push("GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_BASE64");
  }

  return missing;
}

export function createGithubAppInstallationClient(
  options: GithubAppInstallationClientOptions = {}
): GithubAppInstallationClient {
  const env = options.env ?? process.env;
  const appId = readNonEmpty(options.appId) ?? readNonEmpty(env.GITHUB_APP_ID);
  const privateKey = normalizeGithubAppPrivateKey({
    privateKey: options.privateKey ?? env.GITHUB_APP_PRIVATE_KEY,
    privateKeyBase64: options.privateKeyBase64 ?? env.GITHUB_APP_PRIVATE_KEY_BASE64
  });

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials are required to list installation repositories.");
  }

  const resolvedAppId = appId;
  const resolvedPrivateKey = privateKey;
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl ?? env.GITHUB_API_URL);
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());

  async function mintInstallationToken(installationId: string) {
    const jwt = createGithubAppJwt({
      appId: resolvedAppId,
      privateKey: resolvedPrivateKey,
      now: now()
    });

    const response = await fetchImpl(
      `${apiBaseUrl}/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
          "x-github-api-version": GITHUB_API_VERSION
        }
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub App installation token request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as InstallationTokenResponse;
    if (!body.token || !body.expires_at) {
      throw new Error("GitHub App installation token response was incomplete.");
    }

    return body.token;
  }

  return {
    async listRepositories(installationId) {
      const normalizedInstallationId = readNonEmpty(installationId);
      if (!normalizedInstallationId) {
        throw new Error("installationId is required to list GitHub repositories.");
      }

      const token = await mintInstallationToken(normalizedInstallationId);
      const url = new URL(`${apiBaseUrl}/installation/repositories`);
      url.searchParams.set("per_page", "100");

      const response = await fetchImpl(url.toString(), {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": GITHUB_API_VERSION
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub installation repository request failed: ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as { repositories?: unknown[] };
      return (Array.isArray(body.repositories) ? body.repositories : [])
        .map(serializeRepository)
        .filter((repository): repository is GithubInstallationRepository => Boolean(repository));
    }
  };
}
