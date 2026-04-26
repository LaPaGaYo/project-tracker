import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "../packages/db/src/client.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createProjectForUser, getProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import { createWorkItemForUser } from "../apps/web/src/server/work-items/service.ts";
import { createWorkspaceRepository } from "../apps/web/src/server/workspaces/repository.ts";
import { createWorkspaceForUser } from "../apps/web/src/server/workspaces/service.ts";

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
  return `S${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
}

async function importSearchRoute() {
  try {
    return await import("../apps/web/src/app/api/workspaces/[slug]/projects/[key]/search/route.ts");
  } catch (error) {
    assert.fail(`search API route is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createRepositories() {
  return {
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

function createSearchRouteDependencies(session, repositories) {
  return {
    getSession: async () => session,
    projectRepository: repositories.projectRepository
  };
}

async function createProjectWithItem(harness, owner, workspace, title = "Release readiness checklist") {
  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Search API",
    key: projectKey
  });

  const project = await getProjectForUser(
    harness.repositories.projectRepository,
    owner,
    workspace.slug,
    projectKey
  );

  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title,
      description: "Release search API result",
      type: "task",
      priority: "high",
      position: 0
    }
  );

  return { project, item };
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("search API lets an authenticated workspace member search a project", async (t) => {
  const { GET } = await importSearchRoute();
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("search-api-owner");
  const member = createNamedSession("search-api-member");
  const workspace = await harness.createWorkspace(owner, "search-api-member");
  await harness.addMembership(workspace.id, member, "member");
  const { project, item } = await createProjectWithItem(harness, owner, workspace);

  const response = await GET(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${project.key}/search?q=release`),
    { params: Promise.resolve({ slug: workspace.slug, key: project.key }) },
    createSearchRouteDependencies(member, harness.repositories)
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.query, "release");
  assert.ok(body.results.some((result) => result.type === "work_item" && result.title.includes(item.title)));
});

test("search API returns empty results for queries shorter than two characters", async (t) => {
  const { GET } = await importSearchRoute();
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("search-api-short");
  const workspace = await harness.createWorkspace(owner, "search-api-short");
  const { project } = await createProjectWithItem(harness, owner, workspace);

  const response = await GET(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${project.key}/search?q=r`),
    { params: Promise.resolve({ slug: workspace.slug, key: project.key }) },
    createSearchRouteDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    query: "r",
    results: []
  });
});

test("search API returns 403 for non-members", async (t) => {
  const { GET } = await importSearchRoute();
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("search-api-owner");
  const outsider = createNamedSession("search-api-outsider");
  const workspace = await harness.createWorkspace(owner, "search-api-denied");
  const { project } = await createProjectWithItem(harness, owner, workspace);

  const response = await GET(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${project.key}/search?q=release`),
    { params: Promise.resolve({ slug: workspace.slug, key: project.key }) },
    createSearchRouteDependencies(outsider, harness.repositories)
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "workspace access denied."
  });
});

test("search API returns 404 for missing projects", async (t) => {
  const { GET } = await importSearchRoute();
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("search-api-missing");
  const workspace = await harness.createWorkspace(owner, "search-api-missing");

  const response = await GET(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/MISS/search?q=release`),
    { params: Promise.resolve({ slug: workspace.slug, key: "MISS" }) },
    createSearchRouteDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "project not found."
  });
});
