import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createGithubUserAuthorizationProof,
  createGithubUserAuthorizationState,
  createPkceChallenge,
  verifyGithubUserAuthorizationProof,
  verifyGithubUserAuthorizationState,
} from "../apps/web/src/server/github/user-authorization-state.ts";
import {
  buildGithubAppUserAuthorizationUrl,
  createGithubUserAuthorizationClient,
  getGithubUserAuthorizationMissingConfiguration,
} from "../apps/web/src/server/github/user-authorization.ts";
import {
  buildGithubProjectsReturnPath,
  completeGithubUserAuthorization,
  prepareGithubUserAuthorizationRedirect,
} from "../apps/web/src/server/github/user-authorization-flow.ts";
import { importGithubInstallationRepositoryForUser } from "../apps/web/src/server/github/installation-import.ts";
import { createGithubConnectionRepository } from "../apps/web/src/server/github/repository.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createWorkspaceRepository } from "../apps/web/src/server/workspaces/repository.ts";
import { resolveGithubSetupRedirect } from "../apps/web/src/server/github/setup.ts";
import { sql } from "../packages/db/src/client.ts";

const fixedNow = new Date("2026-04-27T12:00:00.000Z");

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function signRawBody(body, secret) {
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function createSignedInvalidJson(secret) {
  return signRawBody(Buffer.from("{").toString("base64url"), secret);
}

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function serializeFetchUrl(url) {
  return typeof url === "string" ? url : url.url;
}

function createSession(userId = "user-1", email = "henry@example.com") {
  return {
    userId,
    email,
    displayName: "Henry",
    provider: "demo",
  };
}

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createRepositories() {
  return {
    githubRepository: createGithubConnectionRepository(),
    projectRepository: createProjectRepository(),
    workspaceRepository: createWorkspaceRepository(),
  };
}

function createPersistedHarness(t) {
  const repositories = createRepositories();
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
      const workspace = await repositories.workspaceRepository.createWorkspace({
        name: `${label} ${suffix}`,
        slug: `${label.toLowerCase()}-${suffix}`,
      });
      await repositories.workspaceRepository.addMembership({
        workspaceId: workspace.id,
        userId: session.userId,
        role: "owner",
      });
      workspaceIds.push(workspace.id);
      return workspace;
    },
  };
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

function createFlowState({
  workspaceSlug = "platform-ops",
  installationId = "987",
  returnPath = "/workspaces/platform-ops/projects?githubInstallationId=987",
  issuedAt = fixedNow,
  expiresAt = addMinutes(fixedNow, 10),
} = {}) {
  return createGithubUserAuthorizationState(
    {
      workspaceSlug,
      installationId,
      returnPath,
      nonce: "nonce-state",
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    "state-secret"
  );
}

function createAuthorizationClient(overrides = {}) {
  return {
    async exchangeCodeForUserAccessToken() {
      return "ghu_user";
    },
    async getUser() {
      return { id: "12345", login: "henry" };
    },
    async listUserInstallations() {
      return [{ installationId: "987", accountLogin: "the-platform" }];
    },
    async listUserInstallationRepositories() {
      return [
        {
          providerRepositoryId: "42",
          owner: "the-platform",
          name: "platform-ops",
          fullName: "the-platform/platform-ops",
          defaultBranch: "main",
          htmlUrl: "https://github.com/the-platform/platform-ops",
          isPrivate: true,
        },
      ];
    },
    ...overrides,
  };
}

async function completeFlow(overrides = {}) {
  return completeGithubUserAuthorization({
    code: "oauth-code",
    signedState: createFlowState(),
    pkceVerifier: "verifier-123",
    session: createSession(),
    stateSecret: "state-secret",
    appBaseUrl: "http://localhost:3000",
    now: fixedNow,
    client: createAuthorizationClient(),
    ...overrides,
  });
}

function assertNoUnsafeRedirectParams(redirectPath) {
  const searchParams = new URL(redirectPath, "http://local.test").searchParams;

  for (const param of ["code", "access_token", "token", "state"]) {
    assert.equal(searchParams.has(param), false, param);
  }
}

test("github user authorization state is signed, expiring, and tamper-resistant", () => {
  const signedState = createGithubUserAuthorizationState(
    {
      workspaceSlug: "platform-ops",
      installationId: "987",
      returnPath: "/workspaces/platform-ops/projects?githubInstallationId=987",
      nonce: "nonce-state",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 10).toISOString(),
    },
    "state-secret"
  );

  const verified = verifyGithubUserAuthorizationState(signedState, {
    secret: "state-secret",
    now: fixedNow,
  });

  assert.equal(verified.status, "valid");
  assert.equal(verified.payload.workspaceSlug, "platform-ops");
  assert.equal(verified.payload.installationId, "987");

  assert.equal(
    verifyGithubUserAuthorizationState(`${signedState.slice(0, -1)}x`, {
      secret: "state-secret",
      now: fixedNow,
    }).status,
    "invalid"
  );

  assert.equal(
    verifyGithubUserAuthorizationState(signedState, {
      secret: "state-secret",
      now: addMinutes(fixedNow, 11),
    }).status,
    "expired"
  );
});

