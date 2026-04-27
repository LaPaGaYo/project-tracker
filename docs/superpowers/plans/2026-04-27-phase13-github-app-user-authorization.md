# Phase 13 GitHub App User Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a short-lived GitHub App user authorization proof before a workspace admin can list or import repositories from a GitHub App installation.

**Architecture:** Add a server-only GitHub user authorization boundary: signed OAuth state, PKCE, transient user access token exchange, user-accessible installation/repository verification, and short-lived HTTP-only proof cookie. Existing Phase 12 installation-token listing remains server-authoritative, but projects/import code will only call it when the proof covers the current product user, workspace, installation, and selected repository id.

**Tech Stack:** Next.js 15 app routes/server actions, React 19, TypeScript, Node crypto, GitHub REST API, node:test contract tests, Vitest UI/action tests.

---

## File Structure

- Create `apps/web/src/server/github/user-authorization-state.ts`: HMAC-signed OAuth state, PKCE helpers, signed proof payloads, proof verification.
- Create `apps/web/src/server/github/user-authorization.ts`: GitHub App user authorization URL builder, OAuth code exchange, user profile fetch, user installation/repository fetch.
- Create `apps/web/src/server/github/user-authorization-flow.ts`: framework-light start/callback helpers used by app routes and contract tests.
- Create `apps/web/src/app/github/authorize/page.tsx`: starts GitHub App user authorization and writes the PKCE verifier cookie.
- Create `apps/web/src/app/github/authorize/callback/page.tsx`: completes GitHub App user authorization and writes the proof cookie.
- Modify `apps/web/src/server/github/setup.ts`: send setup callbacks with `installation_id` to `/github/authorize` instead of directly to projects.
- Modify `apps/web/src/app/github/setup/page.tsx`: keep the thin route wrapper around the updated setup helper.
- Modify `apps/web/src/app/workspaces/[slug]/projects/page.tsx`: require a valid proof before repository listing, then intersect app-installation repositories with proof repository ids.
- Modify `apps/web/src/server/github/installation-import.ts`: require proof before listing installation repositories, then require selected repository id to be covered by proof.
- Modify `apps/web/src/app/actions.ts`: read/verify proof cookie and pass proof to the installation import service.
- Modify `apps/web/src/features/github-import/github-import-panel.tsx`: render authorization, re-authorization, authorized, error, empty, and non-admin states.
- Modify `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx`: cover new panel states.
- Modify `apps/web/src/app/actions.test.ts`: mock cookie/proof verification and assert the proof reaches the import service.
- Create `tests/phase13-github-user-authorization.test.mjs`: contract tests for state/proof, GitHub user API client, setup redirect, callback helper, and proof-gated import.
- Modify `tests/phase12-github-installation-import.test.mjs`: pass a valid proof fixture into existing successful import tests and assert old non-admin behavior still short-circuits before GitHub.
- Modify `.env.example`: document GitHub App OAuth client id/secret, state secret, and optional GitHub web base URL.

## Task 1: State, PKCE, And Proof Primitives

**Files:**

- Create: `apps/web/src/server/github/user-authorization-state.ts`
- Test: `tests/phase13-github-user-authorization.test.mjs`

- [ ] **Step 1: Write failing contract tests for PKCE, signed state, and signed proof**

Add this initial test file:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  createGithubUserAuthorizationProof,
  createGithubUserAuthorizationState,
  createPkceChallenge,
  verifyGithubUserAuthorizationProof,
  verifyGithubUserAuthorizationState
} from "../apps/web/src/server/github/user-authorization-state.ts";

const fixedNow = new Date("2026-04-27T12:00:00.000Z");

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

test("github user authorization state is signed, expiring, and tamper-resistant", () => {
  const signedState = createGithubUserAuthorizationState(
    {
      workspaceSlug: "platform-ops",
      installationId: "987",
      returnPath: "/workspaces/platform-ops/projects?githubInstallationId=987",
      nonce: "nonce-state",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 10).toISOString()
    },
    "state-secret"
  );

  const verified = verifyGithubUserAuthorizationState(signedState, {
    secret: "state-secret",
    now: fixedNow
  });

  assert.equal(verified.status, "valid");
  assert.equal(verified.payload.workspaceSlug, "platform-ops");
  assert.equal(verified.payload.installationId, "987");

  assert.equal(
    verifyGithubUserAuthorizationState(`${signedState.slice(0, -1)}x`, {
      secret: "state-secret",
      now: fixedNow
    }).status,
    "invalid"
  );

  assert.equal(
    verifyGithubUserAuthorizationState(signedState, {
      secret: "state-secret",
      now: addMinutes(fixedNow, 11)
    }).status,
    "expired"
  );
});

test("pkce challenge uses SHA-256 base64url encoding", () => {
  assert.equal(createPkceChallenge("verifier-123"), "Ds3NpaREu9I2EYq6l0l3ZkFyv_Gt5O4EpGD6cZlY0Kg");
});

