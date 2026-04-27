import assert from "node:assert/strict";
import test from "node:test";

import { connectProjectGithubRepositoryForUser } from "../apps/web/src/server/github/service.ts";
import { createGithubConnectionRepository } from "../apps/web/src/server/github/repository.ts";
import { importGithubProjectForUser } from "../apps/web/src/server/github/import.ts";
import { createProjectForUser, listProjectsForUser } from "../apps/web/src/server/projects/service.ts";
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
  return `I${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
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

test("admin can import a GitHub repository as a connected project", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createNamedSession("admin-gh-import");
  const workspace = await harness.createWorkspace(admin, "github-import");
  const projectKey = createUniqueProjectKey();

  const result = await importGithubProjectForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      githubRepository: harness.repositories.githubRepository
    },
    admin,
    workspace.slug,
    {
      providerRepositoryId: `repo_import_${uniqueSuffix()}`,
      owner: "the-platform",
      name: "imported-service",
      fullName: "the-platform/imported-service",
      defaultBranch: "main",
      installationId: `installation_${uniqueSuffix()}`,
      projectName: "Imported Service",
      key: projectKey,
      stagingEnvironmentName: "staging",
      productionEnvironmentName: "production"
    }
  );

  assert.equal(result.project.title, "Imported Service");
  assert.equal(result.project.key, projectKey);
  assert.equal(result.github.repository.fullName, "the-platform/imported-service");
  assert.equal(result.github.connection.stagingEnvironmentName, "staging");

  const workspaceView = await getProjectWorkspaceForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      workItemRepository: harness.repositories.workItemRepository
    },
    admin,
    workspace.slug,
    projectKey
  );

  assert.equal(workspaceView.engineering.repository, "the-platform/imported-service");
  assert.equal(workspaceView.engineering.connectionStatus, "Connected");
});

test("members cannot import GitHub projects", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh-import-rbac");
  const member = createNamedSession("member-gh-import-rbac");
  const workspace = await harness.createWorkspace(owner, "github-import-rbac");
  await harness.addMembership(workspace.id, member, "member");

  await assert.rejects(
    () =>
      importGithubProjectForUser(
        {
          projectRepository: harness.repositories.projectRepository,
          githubRepository: harness.repositories.githubRepository
        },
        member,
        workspace.slug,
        {
          providerRepositoryId: `repo_import_denied_${uniqueSuffix()}`,
          owner: "the-platform",
          name: "denied-service",
          fullName: "the-platform/denied-service",
          defaultBranch: "main",
          installationId: `installation_${uniqueSuffix()}`,
          projectName: "Denied Service",
          key: createUniqueProjectKey()
        }
      ),
    (error) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 403 &&
      error.message === "only owners and admins can import GitHub projects."
  );

  const projects = await listProjectsForUser(harness.repositories.projectRepository, owner, workspace.slug);
  assert.equal(projects.length, 0);
});

test("connection failure rolls back the newly-created project", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh-import-rollback");
  const workspace = await harness.createWorkspace(owner, "github-import-rollback");
  const providerRepositoryId = `repo_import_rollback_${uniqueSuffix()}`;

  const existingProjectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Existing GitHub Project",
    key: existingProjectKey
  });

  await connectProjectGithubRepositoryForUser(
    harness.repositories.githubRepository,
    owner,
    workspace.slug,
    existingProjectKey,
    {
      providerRepositoryId,
      owner: "the-platform",
      name: "rollback-service",
      fullName: "the-platform/rollback-service",
      defaultBranch: "main",
      installationId: `installation_${uniqueSuffix()}`
    }
  );

  const rollbackKey = createUniqueProjectKey();
  await assert.rejects(
    () =>
      importGithubProjectForUser(
        {
          projectRepository: harness.repositories.projectRepository,
          githubRepository: harness.repositories.githubRepository
        },
        owner,
        workspace.slug,
        {
          providerRepositoryId,
          owner: "the-platform",
          name: "rollback-service",
          fullName: "the-platform/rollback-service",
          defaultBranch: "main",
          installationId: `installation_${uniqueSuffix()}`,
          projectName: "Rollback Candidate",
          key: rollbackKey
        }
      ),
    (error) =>
      error instanceof Error &&
      "status" in error &&
      error.status === 409 &&
      error.message === "repository is already connected to another project."
  );

  const projects = await listProjectsForUser(harness.repositories.projectRepository, owner, workspace.slug);
  assert.equal(projects.some((project) => project.key === rollbackKey), false);
  assert.equal(projects.some((project) => project.key === existingProjectKey), true);
});
