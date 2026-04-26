# Phase 9 GitHub App Worker Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable worker-side GitHub reconciliation to mint short-lived GitHub App installation tokens per repository installation without relying on shared personal access tokens.

**Architecture:** Add a focused worker auth module that resolves either static local-dev tokens or dynamic GitHub App credentials. Keep `github-client.ts` responsible for REST reads, but inject a `GithubTokenProvider` so each repository target can supply its own installation token.

**Tech Stack:** Node.js 20, TypeScript, node:test, Node `crypto`, Fetch API, GitHub REST API.

---

## File Structure

- Create `apps/worker/src/github-app-auth.ts`: GitHub token provider interfaces, environment credential resolution, private key normalization, JWT signing, installation token exchange, and in-memory cache.
- Create `apps/worker/src/github-app-auth.test.ts`: worker auth unit tests for static fallback, dynamic token exchange, cache refresh, and missing credentials.
- Create `apps/worker/src/github-client.test.ts`: client integration test proving the REST client asks the provider for a target-specific token.
- Modify `apps/worker/src/github-client.ts`: add `installationId` to `GithubClientTarget`, accept a `GithubTokenProvider`, and resolve tokens per snapshot request.
- Modify `.env.example`: document local fallback and production GitHub App worker credentials.

## Task 1: Add GitHub App Token Provider

**Files:**
- Create: `apps/worker/src/github-app-auth.ts`
- Create: `apps/worker/src/github-app-auth.test.ts`

- [ ] **Step 1: Write failing token provider tests**

Create `apps/worker/src/github-app-auth.test.ts` with:

```ts
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { createGithubTokenProvider, normalizeGithubAppPrivateKey } from "./github-app-auth";

function createPrivateKeyPem() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ format: "pem", type: "pkcs8" }).toString();
}

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 201,
    statusText: init.statusText,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });
}

void test("createGithubTokenProvider returns GITHUB_TOKEN as local developer fallback", async () => {
  const provider = createGithubTokenProvider({
    env: {
      GITHUB_TOKEN: "github_pat_dev"
    }
  });

  await assert.equal(
    await provider.getToken({
      fullName: "the-platform/platform-ops"
    }),
    "github_pat_dev"
  );
});

void test("createGithubTokenProvider returns GITHUB_APP_INSTALLATION_TOKEN as manual fallback", async () => {
  const provider = createGithubTokenProvider({
    env: {
      GITHUB_APP_INSTALLATION_TOKEN: "ghs_manual_installation"
    }
  });

  await assert.equal(
    await provider.getToken({
      fullName: "the-platform/platform-ops"
    }),
    "ghs_manual_installation"
  );
});

void test("normalizeGithubAppPrivateKey accepts escaped newlines and base64 input", () => {
  const privateKey = createPrivateKeyPem();
  assert.equal(normalizeGithubAppPrivateKey({ privateKey: privateKey.replaceAll("\n", "\\n") }), privateKey.trim());
  assert.equal(
    normalizeGithubAppPrivateKey({ privateKeyBase64: Buffer.from(privateKey).toString("base64") }),
    privateKey.trim()
  );
});

void test("dynamic GitHub App provider exchanges an app JWT for an installation token", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    fetch: async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return createJsonResponse({
        token: "ghs_installation_token",
        expires_at: "2026-04-26T13:00:00.000Z"
      });
    }
  });

  const token = await provider.getToken({
    fullName: "the-platform/platform-ops",
    installationId: "98765"
  });

  assert.equal(token, "ghs_installation_token");
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://github.test/app/installations/98765/access_tokens");
  assert.equal(requests[0]?.init.method, "POST");
  assert.match(String((requests[0]?.init.headers as Record<string, string>).authorization), /^Bearer [^.]+\.[^.]+\.[^.]+$/);
});

void test("dynamic GitHub App provider caches valid installation tokens per installation", async () => {
  let requestCount = 0;
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    fetch: async () => {
      requestCount += 1;
      return createJsonResponse({
        token: `ghs_installation_token_${requestCount}`,
        expires_at: "2026-04-26T13:00:00.000Z"
      });
    }
  });

  const target = {
    fullName: "the-platform/platform-ops",
    installationId: "98765"
  };

  assert.equal(await provider.getToken(target), "ghs_installation_token_1");
  assert.equal(await provider.getToken(target), "ghs_installation_token_1");
  assert.equal(requestCount, 1);
});

void test("dynamic GitHub App provider refreshes tokens inside the refresh window", async () => {
  let now = new Date("2026-04-26T12:00:00.000Z");
  let requestCount = 0;
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    cacheRefreshWindowMs: 5 * 60 * 1000,
    now: () => now,
    fetch: async () => {
      requestCount += 1;
      return createJsonResponse({
        token: `ghs_installation_token_${requestCount}`,
        expires_at: "2026-04-26T12:10:00.000Z"
      });
    }
  });

  const target = {
    fullName: "the-platform/platform-ops",
    installationId: "98765"
  };

  assert.equal(await provider.getToken(target), "ghs_installation_token_1");
  now = new Date("2026-04-26T12:06:00.000Z");
  assert.equal(await provider.getToken(target), "ghs_installation_token_2");
  assert.equal(requestCount, 2);
});

void test("dynamic GitHub App provider requires repository installation id", async () => {
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    fetch: async () => createJsonResponse({})
  });

  await assert.rejects(
    provider.getToken({
      fullName: "the-platform/platform-ops"
    }),
    /Missing GitHub installation id for the-platform\/platform-ops/
  );
});

void test("createGithubTokenProvider fails clearly when no worker credentials are configured", () => {
  assert.throws(
    () =>
      createGithubTokenProvider({
        env: {}
      }),
    /GITHUB_TOKEN, GITHUB_APP_INSTALLATION_TOKEN, or GitHub App credentials are required/
  );
});
```