test("github user authorization proof is bound to user, workspace, installation, and repository ids", () => {
  const proof = createGithubUserAuthorizationProof(
    {
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      githubUserId: "12345",
      githubLogin: "henry",
      installationId: "987",
      allowedProviderRepositoryIds: ["42", "77"],
      nonce: "nonce-proof",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 15).toISOString()
    },
    "proof-secret"
  );

  assert.deepEqual(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987"
    }),
    {
      status: "valid",
      proof: {
        productUserId: "user-1",
        workspaceSlug: "platform-ops",
        githubUserId: "12345",
        githubLogin: "henry",
        installationId: "987",
        allowedProviderRepositoryIds: ["42", "77"],
        nonce: "nonce-proof",
        issuedAt: fixedNow.toISOString(),
        expiresAt: addMinutes(fixedNow, 15).toISOString()
      }
    }
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-2",
      workspaceSlug: "platform-ops",
      installationId: "987"
    }).status,
    "wrong_user"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "other-workspace",
      installationId: "987"
    }).status,
    "wrong_workspace"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "999"
    }).status,
    "wrong_installation"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
```

Expected: FAIL with `Cannot find module` for `user-authorization-state.ts`.

- [ ] **Step 3: Implement state, PKCE, and proof helpers**

Create `apps/web/src/server/github/user-authorization-state.ts` with these exports and behaviors:

```ts
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GITHUB_USER_AUTH_PKCE_COOKIE = "the_platform_github_user_auth_pkce";
export const GITHUB_USER_AUTH_PROOF_COOKIE = "the_platform_github_user_auth_proof";

export type GithubUserAuthorizationStateVerificationStatus = "valid" | "missing" | "invalid" | "expired";
export type GithubUserAuthorizationProofVerificationStatus =
  | "valid"
  | "missing"
  | "invalid"
  | "expired"
  | "wrong_user"
  | "wrong_workspace"
  | "wrong_installation";

export interface GithubUserAuthorizationStatePayload {
  workspaceSlug: string;
  installationId: string;
  returnPath: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface GithubUserAuthorizationProof {
  productUserId: string;
  workspaceSlug: string;
  githubUserId: string;
  githubLogin: string;
  installationId: string;
  allowedProviderRepositoryIds: string[];
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}
```

Use this signing shape:

```ts
function signPayload(payload: unknown, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}
```

Implement `verifySignedPayload()` with these checks:

```ts
function verifySignedPayload(value: string | null | undefined, secret: string) {
  if (!value) {
    return { status: "missing" as const };
  }

  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra !== undefined) {
    return { status: "invalid" as const };
  }

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { status: "invalid" as const };
  }

  try {
    return { status: "valid" as const, payload: JSON.parse(Buffer.from(body, "base64url").toString("utf8")) };
  } catch {
    return { status: "invalid" as const };
  }
}
```

Add `createPkceVerifier()`, `createPkceChallenge()`, `createGithubUserAuthorizationState()`, `verifyGithubUserAuthorizationState()`, `createGithubUserAuthorizationProof()`, and `verifyGithubUserAuthorizationProof()`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
```

Expected: PASS for the first three tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/web/src/server/github/user-authorization-state.ts tests/phase13-github-user-authorization.test.mjs
git commit -m "test: add github user authorization state contract"
```

## Task 2: GitHub User Authorization Client

**Files:**

- Create: `apps/web/src/server/github/user-authorization.ts`
- Modify: `tests/phase13-github-user-authorization.test.mjs`

- [ ] **Step 1: Add failing tests for OAuth URL, token exchange, user installations, and user repositories**

Append these tests:

```js
import {
  buildGithubAppUserAuthorizationUrl,
  createGithubUserAuthorizationClient,
  getGithubUserAuthorizationMissingConfiguration
} from "../apps/web/src/server/github/user-authorization.ts";

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: {
      "content-type": "application/json"
    }
  });
}

function serializeFetchUrl(url) {
  return typeof url === "string" ? url : url.url;
}

test("github app user authorization url includes client id, redirect uri, state, and pkce challenge", () => {
  const url = buildGithubAppUserAuthorizationUrl({
    clientId: "client-123",
    redirectUri: "http://localhost:3000/github/authorize/callback",
    state: "signed-state",
    codeChallenge: "challenge-123"
  });

  assert.equal(
    url,
    "https://github.com/login/oauth/authorize?client_id=client-123&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fgithub%2Fauthorize%2Fcallback&state=signed-state&code_challenge=challenge-123&code_challenge_method=S256"
  );
});