test("github user authorization state rejects signed malformed payloads", () => {
  const malformedState = createGithubUserAuthorizationState(
    {
      expiresAt: addMinutes(fixedNow, 10).toISOString(),
    },
    "state-secret"
  );

  assert.equal(
    verifyGithubUserAuthorizationState(malformedState, {
      secret: "state-secret",
      now: fixedNow,
    }).status,
    "invalid"
  );
});

test("github user authorization state rejects missing and invalid signed values", () => {
  const validState = createGithubUserAuthorizationState(
    {
      workspaceSlug: "platform-ops",
      installationId: "987",
      returnPath: "/workspaces/platform-ops/projects?githubInstallationId=987",
      nonce: "nonce-state",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 10).toISOString(),
    },
    "state-secret"
  );
  const options = { secret: "state-secret", now: fixedNow };

  assert.equal(
    verifyGithubUserAuthorizationState(null, options).status,
    "missing"
  );
  assert.equal(
    verifyGithubUserAuthorizationState(undefined, options).status,
    "missing"
  );
  assert.equal(
    verifyGithubUserAuthorizationState("not-a-token", options).status,
    "invalid"
  );
  assert.equal(
    verifyGithubUserAuthorizationState("body.signature.extra", options).status,
    "invalid"
  );
  assert.equal(
    verifyGithubUserAuthorizationState(validState, {
      secret: "wrong-secret",
      now: fixedNow,
    }).status,
    "invalid"
  );
  assert.equal(
    verifyGithubUserAuthorizationState(
      createSignedInvalidJson("state-secret"),
      options
    ).status,
    "invalid"
  );
});

test("pkce challenge uses SHA-256 base64url encoding", () => {
  assert.equal(
    createPkceChallenge("verifier-123"),
    "Ds3NpaREu9I2EYq6l0l3ZkFyv_Gt5O4EpGD6cZlY0Kg"
  );
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
      expiresAt: addMinutes(fixedNow, 15).toISOString(),
    },
    "proof-secret"
  );

  assert.deepEqual(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987",
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
        expiresAt: addMinutes(fixedNow, 15).toISOString(),
      },
    }
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-2",
      workspaceSlug: "platform-ops",
      installationId: "987",
    }).status,
    "wrong_user"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "other-workspace",
      installationId: "987",
    }).status,
    "wrong_workspace"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "999",
    }).status,
    "wrong_installation"
  );
});

test("github user authorization proof rejects signed malformed payloads", () => {
  const malformedProof = createGithubUserAuthorizationProof(
    {
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987",
      expiresAt: addMinutes(fixedNow, 15).toISOString(),
    },
    "proof-secret"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(malformedProof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987",
    }).status,
    "invalid"
  );
});

