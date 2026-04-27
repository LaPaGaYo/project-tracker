import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import {
  buildGithubAppInstallUrl,
  createGithubAppInstallationClient,
  normalizeGithubAppPrivateKey,
} from "../apps/web/src/server/github/app-installation.ts";
import { importGithubInstallationRepositoryForUser } from "../apps/web/src/server/github/installation-import.ts";
import { resolveGithubSetupRedirect } from "../apps/web/src/server/github/setup.ts";
import { createGithubConnectionRepository } from "../apps/web/src/server/github/repository.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import { createWorkspaceRepository } from "../apps/web/src/server/workspaces/repository.ts";
import { sql } from "../packages/db/src/client.ts";

function createPrivateKeyPem() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ format: "pem", type: "pkcs8" }).toString();
}

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    ...(init.statusText ? { statusText: init.statusText } : {}),
    headers: {
      "content-type": "application/json",
    },
  });
}

function serializeFetchUrl(url) {
  if (typeof url === "string") {
    return url;
  }

  if (url instanceof URL) {
    return url.href;
  }

  return url.url;
}

function createSession(userId, email) {
  return {
    userId,
    email,
    displayName: email,
    provider: "demo",
  };
}

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createUniqueProjectKey() {
  return `G${uniqueSuffix()
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(
    `${prefix}-${suffix}`,
    `${prefix}-${suffix}@example.com`
  );
}

function authorizationProofFixture(
  session,
  workspaceSlug,
  installationId,
  allowedProviderRepositoryIds = ["42"]
) {
  return {
    productUserId: session.userId,
    workspaceSlug,
    githubUserId: "12345",
    githubLogin: "henry",
    installationId,
    allowedProviderRepositoryIds,
    nonce: `proof-${uniqueSuffix()}`,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

function createRepositories() {
  return {
    githubRepository: createGithubConnectionRepository(),
    projectRepository: createProjectRepository(),
    workItemRepository: createWorkItemRepository(),
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
    async addMembership(workspaceId, session, role) {
      return repositories.workspaceRepository.addMembership({
        workspaceId,
        userId: session.userId,
        role,
      });
    },
  };
}

function selectedRepositoryFixture(providerRepositoryId = "42") {
  return {
    providerRepositoryId,
    owner: "the-platform",
    name: "platform-ops",
    fullName: "the-platform/platform-ops",
    defaultBranch: "main",
    htmlUrl: "https://github.com/the-platform/platform-ops",
    isPrivate: true,
  };
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("buildGithubAppInstallUrl encodes workspace state", () => {
  const url = buildGithubAppInstallUrl({
    appSlug: "the-platform-dev",
    workspaceSlug: "platform-ops",
  });

  assert.equal(
    url,
    "https://github.com/apps/the-platform-dev/installations/new?state=platform-ops"
  );
});

test("normalizeGithubAppPrivateKey accepts escaped and base64 PEM values", () => {
  const privateKey = createPrivateKeyPem().trim();

  assert.equal(
    normalizeGithubAppPrivateKey({
      privateKey: privateKey.replaceAll("\n", "\\n"),
    }),
    privateKey
  );
  assert.equal(
    normalizeGithubAppPrivateKey({
      privateKeyBase64: Buffer.from(privateKey).toString("base64"),
    }),
    privateKey
  );
});

test("installation client mints an installation token and lists repositories", async () => {
  const calls = [];
  const client = createGithubAppInstallationClient({
    appId: "123",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://api.github.test",
    fetch: async (url, init = {}) => {
      calls.push({ url: serializeFetchUrl(url), init });

      if (
        serializeFetchUrl(url).endsWith("/app/installations/987/access_tokens")
      ) {
        return createJsonResponse(
          {
            token: "ghs_installation",
            expires_at: "2099-01-01T00:00:00Z",
          },
          { status: 201 }
        );
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
            owner: {
              login: "the-platform",
            },
          },
        ],
      });
    },
  });

  const repositories = await client.listRepositories("987");

  assert.equal(repositories.length, 1);
  assert.equal(repositories[0].providerRepositoryId, "42");
  assert.equal(repositories[0].owner, "the-platform");
  assert.equal(repositories[0].fullName, "the-platform/platform-ops");
  assert.match(
    String(calls[0].init.headers.authorization),
    /^Bearer [^.]+\.[^.]+\.[^.]+$/
  );
  assert.equal(calls[1].init.headers.authorization, "Bearer ghs_installation");
  assert.equal(
    calls[1].url,
    "https://api.github.test/installation/repositories?per_page=100"
  );
});

test("admin imports a selected installation repository as a connected project", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createNamedSession("admin-gh-installed-import");
  const workspace = await harness.createWorkspace(
    admin,
    "github-installed-import"
  );
  const projectKey = createUniqueProjectKey();

  const result = await importGithubInstallationRepositoryForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      githubRepository: harness.repositories.githubRepository,
      installationClient: {
        async listRepositories(installationId) {
          assert.equal(installationId, "987");
          return [selectedRepositoryFixture("42")];
        },
      },
      authorizationProof: authorizationProofFixture(
        admin,
        workspace.slug,
        "987",
        ["42"]
      ),
    },
    admin,
    workspace.slug,
    "987",
    {
      providerRepositoryId: "42",
      projectName: "Platform Ops",
      key: projectKey,
      stagingEnvironmentName: "staging",
      productionEnvironmentName: "production",
    }
  );

  assert.equal(result.project.key, projectKey);
  assert.equal(result.github.repository.fullName, "the-platform/platform-ops");
  assert.equal(result.github.repository.installationId, "987");
  assert.equal(result.github.connection.stagingEnvironmentName, "staging");
});

test("selected repository import rejects non-admin users before calling GitHub", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh-installed-rbac");
  const member = createNamedSession("member-gh-installed-rbac");
  const workspace = await harness.createWorkspace(
    owner,
    "github-installed-rbac"
  );
  await harness.addMembership(workspace.id, member, "member");
  let called = false;

  await assert.rejects(
    () =>
      importGithubInstallationRepositoryForUser(
        {
          projectRepository: harness.repositories.projectRepository,
          githubRepository: harness.repositories.githubRepository,
          installationClient: {
            async listRepositories() {
              called = true;
              return [];
            },
          },
          authorizationProof: null,
        },
        member,
        workspace.slug,
        "987",
        {
          providerRepositoryId: "42",
        }
      ),
    (error) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 403 &&
      error.message === "only owners and admins can import GitHub projects."
  );

  assert.equal(called, false);
});

test("selected repository import rejects repositories outside the installation", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createNamedSession("admin-gh-installed-missing");
  const workspace = await harness.createWorkspace(
    admin,
    "github-installed-missing"
  );

  await assert.rejects(
    () =>
      importGithubInstallationRepositoryForUser(
        {
          projectRepository: harness.repositories.projectRepository,
          githubRepository: harness.repositories.githubRepository,
          installationClient: {
            async listRepositories() {
              return [selectedRepositoryFixture("42")];
            },
          },
          authorizationProof: authorizationProofFixture(
            admin,
            workspace.slug,
            "987",
            ["404"]
          ),
        },
        admin,
        workspace.slug,
        "987",
        {
          providerRepositoryId: "404",
        }
      ),
    (error) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 403 &&
      error.message ===
        "selected repository is not authorized for this GitHub user."
  );
});

test("resolveGithubSetupRedirect returns authorization URL for valid setup params", () => {
  assert.equal(
    resolveGithubSetupRedirect(
      new URLSearchParams({
        state: "platform-ops",
        installation_id: "987",
        setup_action: "install",
      })
    ),
    "/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987&githubSetupAction=install"
  );
});

test("resolveGithubSetupRedirect returns home for invalid setup state", () => {
  assert.equal(
    resolveGithubSetupRedirect(
      new URLSearchParams({
        state: "../platform-ops",
        installation_id: "987",
      })
    ),
    "/"
  );
});