test("github user authorization client exchanges code and reads user installations and repositories", async () => {
  const calls = [];
  const client = createGithubUserAuthorizationClient({
    clientId: "client-123",
    clientSecret: "secret-456",
    apiBaseUrl: "https://api.github.test",
    githubBaseUrl: "https://github.test",
    fetch: async (url, init = {}) => {
      calls.push({ url: serializeFetchUrl(url), init });

      if (serializeFetchUrl(url) === "https://github.test/login/oauth/access_token") {
        return createJsonResponse({ access_token: "ghu_user", token_type: "bearer" });
      }

      if (serializeFetchUrl(url) === "https://api.github.test/user") {
        return createJsonResponse({ id: 12345, login: "henry" });
      }

      if (serializeFetchUrl(url) === "https://api.github.test/user/installations?per_page=100") {
        return createJsonResponse({
          installations: [
            {
              id: 987,
              account: { login: "the-platform" }
            }
          ]
        });
      }

      return createJsonResponse({
        repositories: [
          {
            id: 42,
            name: "platform-ops",
            full_name: "the-platform/platform-ops",
            default_branch: "main",
            private: true,
            html_url: "https://github.com/the-platform/platform-ops",
            owner: { login: "the-platform" }
          }
        ]
      });
    }
  });

  const token = await client.exchangeCodeForUserAccessToken({
    code: "oauth-code",
    redirectUri: "http://localhost:3000/github/authorize/callback",
    codeVerifier: "verifier-123"
  });
  const user = await client.getUser(token);
  const installations = await client.listUserInstallations(token);
  const repositories = await client.listUserInstallationRepositories(token, "987");

  assert.equal(token, "ghu_user");
  assert.deepEqual(user, { id: "12345", login: "henry" });
  assert.deepEqual(installations, [{ installationId: "987", accountLogin: "the-platform" }]);
  assert.equal(repositories[0].providerRepositoryId, "42");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.accept, "application/json");
  assert.match(String(calls[0].init.body), /client_id=client-123/);
  assert.equal(calls[1].init.headers.authorization, "Bearer ghu_user");
});

