import { createSign } from "node:crypto";

export interface GithubTokenTarget {
  fullName: string;
  installationId?: string | null;
}

export interface GithubTokenProvider {
  getToken(target: GithubTokenTarget): Promise<string>;
}

export interface GithubTokenProviderOptions {
  token?: string | undefined;
  appId?: string | undefined;
  privateKey?: string | undefined;
  privateKeyBase64?: string | undefined;
  apiBaseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
  now?: (() => Date) | undefined;
  cacheRefreshWindowMs?: number | undefined;
  env?: Record<string, string | undefined> | undefined;
}

interface InstallationTokenResponse {
  token?: string;
  expires_at?: string;
}

interface CachedInstallationToken {
  token: string;
  expiresAtMs: number;
}

const GITHUB_API_VERSION = "2022-11-28";
const DEFAULT_CACHE_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const APP_JWT_TTL_SECONDS = 9 * 60;
const APP_JWT_CLOCK_SKEW_SECONDS = 60;

function normalizeApiBaseUrl(baseUrl: string | undefined) {
  return (baseUrl ?? "https://api.github.com").replace(/\/+$/, "");
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function readNonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
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

function createStaticGithubTokenProvider(token: string): GithubTokenProvider {
  return {
    getToken: () => Promise.resolve(token)
  };
}

function createGithubAppInstallationTokenProvider(input: {
  appId: string;
  privateKey: string;
  apiBaseUrl: string;
  fetch: typeof fetch;
  now: () => Date;
  cacheRefreshWindowMs: number;
}): GithubTokenProvider {
  const cache = new Map<string, CachedInstallationToken>();

  async function mintInstallationToken(target: GithubTokenTarget) {
    if (!target.installationId) {
      throw new Error(`Missing GitHub installation id for ${target.fullName}. Reconnect the GitHub repository.`);
    }

    const jwt = createGithubAppJwt({
      appId: input.appId,
      privateKey: input.privateKey,
      now: input.now()
    });

    const response = await input.fetch(
      `${input.apiBaseUrl}/app/installations/${encodeURIComponent(target.installationId)}/access_tokens`,
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
      throw new Error(
        `GitHub App installation token request failed for ${target.fullName}: ${response.status} ${response.statusText}`
      );
    }

    const body = (await response.json()) as InstallationTokenResponse;
    if (!body.token || !body.expires_at) {
      throw new Error(`GitHub App installation token response was incomplete for ${target.fullName}.`);
    }

    return {
      token: body.token,
      expiresAtMs: Date.parse(body.expires_at)
    };
  }

  return {
    async getToken(target) {
      if (!target.installationId) {
        throw new Error(`Missing GitHub installation id for ${target.fullName}. Reconnect the GitHub repository.`);
      }

      const cached = cache.get(target.installationId);
      if (cached && cached.expiresAtMs - input.now().getTime() > input.cacheRefreshWindowMs) {
        return cached.token;
      }

      const nextToken = await mintInstallationToken(target);
      cache.set(target.installationId, nextToken);
      return nextToken.token;
    }
  };
}

export function createGithubTokenProvider(options: GithubTokenProviderOptions = {}): GithubTokenProvider {
  const env = options.env ?? process.env;
  const staticToken =
    readNonEmpty(options.token) ??
    readNonEmpty(env.GITHUB_TOKEN) ??
    readNonEmpty(env.GITHUB_APP_INSTALLATION_TOKEN);

  if (staticToken) {
    return createStaticGithubTokenProvider(staticToken);
  }

  const appId = readNonEmpty(options.appId) ?? readNonEmpty(env.GITHUB_APP_ID);
  const privateKey = normalizeGithubAppPrivateKey({
    privateKey: options.privateKey ?? env.GITHUB_APP_PRIVATE_KEY,
    privateKeyBase64: options.privateKeyBase64 ?? env.GITHUB_APP_PRIVATE_KEY_BASE64
  });

  if (!appId || !privateKey) {
    throw new Error(
      "GITHUB_TOKEN, GITHUB_APP_INSTALLATION_TOKEN, or GitHub App credentials are required for worker reconciliation."
    );
  }

  return createGithubAppInstallationTokenProvider({
    appId,
    privateKey,
    apiBaseUrl: normalizeApiBaseUrl(options.apiBaseUrl ?? env.GITHUB_API_URL),
    fetch: options.fetch ?? fetch,
    now: options.now ?? (() => new Date()),
    cacheRefreshWindowMs: options.cacheRefreshWindowMs ?? DEFAULT_CACHE_REFRESH_WINDOW_MS
  });
}