test("github user authorization proof rejects missing and invalid signed values", () => {
  const validProof = createGithubUserAuthorizationProof(
    {
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      githubUserId: "12345",
      githubLogin: "henry",
      installationId: "987",
      allowedProviderRepositoryIds: ["42", "77"],
      nonce: "nonce-proof",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 15).toISOString(),
    },
    "proof-secret"
  );
  const options = {
    secret: "proof-secret",
    now: fixedNow,
    productUserId: "user-1",
    workspaceSlug: "platform-ops",
    installationId: "987",
  };

  assert.equal(
    verifyGithubUserAuthorizationProof(null, options).status,
    "missing"
  );
  assert.equal(
    verifyGithubUserAuthorizationProof(undefined, options).status,
    "missing"
  );
  assert.equal(
    verifyGithubUserAuthorizationProof("not-a-token", options).status,
    "invalid"
  );
  assert.equal(
    verifyGithubUserAuthorizationProof("body.signature.extra", options).status,
    "invalid"
  );
  assert.equal(
    verifyGithubUserAuthorizationProof(validProof, {
      ...options,
      secret: "wrong-secret",
    }).status,
    "invalid"
  );
  assert.equal(
    verifyGithubUserAuthorizationProof(
      createSignedInvalidJson("proof-secret"),
      options
    ).status,
    "invalid"
  );
});

test("installation import rejects missing github user authorization proof before calling GitHub", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createSession(`admin-${uniqueSuffix()}`, "admin@example.com");
  const workspace = await harness.createWorkspace(
    admin,
    "phase13-missing-proof"
  );
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
          },
        },
        authorizationProof: null,
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
  let githubWasCalled = false;

  await assert.rejects(
    importGithubInstallationRepositoryForUser(
      {
        projectRepository: harness.repositories.projectRepository,
        githubRepository: harness.repositories.githubRepository,
        installationClient: {
          async listRepositories() {
            githubWasCalled = true;
            return [
              {
                providerRepositoryId: "42",
                owner: "the-platform",
                name: "platform-ops",
                fullName: "the-platform/platform-ops",
                defaultBranch: "main",
                htmlUrl: "https://github.com/the-platform/platform-ops",
                isPrivate: true,
              },
            ];
          },
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
          expiresAt: addMinutes(fixedNow, 15).toISOString(),
        },
      },
      admin,
      workspace.slug,
      "987",
      { providerRepositoryId: "42", projectName: "Platform Ops", key: "P13" }
    ),
    /selected repository is not authorized for this GitHub user/
  );

  assert.equal(githubWasCalled, false);
});

test("github app user authorization url includes client id, redirect uri, state, and pkce challenge", () => {
  const url = buildGithubAppUserAuthorizationUrl({
    clientId: "client-123",
    redirectUri: "http://localhost:3000/github/authorize/callback",
    state: "signed-state",
    codeChallenge: "challenge-123",
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

      if (
        serializeFetchUrl(url) ===
        "https://github.test/login/oauth/access_token"
      ) {
        return createJsonResponse({
          access_token: "ghu_user",
          token_type: "bearer",
        });
      }

      if (serializeFetchUrl(url) === "https://api.github.test/user") {
        return createJsonResponse({ id: 12345, login: "henry" });
      }

      if (
        serializeFetchUrl(url) ===
        "https://api.github.test/user/installations?per_page=100"
      ) {
        return createJsonResponse({
          installations: [
            {
              id: 987,
              account: { login: "the-platform" },
            },
          ],
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
            owner: { login: "the-platform" },
          },
        ],
      });
    },
  });

  const token = await client.exchangeCodeForUserAccessToken({
    code: "oauth-code",
    redirectUri: "http://localhost:3000/github/authorize/callback",
    codeVerifier: "verifier-123",
  });
  const user = await client.getUser(token);
  const installations = await client.listUserInstallations(token);
  const repositories = await client.listUserInstallationRepositories(
    token,
    "987"
  );

  assert.equal(token, "ghu_user");
  assert.deepEqual(user, { id: "12345", login: "henry" });
  assert.deepEqual(installations, [
    { installationId: "987", accountLogin: "the-platform" },
  ]);
  assert.equal(repositories[0].providerRepositoryId, "42");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.accept, "application/json");
  const tokenRequestBody = new URLSearchParams(String(calls[0].init.body));
  assert.equal(tokenRequestBody.get("client_id"), "client-123");
  assert.equal(tokenRequestBody.get("client_secret"), "secret-456");
  assert.equal(tokenRequestBody.get("code"), "oauth-code");
  assert.equal(
    tokenRequestBody.get("redirect_uri"),
    "http://localhost:3000/github/authorize/callback"
  );
  assert.equal(tokenRequestBody.get("code_verifier"), "verifier-123");
  assert.equal(calls[1].init.headers.authorization, "Bearer ghu_user");
});