test("github user authorization missing configuration names required env vars", () => {
  assert.deepEqual(getGithubUserAuthorizationMissingConfiguration({}), [
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
    "GITHUB_USER_AUTH_STATE_SECRET"
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
```

Expected: FAIL with `Cannot find module` for `user-authorization.ts`.

- [ ] **Step 3: Implement GitHub user authorization client**

Create `apps/web/src/server/github/user-authorization.ts` with these exported signatures:

```ts
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
  listUserInstallations(userAccessToken: string): Promise<GithubUserInstallation[]>;
  listUserInstallationRepositories(
    userAccessToken: string,
    installationId: string
  ): Promise<GithubInstallationRepository[]>;
}
```

Implement `buildGithubAppUserAuthorizationUrl()` by building `new URL("/login/oauth/authorize", githubBaseUrl)` and setting `client_id`, `redirect_uri`, `state`, `code_challenge`, and `code_challenge_method=S256`.

Implement `createGithubUserAuthorizationClient()` with:

```ts
const GITHUB_API_VERSION = "2022-11-28";

function readNonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
```

For error messages, use step and HTTP status only:

```ts
throw new Error(`GitHub user token exchange failed: ${response.status} ${response.statusText}`);
```

Use `GET /user/installations?per_page=100` and `GET /user/installations/{installation_id}/repositories?per_page=100`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
```

Expected: PASS for state/proof and user client tests.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/web/src/server/github/user-authorization.ts tests/phase13-github-user-authorization.test.mjs
git commit -m "feat: add github user authorization client"
```

## Task 3: Setup Redirect And Authorization Flow Helpers

**Files:**

- Create: `apps/web/src/server/github/user-authorization-flow.ts`
- Modify: `apps/web/src/server/github/setup.ts`
- Modify: `tests/phase13-github-user-authorization.test.mjs`

- [ ] **Step 1: Add failing tests for setup redirect and callback completion**

Append:

```js
import {
  completeGithubUserAuthorization,
  prepareGithubUserAuthorizationRedirect
} from "../apps/web/src/server/github/user-authorization-flow.ts";
import { resolveGithubSetupRedirect } from "../apps/web/src/server/github/setup.ts";

test("setup redirect sends candidate installation to github user authorization", () => {
  const params = new URLSearchParams();
  params.set("state", "platform-ops");
  params.set("installation_id", "987");
  params.set("setup_action", "install");

  assert.equal(
    resolveGithubSetupRedirect(params),
    "/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987&githubSetupAction=install"
  );
});

test("authorization redirect helper returns github url and pkce verifier", () => {
  const prepared = prepareGithubUserAuthorizationRedirect({
    workspaceSlug: "platform-ops",
    installationId: "987",
    returnPath: "/workspaces/platform-ops/projects?githubInstallationId=987",
    appBaseUrl: "http://localhost:3000",
    githubBaseUrl: "https://github.test",
    clientId: "client-123",
    stateSecret: "state-secret",
    now: fixedNow,
    nonce: "nonce-state",
    pkceVerifier: "verifier-123"
  });

  assert.equal(prepared.pkceVerifier, "verifier-123");
  assert.match(prepared.authorizationUrl, /^https:\/\/github\.test\/login\/oauth\/authorize\?/);
  assert.match(prepared.authorizationUrl, /client_id=client-123/);
  assert.match(prepared.authorizationUrl, /code_challenge=Ds3NpaREu9I2EYq6l0l3ZkFyv_Gt5O4EpGD6cZlY0Kg/);
});

test("callback helper creates proof only for user-accessible installation repositories", async () => {
  const prepared = prepareGithubUserAuthorizationRedirect({
    workspaceSlug: "platform-ops",
    installationId: "987",
    returnPath: "/workspaces/platform-ops/projects?githubInstallationId=987",
    appBaseUrl: "http://localhost:3000",
    githubBaseUrl: "https://github.test",
    clientId: "client-123",
    stateSecret: "state-secret",
    now: fixedNow,
    nonce: "nonce-state",
    pkceVerifier: "verifier-123"
  });
  const state = new URL(prepared.authorizationUrl).searchParams.get("state");

  const result = await completeGithubUserAuthorization({
    code: "oauth-code",
    signedState: state,
    pkceVerifier: "verifier-123",
    session: {
      userId: "user-1",
      email: "henry@example.com",
      displayName: "Henry",
      provider: "demo"
    },
    stateSecret: "state-secret",
    appBaseUrl: "http://localhost:3000",
    now: fixedNow,
    client: {
      async exchangeCodeForUserAccessToken(input) {
        assert.equal(input.code, "oauth-code");
        assert.equal(input.redirectUri, "http://localhost:3000/github/authorize/callback");
        assert.equal(input.codeVerifier, "verifier-123");
        return "ghu_user";
      },
      async getUser(token) {
        assert.equal(token, "ghu_user");
        return { id: "12345", login: "henry" };
      },
      async listUserInstallations(token) {
        assert.equal(token, "ghu_user");
        return [{ installationId: "987", accountLogin: "the-platform" }];
      },
      async listUserInstallationRepositories(token, installationId) {
        assert.equal(token, "ghu_user");
        assert.equal(installationId, "987");
        return [
          {
            providerRepositoryId: "42",
            owner: "the-platform",
            name: "platform-ops",
            fullName: "the-platform/platform-ops",
            defaultBranch: "main",
            htmlUrl: "https://github.com/the-platform/platform-ops",
            isPrivate: true
          }
        ];
      }
    }
  });

  assert.equal(result.status, "success");
  assert.equal(result.redirectPath, "/workspaces/platform-ops/projects?githubInstallationId=987&githubAuthorized=1");
  assert.equal(
    verifyGithubUserAuthorizationProof(result.proofCookieValue, {
      secret: "state-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987"
    }).status,
    "valid"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
```

Expected: FAIL because `user-authorization-flow.ts` is missing and setup still redirects directly to projects.

- [ ] **Step 3: Implement setup redirect update**

Modify `resolveGithubSetupRedirect()`:

```ts
export function resolveGithubSetupRedirect(searchParams: URLSearchParams) {
  const state = searchParams.get("state")?.trim() ?? "";
  const installationId = searchParams.get("installation_id")?.trim() ?? "";
  const setupAction = searchParams.get("setup_action")?.trim() ?? "";

  if (!workspaceSlugPattern.test(state)) {
    return "/";
  }

  if (installationId) {
    const params = new URLSearchParams({
      workspaceSlug: state,
      githubInstallationId: installationId
    });
    if (setupAction) {
      params.set("githubSetupAction", setupAction);
    }
    return `/github/authorize?${params.toString()}`;
  }

  const params = new URLSearchParams();
  if (setupAction) {
    params.set("githubSetupAction", setupAction);
  }

  const query = params.toString();
  return `/workspaces/${state}/projects${query ? `?${query}` : ""}`;
}
```

- [ ] **Step 4: Implement authorization flow helpers**

Create `apps/web/src/server/github/user-authorization-flow.ts` with these exported functions:

```ts
export function buildGithubUserAuthorizationCallbackUrl(appBaseUrl: string) {
  return new URL("/github/authorize/callback", appBaseUrl).toString();
}

export function buildGithubProjectsReturnPath(workspaceSlug: string, installationId: string, params?: URLSearchParams) {
  const returnParams = new URLSearchParams(params);
  returnParams.set("githubInstallationId", installationId);
  const query = returnParams.toString();
  return `/workspaces/${workspaceSlug}/projects${query ? `?${query}` : ""}`;
}
```

Implement `prepareGithubUserAuthorizationRedirect()` to return:

```ts
{
  authorizationUrl: string;
  pkceVerifier: string;
}
```

Implement `completeGithubUserAuthorization()` to return:

```ts
type CompleteGithubUserAuthorizationResult =
  | { status: "success"; redirectPath: string; proofCookieValue: string; proofMaxAgeSeconds: number }
  | { status: "error"; redirectPath: string; errorCode: string };
```

Use exact error codes from the spec: `state_invalid`, `state_expired`, `pkce_missing`, `token_exchange_failed`, `installation_inaccessible`, `repositories_inaccessible`.

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
```

Expected: PASS through setup redirect and flow helper tests.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/web/src/server/github/setup.ts apps/web/src/server/github/user-authorization-flow.ts tests/phase13-github-user-authorization.test.mjs
git commit -m "feat: add github user authorization flow helpers"
```

## Task 4: Next Routes And Environment Documentation

**Files:**

- Create: `apps/web/src/app/github/authorize/page.tsx`
- Create: `apps/web/src/app/github/authorize/callback/page.tsx`
- Modify: `.env.example`

- [ ] **Step 1: Add environment documentation**

Modify `.env.example`:

```dotenv
# GitHub App user authorization. Client ID is different from GITHUB_APP_ID.
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_USER_AUTH_STATE_SECRET=
GITHUB_BASE_URL=https://github.com
```

- [ ] **Step 2: Create authorization start route**

Create `apps/web/src/app/github/authorize/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth";
import { getGithubUserAuthorizationMissingConfiguration } from "@/server/github/user-authorization";
import { prepareGithubUserAuthorizationRedirect } from "@/server/github/user-authorization-flow";
import { GITHUB_USER_AUTH_PKCE_COOKIE } from "@/server/github/user-authorization-state";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { requireWorkspaceMembership } from "@/server/workspaces/core";

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export default async function GithubAuthorizePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const workspaceSlug = readParam(params.workspaceSlug).trim();
  const installationId = readParam(params.githubInstallationId).trim();
  const workspaceRepository = createWorkspaceRepository();
  const workspace = await workspaceRepository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace || !installationId) {
    redirect("/");
  }

  await requireWorkspaceMembership(workspaceRepository, session, workspace.id, "admin");

  const returnPath = `/workspaces/${workspaceSlug}/projects?githubInstallationId=${encodeURIComponent(installationId)}`;
  if (getGithubUserAuthorizationMissingConfiguration().length > 0) {
    redirect(returnPath);
  }

  const prepared = prepareGithubUserAuthorizationRedirect({
    workspaceSlug,
    installationId,
    returnPath,
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    githubBaseUrl: process.env.GITHUB_BASE_URL,
    clientId: process.env.GITHUB_APP_CLIENT_ID ?? "",
    stateSecret: process.env.GITHUB_USER_AUTH_STATE_SECRET ?? ""
  });

  const cookieStore = await cookies();
  cookieStore.set(GITHUB_USER_AUTH_PKCE_COOKIE, prepared.pkceVerifier, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/github/authorize/callback",
    sameSite: "lax",
    secure: isSecureCookie()
  });

  redirect(prepared.authorizationUrl);
}
```

- [ ] **Step 3: Create authorization callback route**

Create `apps/web/src/app/github/authorize/callback/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth";
import { createGithubUserAuthorizationClient } from "@/server/github/user-authorization";
import { completeGithubUserAuthorization } from "@/server/github/user-authorization-flow";
import {
  GITHUB_USER_AUTH_PKCE_COOKIE,
  GITHUB_USER_AUTH_PROOF_COOKIE
} from "@/server/github/user-authorization-state";

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export default async function GithubAuthorizeCallbackPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  const pkceVerifier = cookieStore.get(GITHUB_USER_AUTH_PKCE_COOKIE)?.value ?? "";
  cookieStore.delete(GITHUB_USER_AUTH_PKCE_COOKIE);

  const params = await searchParams;
  const result = await completeGithubUserAuthorization({
    code: readParam(params.code).trim(),
    signedState: readParam(params.state).trim(),
    pkceVerifier,
    session,
    stateSecret: process.env.GITHUB_USER_AUTH_STATE_SECRET,
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    client: createGithubUserAuthorizationClient()
  });

  if (result.status === "success") {
    cookieStore.set(GITHUB_USER_AUTH_PROOF_COOKIE, result.proofCookieValue, {
      httpOnly: true,
      maxAge: result.proofMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: isSecureCookie()
    });
  }

  redirect(result.redirectPath);
}
```

- [ ] **Step 4: Run route typecheck**

Run:

```bash
npm run typecheck --workspace @the-platform/web
```

Expected: PASS, or FAIL only on route-specific typing that is fixed before continuing.

- [ ] **Step 5: Commit Task 4**

```bash
git add .env.example apps/web/src/app/github/authorize/page.tsx apps/web/src/app/github/authorize/callback/page.tsx
git commit -m "feat: add github user authorization routes"
```

## Task 5: Gate Projects Page Repository Listing

**Files:**

- Modify: `apps/web/src/app/workspaces/[slug]/projects/page.tsx`
- Modify: `apps/web/src/features/github-import/github-import-panel.tsx`
- Modify: `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx`

- [ ] **Step 1: Add failing UI tests for authorization states**

Update the existing "install CTA before a GitHub installation is active" render with these new props:

```tsx
authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
authorizationStatus="not_required"
authorizationErrorCode={null}
authorizedGithubLogin={null}
```

Update existing renders that include `installationId="987"` and should reach repository picker, empty, or repository loading error states with these props:

```tsx
authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
authorizationStatus="authorized"
authorizationErrorCode={null}
authorizedGithubLogin="henry"
```

Add tests:

```tsx
it("renders an authorize CTA when installation exists without a valid GitHub user proof", () => {
  render(
    <GithubImportPanel
      workspaceSlug="platform-ops"
      canImport
      installUrl={installUrl}
      authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
      authorizationStatus="missing"
      authorizationErrorCode={null}
      authorizedGithubLogin={null}
      installationId="987"
      repositories={[]}
      errorMessage={null}
      missingConfiguration={[]}
    />
  );

  expect(screen.getByText("GitHub user authorization is required.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Authorize GitHub access" })).toHaveAttribute(
    "href",
    "/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
  );
  expect(screen.queryByRole("button", { name: "Import selected repository" })).not.toBeInTheDocument();
});

it("renders authorized identity next to the repository picker", () => {
  render(
    <GithubImportPanel
      workspaceSlug="platform-ops"
      canImport
      installUrl={installUrl}
      authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
      authorizationStatus="authorized"
      authorizationErrorCode={null}
      authorizedGithubLogin="henry"
      installationId="987"
      repositories={repositories}
      errorMessage={null}
      missingConfiguration={[]}
    />
  );

  expect(screen.getByText("Authorized as henry")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Import selected repository" })).toBeEnabled();
});
```

- [ ] **Step 2: Run panel tests to verify they fail**

Run:

```bash
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
```

Expected: FAIL because the new props/states are not implemented.

- [ ] **Step 3: Implement panel props and states**

Add prop types:

```ts
type GithubAuthorizationStatus = "not_required" | "missing" | "expired" | "invalid" | "error" | "authorized";
```

Add props:

```ts
authorizationUrl: string | null;
authorizationStatus: GithubAuthorizationStatus;
authorizationErrorCode: string | null;
authorizedGithubLogin: string | null;
```

Render authorization gating before repository error/empty states:

```tsx
) : installationId && authorizationStatus !== "authorized" ? (
  <StateCard>
    <p className="font-semibold text-planka-text">
      {authorizationStatus === "expired" ? "GitHub authorization expired." : "GitHub user authorization is required."}
    </p>
    <p className="mt-2">
      Authorize the GitHub App as a user who can access this installation before importing repositories.
    </p>
    {authorizationErrorCode ? <p className="mt-2">Authorization failed: {authorizationErrorCode}</p> : null}
    <div className="mt-4">
      <InstallLink
        href={authorizationUrl}
        label={authorizationStatus === "expired" ? "Re-authorize GitHub access" : "Authorize GitHub access"}
      />
    </div>
  </StateCard>
) : errorMessage ? (
```

Render the authorized identity above repository choices:

```tsx
{authorizedGithubLogin ? (
  <p className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted">
    Authorized as {authorizedGithubLogin}
  </p>
) : null}
```

- [ ] **Step 4: Gate repository listing in projects page**

Import cookies and proof helpers:

```ts
import { cookies } from "next/headers";
import {
  GITHUB_USER_AUTH_PROOF_COOKIE,
  verifyGithubUserAuthorizationProof,
  type GithubUserAuthorizationProofVerificationStatus
} from "@/server/github/user-authorization-state";
import { getGithubUserAuthorizationMissingConfiguration } from "@/server/github/user-authorization";
```

Build authorization URL:

```ts
function resolveGithubAuthorizationUrl(workspaceSlug: string, installationId: string | null) {
  if (!installationId) {
    return null;
  }

  const params = new URLSearchParams({
    workspaceSlug,
    githubInstallationId: installationId
  });
  return `/github/authorize?${params.toString()}`;
}
```

Before listing repositories:

```ts
const missingConfiguration = [
  ...getGithubAppMissingConfiguration(),
  ...getGithubUserAuthorizationMissingConfiguration()
];
const cookieStore = await cookies();
const proofResult = githubInstallationId
  ? verifyGithubUserAuthorizationProof(cookieStore.get(GITHUB_USER_AUTH_PROOF_COOKIE)?.value, {
      secret: process.env.GITHUB_USER_AUTH_STATE_SECRET,
      now: new Date(),
      productUserId: session.userId,
      workspaceSlug: slug,
      installationId: githubInstallationId
    })
  : { status: "missing" as GithubUserAuthorizationProofVerificationStatus };
```

Only fetch installation repositories when `proofResult.status === "valid"`. Filter by proof:

```ts
if (proofResult.status === "valid") {
  const allowedRepositoryIds = new Set(proofResult.proof.allowedProviderRepositoryIds);
  githubRepositories = repositories.filter((repository) => allowedRepositoryIds.has(repository.providerRepositoryId));
}
```

Map proof verification into UI status:

```ts
const githubAuthorizationError = readSearchParam(resolvedSearchParams.githubAuthorizationError);
const authorizationStatus = !githubInstallationId
  ? "not_required"
  : githubAuthorizationError
    ? "error"
    : proofResult.status === "valid"
      ? "authorized"
      : proofResult.status === "expired"
        ? "expired"
        : proofResult.status === "invalid"
          ? "invalid"
          : "missing";
const authorizedGithubLogin = proofResult.status === "valid" ? proofResult.proof.githubLogin : null;
```

Pass `authorizationStatus`, `authorizationUrl`, `authorizationErrorCode`, and `authorizedGithubLogin` to `GithubImportPanel`.

- [ ] **Step 5: Run panel tests and web typecheck**

Run:

```bash
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
npm run typecheck --workspace @the-platform/web
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/web/src/app/workspaces/[slug]/projects/page.tsx apps/web/src/features/github-import/github-import-panel.tsx apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx
git commit -m "feat: gate github repository listing by user authorization"
```

## Task 6: Enforce Proof In Import Service And Server Action

**Files:**

- Modify: `apps/web/src/server/github/installation-import.ts`
- Modify: `apps/web/src/app/actions.ts`
- Modify: `apps/web/src/app/actions.test.ts`
- Modify: `tests/phase12-github-installation-import.test.mjs`
- Modify: `tests/phase13-github-user-authorization.test.mjs`

- [ ] **Step 1: Add failing import authorization tests**

In `tests/phase13-github-user-authorization.test.mjs`, add:

```js
import { importGithubInstallationRepositoryForUser } from "../apps/web/src/server/github/installation-import.ts";
import { createGithubConnectionRepository } from "../apps/web/src/server/github/repository.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import { createWorkspaceRepository } from "../apps/web/src/server/workspaces/repository.ts";
import { createWorkspaceForUser } from "../apps/web/src/server/workspaces/service.ts";
import { sql } from "../packages/db/src/client.ts";

function createSession(userId, email) {
  return { userId, email, displayName: email, provider: "demo" };
}

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createPersistedHarness(t) {
  const repositories = {
    githubRepository: createGithubConnectionRepository(),
    projectRepository: createProjectRepository(),
    workItemRepository: createWorkItemRepository(),
    workspaceRepository: createWorkspaceRepository()
  };
  const workspaceIds = [];

  t.after(async () => {
    for (const workspaceId of workspaceIds) {
      await sql`delete from workspaces where id = ${workspaceId}`;
    }
  });

  return {
    repositories,
    async createWorkspace(session, label) {
      const suffix = uniqueSuffix();
      const workspace = await createWorkspaceForUser(repositories.workspaceRepository, session, {
        name: `${label} ${suffix}`,
        slug: `${label.toLowerCase()}-${suffix}`
      });
      workspaceIds.push(workspace.id);
      return workspace;
    }
  };
}

test("installation import rejects missing github user authorization proof before calling GitHub", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createSession(`admin-${uniqueSuffix()}`, "admin@example.com");
  const workspace = await harness.createWorkspace(admin, "phase13-missing-proof");
  let githubWasCalled = false;

  await assert.rejects(
    importGithubInstallationRepositoryForUser(
      {
        projectRepository: harness.repositories.projectRepository,
        githubRepository: harness.repositories.githubRepository,
        installationClient: {
          async listRepositories() {
            githubWasCalled = true;
            return [];
          }
        },
        authorizationProof: null
      },
      admin,
      workspace.slug,
      "987",
      { providerRepositoryId: "42", projectName: "Platform Ops", key: "P13" }
    ),
    /GitHub user authorization is required/
  );

  assert.equal(githubWasCalled, false);
});

test("installation import rejects repositories not covered by proof", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createSession(`admin-${uniqueSuffix()}`, "admin@example.com");
  const workspace = await harness.createWorkspace(admin, "phase13-proof-repo");

  await assert.rejects(
    importGithubInstallationRepositoryForUser(
      {
        projectRepository: harness.repositories.projectRepository,
        githubRepository: harness.repositories.githubRepository,
        installationClient: {
          async listRepositories() {
            return [
              {
                providerRepositoryId: "42",
                owner: "the-platform",
                name: "platform-ops",
                fullName: "the-platform/platform-ops",
                defaultBranch: "main",
                htmlUrl: "https://github.com/the-platform/platform-ops",
                isPrivate: true
              }
            ];
          }
        },
        authorizationProof: {
          productUserId: admin.userId,
          workspaceSlug: workspace.slug,
          githubUserId: "12345",
          githubLogin: "henry",
          installationId: "987",
          allowedProviderRepositoryIds: ["77"],
          nonce: "nonce-proof",
          issuedAt: fixedNow.toISOString(),
          expiresAt: addMinutes(fixedNow, 15).toISOString()
        }
      },
      admin,
      workspace.slug,
      "987",
      { providerRepositoryId: "42", projectName: "Platform Ops", key: "P13" }
    ),
    /selected repository is not authorized for this GitHub user/
  );
});
```

- [ ] **Step 2: Run contract tests to verify they fail**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
```

