import assert from "node:assert/strict";
import test from "node:test";

import { connectProjectGithubRepositoryForUser, getProjectGithubConnectionForUser } from "../apps/web/src/server/github/service.ts";
import { createGithubConnectionRepository } from "../apps/web/src/server/github/repository.ts";
import { createProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { getProjectWorkspaceForUser } from "../apps/web/src/server/projects/workspace.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import { createWorkspaceRepository } from "../apps/web/src/server/workspaces/repository.ts";
import { createWorkspaceForUser } from "../apps/web/src/server/workspaces/service.ts";
import { sql } from "../packages/db/src/client.ts";

function createSession(userId, email) {
  return {
    userId,
    email,
    displayName: email,
    provider: "demo"
  };
}

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createUniqueProjectKey() {
  return `G${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
}

function createRepositories() {
  return {
    githubRepository: createGithubConnectionRepository(),
    projectRepository: createProjectRepository(),
    workItemRepository: createWorkItemRepository(),
    workspaceRepository: createWorkspaceRepository()
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
      const workspace = await createWorkspaceForUser(repositories.workspaceRepository, session, {
        name: `${label} ${suffix}`,
        slug: `${label.toLowerCase()}-${suffix}`
      });
      workspaceIds.push(workspace.id);
      return workspace;
    },
    async addMembership(workspaceId, session, role) {
      return repositories.workspaceRepository.addMembership({
        workspaceId,
        userId: session.userId,
        role
      });
    }
  };
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("owner can connect a project to GitHub and viewers can read the connection summary", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh");
  const viewer = createNamedSession("viewer-gh");
  const workspace = await harness.createWorkspace(owner, "github-connect");
  await harness.addMembership(workspace.id, viewer, "viewer");

  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "GitHub Ops",
    key: projectKey
  });

  const connection = await connectProjectGithubRepositoryForUser(
    harness.repositories.githubRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      providerRepositoryId: "repo_platform_ops_contract",
      owner: "the-platform",
      name: "platform-ops",
      fullName: "the-platform/platform-ops",
      defaultBranch: "main",
      installationId: "installation_contract",
      stagingEnvironmentName: "staging",
      productionEnvironmentName: "production"
    }
  );

  assert.equal(connection.repository.fullName, "the-platform/platform-ops");
  assert.equal(connection.connection.stagingEnvironmentName, "staging");

  const viewerConnection = await getProjectGithubConnectionForUser(
    harness.repositories.githubRepository,
    viewer,
    workspace.slug,
    projectKey
  );

  assert.equal(viewerConnection?.repository.defaultBranch, "main");

  const workspaceView = await getProjectWorkspaceForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      workItemRepository: harness.repositories.workItemRepository
    },
    viewer,
    workspace.slug,
    projectKey
  );

  assert.equal(workspaceView.engineering.repository, "the-platform/platform-ops");
  assert.equal(workspaceView.engineering.connectionStatus, "Connected");
});

test("only owners and admins can create a project GitHub connection and each project gets one primary repository", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh-rbac");
  const admin = createNamedSession("admin-gh-rbac");
  const member = createNamedSession("member-gh-rbac");
  const workspace = await harness.createWorkspace(owner, "github-rbac");
  await harness.addMembership(workspace.id, admin, "admin");
  await harness.addMembership(workspace.id, member, "member");

  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "RBAC Ops",
    key: projectKey
  });

  await assert.rejects(
    () =>
      connectProjectGithubRepositoryForUser(harness.repositories.githubRepository, member, workspace.slug, projectKey, {
        providerRepositoryId: "repo_member_denied",
        owner: "the-platform",
        name: "rbac-ops",
        fullName: "the-platform/rbac-ops",
        defaultBranch: "main",
        installationId: "installation_member_denied"
      }),
    (error) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 403 &&
      error.message === "only owners and admins can connect GitHub repositories."
  );

  const adminConnection = await connectProjectGithubRepositoryForUser(
    harness.repositories.githubRepository,
    admin,
    workspace.slug,
    projectKey,
    {
      providerRepositoryId: "repo_admin_allowed",
      owner: "the-platform",
      name: "rbac-ops",
      fullName: "the-platform/rbac-ops",
      defaultBranch: "main",
      installationId: "installation_admin_allowed"
    }
  );

  assert.equal(adminConnection.repository.fullName, "the-platform/rbac-ops");

  await assert.rejects(
    () =>
      connectProjectGithubRepositoryForUser(harness.repositories.githubRepository, owner, workspace.slug, projectKey, {
        providerRepositoryId: "repo_second_connection",
        owner: "the-platform",
        name: "rbac-ops-second",
        fullName: "the-platform/rbac-ops-second",
        defaultBranch: "main",
        installationId: "installation_second_connection"
      }),
    (error) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 409 &&
      error.message === "project already has a primary GitHub repository."
  );
});