test("github user authorization client token exchange failures use sanitized errors", async () => {
  const client = createGithubUserAuthorizationClient({
    clientId: "client-123",
    clientSecret: "secret-456",
    githubBaseUrl: "https://github.test",
    fetch: async () =>
      createJsonResponse(
        { error: "bad_verification_code", access_token: "ghu_leaked_token" },
        { status: 401, statusText: "Unauthorized" }
      ),
  });

  await assert.rejects(
    client.exchangeCodeForUserAccessToken({
      code: "oauth-code",
      redirectUri: "http://localhost:3000/github/authorize/callback",
      codeVerifier: "verifier-123",
    }),
    (error) => {
      assert.equal(
        error.message,
        "GitHub user token exchange failed: 401 Unauthorized"
      );
      assert.doesNotMatch(error.message, /bad_verification_code/);
      assert.doesNotMatch(error.message, /ghu_leaked_token/);
      return true;
    }
  );
});

test("github user authorization client rejects token exchange responses without access token", async () => {
  const client = createGithubUserAuthorizationClient({
    clientId: "client-123",
    clientSecret: "secret-456",
    githubBaseUrl: "https://github.test",
    fetch: async () => createJsonResponse({ token_type: "bearer" }),
  });

  await assert.rejects(
    client.exchangeCodeForUserAccessToken({
      code: "oauth-code",
      redirectUri: "http://localhost:3000/github/authorize/callback",
      codeVerifier: "verifier-123",
    }),
    /GitHub user token exchange response was incomplete\./
  );
});

test("github user authorization client rejects malformed user responses", async () => {
  const client = createGithubUserAuthorizationClient({
    clientId: "client-123",
    clientSecret: "secret-456",
    apiBaseUrl: "https://api.github.test",
    fetch: async () => createJsonResponse({ id: 12345 }),
  });

  await assert.rejects(
    client.getUser("ghu_user"),
    /GitHub user response was incomplete\./
  );
});

test("github user authorization client returns empty lists for malformed list envelopes", async () => {
  const calls = [];
  const client = createGithubUserAuthorizationClient({
    clientId: "client-123",
    clientSecret: "secret-456",
    apiBaseUrl: "https://api.github.test",
    fetch: async (url) => {
      calls.push(serializeFetchUrl(url));
      return createJsonResponse({ not_the_expected_list: "ghu_leaked_token" });
    },
  });

  assert.deepEqual(await client.listUserInstallations("ghu_user"), []);
  assert.deepEqual(
    await client.listUserInstallationRepositories("ghu_user", "987"),
    []
  );
  assert.deepEqual(calls, [
    "https://api.github.test/user/installations?per_page=100",
    "https://api.github.test/user/installations/987/repositories?per_page=100",
  ]);
});