Expected: FAIL because `authorizationProof` is not part of the import service dependencies.

- [ ] **Step 3: Update import service to require proof**

Modify dependencies:

```ts
import type { GithubUserAuthorizationProof } from "./user-authorization-state";

dependencies: {
  projectRepository: ProjectRepository;
  githubRepository: GithubConnectionRepository;
  installationClient: GithubAppInstallationClient;
  authorizationProof: GithubUserAuthorizationProof | null;
}
```

After resolving `installationId`, add:

```ts
const proof = dependencies.authorizationProof;
if (!proof) {
  throw new WorkspaceError(403, "GitHub user authorization is required before importing repositories.");
}

if (
  proof.productUserId !== session.userId ||
  proof.workspaceSlug !== workspaceSlug ||
  proof.installationId !== installationId
) {
  throw new WorkspaceError(403, "GitHub user authorization does not match this import request.");
}
```

After selected repository lookup:

```ts
if (!proof.allowedProviderRepositoryIds.includes(providerRepositoryId)) {
  throw new WorkspaceError(403, "selected repository is not authorized for this GitHub user.");
}
```

- [ ] **Step 4: Update Phase 12 tests to pass proof fixtures**

Add helper in `tests/phase12-github-installation-import.test.mjs`:

```js
function authorizationProofFixture(session, workspaceSlug, installationId, allowedProviderRepositoryIds = ["42"]) {
  return {
    productUserId: session.userId,
    workspaceSlug,
    githubUserId: "12345",
    githubLogin: "henry",
    installationId,
    allowedProviderRepositoryIds,
    nonce: `proof-${uniqueSuffix()}`,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
  };
}
```