- [ ] **Step 2: Run the auth tests and verify RED**

Run:

```bash
node --import tsx --test apps/worker/src/github-app-auth.test.ts
```

Expected: FAIL because `apps/worker/src/github-app-auth.ts` does not exist.

- [ ] **Step 3: Implement the token provider**

Create `apps/worker/src/github-app-auth.ts` with:

```ts
import { createSign } from "node:crypto";

export interface GithubTokenTarget {
  fullName: string;
  installationId?: string | null;
}

export interface GithubTokenProvider {
  getToken(target: GithubTokenTarget): Promise<string>;
}

export interface GithubTokenProviderOptions {
  token?: string;
  appId?: string;
  privateKey?: string;
  privateKeyBase64?: string;
  apiBaseUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  cacheRefreshWindowMs?: number;
  env?: Record<string, string | undefined>;
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

export function normalizeGithubAppPrivateKey(input: { privateKey?: string; privateKeyBase64?: string }) {
  const base64Value = readNonEmpty(input.privateKeyBase64);
  if (base64Value) {
    return Buffer.from(base64Value, "base64").toString("utf8").replaceAll("\\n", "\n").trim();
  }

  const privateKey = readNonEmpty(input.privateKey);
  return privateKey?.replaceAll("\\n", "\n").trim();
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
```

- [ ] **Step 4: Run auth tests and verify GREEN**

Run:

```bash
node --import tsx --test apps/worker/src/github-app-auth.test.ts
```

Expected: PASS for all `github-app-auth.test.ts` tests.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/worker/src/github-app-auth.ts apps/worker/src/github-app-auth.test.ts
git commit -m "feat: add github app token provider"
```

## Task 2: Wire Token Provider Into GitHub Client

**Files:**
- Create: `apps/worker/src/github-client.test.ts`
- Modify: `apps/worker/src/github-client.ts`

- [ ] **Step 1: Write failing client token provider test**

Create `apps/worker/src/github-client.test.ts` with:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { createGithubClient } from "./github-client";
import type { GithubTokenProvider } from "./github-app-auth";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

void test("createGithubClient resolves a repository token from the configured provider", async () => {
  const providerCalls: string[] = [];
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const tokenProvider: GithubTokenProvider = {
    getToken(target) {
      providerCalls.push(`${target.fullName}:${target.installationId ?? "none"}`);
      return Promise.resolve("ghs_repository_installation");
    }
  };

  const client = createGithubClient({
    baseUrl: "https://github.test",
    tokenProvider,
    fetch: async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return createJsonResponse([]);
    }
  });

  const snapshot = await client.getRepositorySnapshot({
    owner: "the-platform",
    name: "platform-ops",
    fullName: "the-platform/platform-ops",
    installationId: "installation-1"
  });

  assert.deepEqual(providerCalls, ["the-platform/platform-ops:installation-1"]);
  assert.equal(snapshot.pullRequests.length, 0);
  assert.equal(requests.length, 1);
  assert.equal(
    (requests[0]?.init.headers as Record<string, string>).authorization,
    "Bearer ghs_repository_installation"
  );
});
```

- [ ] **Step 2: Run the client test and verify RED**

Run:

```bash
node --import tsx --test apps/worker/src/github-client.test.ts
```

Expected: FAIL because `GithubRestClientOptions` does not accept `tokenProvider` and `GithubClientTarget` does not expose `installationId`.

- [ ] **Step 3: Modify `github-client.ts` for target-scoped token resolution**

Change `apps/worker/src/github-client.ts` to:

```ts
import { createGithubTokenProvider, type GithubTokenProvider } from "./github-app-auth";
```

Extend `GithubClientTarget`:

```ts
export interface GithubClientTarget {
  owner: string;
  name: string;
  fullName: string;
  installationId?: string | null;
}
```

Extend `GithubRestClientOptions`:

```ts
interface GithubRestClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  token?: string;
  tokenProvider?: GithubTokenProvider;
}
```

Remove the old `readToken` helper and update `createGithubClient`:

```ts
export function createGithubClient(options: GithubRestClientOptions = {}): GithubClient {
  const requestFetch = options.fetch ?? fetch;
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);
  const tokenProvider =
    options.tokenProvider ??
    createGithubTokenProvider({
      token: options.token,
      apiBaseUrl: baseUrl,
      fetch: requestFetch
    });

  return {
    async getRepositorySnapshot(target) {
      const token = await tokenProvider.getToken(target);
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
```

- [ ] **Step 4: Run client and auth tests**

Run:

```bash
node --import tsx --test apps/worker/src/github-client.test.ts apps/worker/src/github-app-auth.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 5: Run existing worker reconciliation tests**

Run:

```bash
node --import tsx --test apps/worker/src/github-reconcile.test.ts
```

Expected: PASS. Existing in-memory `GithubClient` implementations still satisfy the interface because `installationId` is optional.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add apps/worker/src/github-client.ts apps/worker/src/github-client.test.ts
git commit -m "feat: resolve github tokens per repository target"
```

## Task 3: Document Worker Credentials

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

Append this block after `GITHUB_WEBHOOK_SECRET=`:

```env

# GitHub worker reconciliation
# Local development fallback only. Use a fine-grained PAT with read-only repository access.
GITHUB_TOKEN=

# Manual one-off installation token fallback. Short-lived; not for long-running production workers.
GITHUB_APP_INSTALLATION_TOKEN=

# Production-style worker auth. Use these with repository installation_id rows to mint short-lived tokens.
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_PRIVATE_KEY_BASE64=
GITHUB_API_URL=https://api.github.com
```

- [ ] **Step 2: Verify docs diff is scoped**

Run:

```bash
git diff -- .env.example
```

Expected: Only GitHub worker credential examples changed.

- [ ] **Step 3: Commit Task 3**

Run:

```bash
git add .env.example
git commit -m "docs: document github worker credentials"
```

## Task 4: Final Verification And PR Prep

**Files:**
- Verify: `apps/worker/src/github-app-auth.ts`
- Verify: `apps/worker/src/github-client.ts`
- Verify: `.env.example`

- [ ] **Step 1: Run worker test suite**

Run:

```bash
npm test --workspace @the-platform/worker
```

Expected: all worker tests pass, including `github-app-auth.test.ts`, `github-client.test.ts`, `github-reconcile.test.ts`, and `notification-repair.test.ts`.

- [ ] **Step 2: Run worker lint**

Run:

```bash
npm run lint --workspace @the-platform/worker
```

Expected: ESLint exits 0 with no warnings.

- [ ] **Step 3: Run worker typecheck**

Run:

```bash
npm run typecheck --workspace @the-platform/worker
```

Expected: TypeScript exits 0.

- [ ] **Step 4: Run full repository tests**

Run:

```bash
npm test
```

Expected: all contract and workspace package tests pass.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git status --short
git diff --stat origin/main..HEAD
```

Expected: only Phase 9 worker auth files, `.env.example`, and Phase 9 docs are present.

- [ ] **Step 6: Push and create PR**

Run:

```bash
git push -u origin branch/phase9-github-app-worker-auth
gh pr create --base main --head branch/phase9-github-app-worker-auth --title "Phase 9 GitHub App worker auth" --body "$(cat <<'BODY'
## Summary
- Add worker-side GitHub App installation token minting with per-installation cache.
- Wire GitHub REST reconciliation through a target-scoped token provider.
- Document local PAT fallback and production-style GitHub App worker credentials.

## Test Plan
- npm test --workspace @the-platform/worker
- npm run lint --workspace @the-platform/worker
- npm run typecheck --workspace @the-platform/worker
- npm test
BODY
)"
```

Expected: branch is pushed and a ready PR URL is returned.

## Self-Review

- Spec coverage: The plan covers static fallback, GitHub App JWT minting, installation token exchange, cache behavior, missing installation id failure, client wiring, environment docs, and final verification.
- Scope control: The plan does not include GitHub App install UI, user OAuth linking, database schema changes, or webhook changes.
- Type consistency: `GithubTokenProvider`, `GithubTokenTarget`, and `GithubClientTarget.installationId` use the same optional `string | null` shape across tests and implementation.