test("github user authorization client follows paginated installation and repository links", async () => {
  const calls = [];
  const client = createGithubUserAuthorizationClient({
    clientId: "client-123",
    clientSecret: "secret-456",
    apiBaseUrl: "https://api.github.test",
    fetch: async (url) => {
      const requestUrl = serializeFetchUrl(url);
      calls.push(requestUrl);

      if (
        requestUrl === "https://api.github.test/user/installations?per_page=100"
      ) {
        return createJsonResponse(
          { installations: [{ id: 987, account: { login: "the-platform" } }] },
          {
            headers: {
              link: '<https://api.github.test/user/installations?page=2&per_page=100>; rel="next"',
            },
          }
        );
      }

      if (
        requestUrl ===
        "https://api.github.test/user/installations?page=2&per_page=100"
      ) {
        return createJsonResponse({
          installations: [{ id: 988, account: { login: "other-platform" } }],
        });
      }

      if (
        requestUrl ===
        "https://api.github.test/user/installations/987/repositories?per_page=100"
      ) {
        return createJsonResponse(
          {
            repositories: [
              {
                id: 42,
                name: "platform-ops",
                full_name: "the-platform/platform-ops",
                default_branch: "main",
                private: true,
                html_url: "https://github.com/the-platform/platform-ops",
                owner: { login: "the-platform" },
              },
            ],
          },
          {
            headers: {
              link: '<https://api.github.test/user/installations/987/repositories?page=2&per_page=100>; rel="next"',
            },
          }
        );
      }

      return createJsonResponse({
        repositories: [
          {
            id: 77,
            name: "platform-web",
            full_name: "the-platform/platform-web",
            default_branch: "main",
            private: false,
            html_url: "https://github.com/the-platform/platform-web",
            owner: { login: "the-platform" },
          },
        ],
      });
    },
  });

  const installations = await client.listUserInstallations("ghu_user");
  const repositories = await client.listUserInstallationRepositories(
    "ghu_user",
    "987"
  );

  assert.deepEqual(installations, [
    { installationId: "987", accountLogin: "the-platform" },
    { installationId: "988", accountLogin: "other-platform" },
  ]);
  assert.deepEqual(
    repositories.map((repository) => repository.providerRepositoryId),
    ["42", "77"]
  );
  assert.deepEqual(calls, [
    "https://api.github.test/user/installations?per_page=100",
    "https://api.github.test/user/installations?page=2&per_page=100",
    "https://api.github.test/user/installations/987/repositories?per_page=100",
    "https://api.github.test/user/installations/987/repositories?page=2&per_page=100",
  ]);
});

test("github user authorization missing configuration names required env vars", () => {
  assert.deepEqual(getGithubUserAuthorizationMissingConfiguration({}), [
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
    "GITHUB_USER_AUTH_STATE_SECRET",
  ]);
});

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
    pkceVerifier: "verifier-123",
  });

  assert.equal(prepared.pkceVerifier, "verifier-123");
  assert.match(
    prepared.authorizationUrl,
    /^https:\/\/github\.test\/login\/oauth\/authorize\?/
  );
  assert.match(prepared.authorizationUrl, /client_id=client-123/);
  assert.match(
    prepared.authorizationUrl,
    /code_challenge=Ds3NpaREu9I2EYq6l0l3ZkFyv_Gt5O4EpGD6cZlY0Kg/
  );
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
    pkceVerifier: "verifier-123",
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
      provider: "demo",
    },
    stateSecret: "state-secret",
    appBaseUrl: "http://localhost:3000",
    now: fixedNow,
    client: {
      async exchangeCodeForUserAccessToken(input) {
        assert.equal(input.code, "oauth-code");
        assert.equal(
          input.redirectUri,
          "http://localhost:3000/github/authorize/callback"
        );
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
            isPrivate: true,
          },
        ];
      },
    },
  });

  assert.equal(result.status, "success");
  assert.equal(
    result.redirectPath,
    "/workspaces/platform-ops/projects?githubInstallationId=987&githubAuthorized=1"
  );
  assert.equal(
    verifyGithubUserAuthorizationProof(result.proofCookieValue, {
      secret: "state-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987",
    }).status,
    "valid"
  );
});

test("authorization success redirects do not propagate unsafe returnPath query params", async () => {
  const result = await completeFlow({
    signedState: createFlowState({
      returnPath:
        "/workspaces/platform-ops/projects?githubSetupAction=install&code=oauth-code&access_token=secret-token&token=secret-token&state=signed-state",
    }),
  });

  assert.equal(result.status, "success");
  assert.equal(
    result.redirectPath,
    "/workspaces/platform-ops/projects?githubSetupAction=install&githubInstallationId=987&githubAuthorized=1"
  );
  assertNoUnsafeRedirectParams(result.redirectPath);
});

test("authorization error redirects do not propagate unsafe returnPath query params", async () => {
  const result = await completeFlow({
    pkceVerifier: null,
    signedState: createFlowState({
      returnPath:
        "/workspaces/platform-ops/projects?githubSetupAction=install&code=oauth-code&access_token=secret-token&token=secret-token&state=signed-state",
    }),
  });

  assert.deepEqual(result, {
    status: "error",
    redirectPath:
      "/workspaces/platform-ops/projects?githubSetupAction=install&githubInstallationId=987&githubAuthorizationError=pkce_missing",
    errorCode: "pkce_missing",
  });
  assertNoUnsafeRedirectParams(result.redirectPath);
});