In every successful service call dependency object, add:

```js
authorizationProof: authorizationProofFixture(admin, workspace.slug, "987", ["42"])
```

For non-admin tests, pass `authorizationProof: null` and assert the installation client was not called.

- [ ] **Step 5: Update server action to verify proof cookie**

In `apps/web/src/app/actions.ts`, import:

```ts
import { cookies } from "next/headers";
import {
  GITHUB_USER_AUTH_PROOF_COOKIE,
  verifyGithubUserAuthorizationProof
} from "@/server/github/user-authorization-state";
```

Inside `importInstalledGithubRepositoryAction()` after session:

```ts
const cookieStore = await cookies();
const proofResult = verifyGithubUserAuthorizationProof(cookieStore.get(GITHUB_USER_AUTH_PROOF_COOKIE)?.value, {
  secret: process.env.GITHUB_USER_AUTH_STATE_SECRET,
  now: new Date(),
  productUserId: session.userId,
  workspaceSlug,
  installationId
});
```

Pass `authorizationProof: proofResult.status === "valid" ? proofResult.proof : null`.

- [ ] **Step 6: Update action test mock**

In `apps/web/src/app/actions.test.ts`, add:

```ts
const cookiesMock = vi.hoisted(() => vi.fn());
const verifyGithubUserAuthorizationProofMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("@/server/github/user-authorization-state", () => ({
  GITHUB_USER_AUTH_PROOF_COOKIE: "the_platform_github_user_auth_proof",
  verifyGithubUserAuthorizationProof: verifyGithubUserAuthorizationProofMock
}));
```