test("projects return path rejects hostile workspace slugs", () => {
  for (const workspaceSlug of [
    "../admin",
    "platform-ops/other",
    "platform-ops?x=1",
  ]) {
    assert.throws(
      () => buildGithubProjectsReturnPath(workspaceSlug, "987"),
      /Invalid workspace slug/
    );
  }
});

test("callback helper maps invalid state to safe root redirect", async () => {
  assert.deepEqual(
    await completeFlow({
      signedState: "not-a-token",
    }),
    {
      status: "error",
      redirectPath: "/?githubAuthorizationError=state_invalid",
      errorCode: "state_invalid",
    }
  );

  assert.deepEqual(
    await completeFlow({
      signedState: createFlowState({ workspaceSlug: "../admin" }),
    }),
    {
      status: "error",
      redirectPath: "/?githubAuthorizationError=state_invalid",
      errorCode: "state_invalid",
    }
  );

  assert.deepEqual(
    await completeFlow({
      signedState: createGithubUserAuthorizationState(
        {
          workspaceSlug: "platform-ops",
          returnPath: "/workspaces/platform-ops/projects",
          nonce: "nonce-state",
          issuedAt: fixedNow.toISOString(),
          expiresAt: addMinutes(fixedNow, 10).toISOString(),
        },
        "state-secret"
      ),
    }),
    {
      status: "error",
      redirectPath: "/?githubAuthorizationError=state_invalid",
      errorCode: "state_invalid",
    }
  );
});

test("callback helper maps expired state to projects error redirect", async () => {
  assert.deepEqual(
    await completeFlow({
      signedState: createFlowState({
        returnPath:
          "/workspaces/platform-ops/projects?githubSetupAction=install&code=oauth-code",
        expiresAt: addMinutes(fixedNow, -1),
      }),
    }),
    {
      status: "error",
      redirectPath:
        "/workspaces/platform-ops/projects?githubSetupAction=install&githubInstallationId=987&githubAuthorizationError=state_expired",
      errorCode: "state_expired",
    }
  );
});

test("callback helper maps missing pkce to projects error redirect", async () => {
  assert.deepEqual(
    await completeFlow({
      pkceVerifier: "",
      signedState: createFlowState({
        returnPath:
          "/workspaces/platform-ops/projects?githubSetupAction=install",
      }),
    }),
    {
      status: "error",
      redirectPath:
        "/workspaces/platform-ops/projects?githubSetupAction=install&githubInstallationId=987&githubAuthorizationError=pkce_missing",
      errorCode: "pkce_missing",
    }
  );
});

test("callback helper maps token exchange failure to projects error redirect", async () => {
  assert.deepEqual(
    await completeFlow({
      client: createAuthorizationClient({
        async exchangeCodeForUserAccessToken() {
          throw new Error("do not leak this");
        },
      }),
    }),
    {
      status: "error",
      redirectPath:
        "/workspaces/platform-ops/projects?githubInstallationId=987&githubAuthorizationError=token_exchange_failed",
      errorCode: "token_exchange_failed",
    }
  );
});

test("callback helper maps inaccessible installation to projects error redirect", async () => {
  assert.deepEqual(
    await completeFlow({
      client: createAuthorizationClient({
        async listUserInstallations() {
          return [];
        },
      }),
    }),
    {
      status: "error",
      redirectPath:
        "/workspaces/platform-ops/projects?githubInstallationId=987&githubAuthorizationError=installation_inaccessible",
      errorCode: "installation_inaccessible",
    }
  );
});

test("callback helper maps repository listing failure to projects error redirect", async () => {
  assert.deepEqual(
    await completeFlow({
      client: createAuthorizationClient({
        async listUserInstallationRepositories() {
          throw new Error("do not leak this");
        },
      }),
    }),
    {
      status: "error",
      redirectPath:
        "/workspaces/platform-ops/projects?githubInstallationId=987&githubAuthorizationError=repositories_inaccessible",
      errorCode: "repositories_inaccessible",
    }
  );
});