In `beforeEach()`:

```ts
cookiesMock.mockResolvedValue({
  get: vi.fn().mockReturnValue({ value: "signed-proof" })
});
verifyGithubUserAuthorizationProofMock.mockReturnValue({
  status: "valid",
  proof: {
    productUserId: "henry",
    workspaceSlug: "platform-ops",
    githubUserId: "12345",
    githubLogin: "henry-gh",
    installationId: "987",
    allowedProviderRepositoryIds: ["42"],
    nonce: "nonce-proof",
    issuedAt: "2026-04-27T12:00:00.000Z",
    expiresAt: "2026-04-27T12:15:00.000Z"
  }
});
```

Update the expected dependency object to include `authorizationProof`.

- [ ] **Step 7: Run targeted tests**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
node --import tsx --test tests/phase12-github-installation-import.test.mjs
npm test --workspace @the-platform/web -- src/app/actions.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add apps/web/src/server/github/installation-import.ts apps/web/src/app/actions.ts apps/web/src/app/actions.test.ts tests/phase12-github-installation-import.test.mjs tests/phase13-github-user-authorization.test.mjs
git commit -m "feat: require github user proof for installation imports"
```

## Task 7: Final Verification, Review, And PR Readiness

**Files:**

- Verify all files touched in Tasks 1-6.

- [ ] **Step 1: Run full verification**

Run:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
node --import tsx --test tests/phase12-github-installation-import.test.mjs
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
npm test --workspace @the-platform/web -- src/app/actions.test.ts
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all commands PASS.

- [ ] **Step 2: Inspect diff for token exposure and unsafe errors**

Run:

```bash
git diff origin/main...HEAD -- apps/web/src/server/github apps/web/src/app/github apps/web/src/app/actions.ts apps/web/src/app/workspaces/[slug]/projects/page.tsx apps/web/src/features/github-import/github-import-panel.tsx tests/phase13-github-user-authorization.test.mjs
```

Check these exact constraints:

- No GitHub user access token is written to a cookie.
- No refresh token is stored.
- No OAuth code is included in UI copy.
- No GitHub API response body is included in thrown errors from token exchange.
- Import service checks workspace role before calling GitHub.
- Import service rejects missing proof before minting installation tokens.

- [ ] **Step 3: Commit verification note if docs changed during implementation**

If implementation changes the plan or spec, commit the docs with:

```bash
git add docs/superpowers/specs/2026-04-27-phase13-github-app-user-authorization-design.md docs/superpowers/plans/2026-04-27-phase13-github-app-user-authorization.md
git commit -m "docs: update phase13 github authorization notes"
```

If no docs changed, skip this commit.

- [ ] **Step 4: Prepare PR**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: clean worktree and a readable commit series for Phase 13.
