import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "../packages/db/src/client.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createProjectForUser, getProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { searchProjectForUser } from "../apps/web/src/server/projects/search.ts";
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

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
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
    }
  };
}

async function createProjectWithSearchData(harness, owner, workspace, projectKey, label) {
  const prefix = label ? `${label} ` : "";

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: `${prefix}Readiness`,
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
      title: `${prefix}Fix release pipeline`,
      description: `${prefix}release pipeline needs safer rollout checks.`,
      type: "task",
      priority: "high",
      position: 0
    }
  );

  const [stage] = await sql`
    insert into project_stages (project_id, slug, title, goal, status, gate_status, sort_order)
    values (
      ${project.id},
      'readiness-search',
      ${`${prefix}Readiness Search`},
      ${`${prefix}release pipeline readiness gate`},
      'In Progress',
      ${`${prefix}Gate ready`},
      0
    )
    returning id
  `;

  await sql`
    insert into plan_items (stage_id, title, outcome, status, blocker)
    values (
      ${stage.id},
      ${`${prefix}Stabilize release pipeline plan`},
      ${`${prefix}release pipeline is observable before rollout.`},
      'Todo',
      null
    )
  `;

  await sql`
    insert into comments (work_item_id, author_id, content)
    values (
      ${item.id},
      ${owner.userId},
      ${`${prefix}release pipeline comment should be searchable.`}
    )
  `;

  await sql`
    insert into task_github_status (task_id, pr_status, ci_status, deploy_status)
    values (${item.id}, 'Open PR', 'Passing', 'Staging')
  `;

  const [repository] = await sql`
    insert into github_repositories (
      workspace_id,
      provider_repository_id,
      owner,
      name,
      full_name,
      default_branch,
      installation_id
    )
    values (
      ${workspace.id},
      ${`${projectKey.toLowerCase()}-${uniqueSuffix()}`},
      'platform',
      ${`${projectKey.toLowerCase()}-repo`},
      ${`platform/${projectKey.toLowerCase()}-repo`},
      'main',
      ${`${projectKey.toLowerCase()}-installation`}
    )
    returning id
  `;

  const [pullRequest] = await sql`
    insert into github_pull_requests (
      repository_id,
      provider_pull_request_id,
      number,
      title,
      url,
      base_branch,
      head_branch,
      head_sha
    )
    values (
      ${repository.id},
      ${`${projectKey.toLowerCase()}-pr-${uniqueSuffix()}`},
      1,
      ${`${prefix}Release pipeline branch checks`},
      'https://example.com/pr/1',
      'main',
      ${`${projectKey.toLowerCase()}-release-pipeline`},
      ${`${projectKey.toLowerCase()}abcdef1234567890`}
    )
    returning id
  `;

  await sql`
    insert into work_item_github_links (work_item_id, repository_id, pull_request_id, branch_name)
    values (
      ${item.id},
      ${repository.id},
      ${pullRequest.id},
      ${`${projectKey.toLowerCase()}-release-pipeline`}
    )
  `;

  return { project, item };
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("project readiness search ranks grouped results and stays scoped to the requested project", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-search");
  const workspace = await harness.createWorkspace(owner, "search-alpha");
  const otherWorkspace = await harness.createWorkspace(owner, "search-beta");

  const { project } = await createProjectWithSearchData(harness, owner, workspace, "OPS", "");
  await createProjectWithSearchData(harness, owner, otherWorkspace, "OPS", "Other workspace");

  const results = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    " release pipeline "
  );

  assert.equal(results.query, "release pipeline");
  assert.deepEqual(results.results.map((result) => result.type), [
    "work_item",
    "comment",
    "plan",
    "engineering"
  ]);
  assert.equal(results.results[0].title, "OPS-1 Fix release pipeline");
  assert.ok(
    results.results.every((result) =>
      result.href.startsWith(`/workspaces/${workspace.slug}/projects/${project.key}`)
    )
  );
  assert.ok(!results.results.some((result) => result.title.includes("Other workspace")));
});

test("project readiness search returns no results for short trimmed queries", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-short");

  assert.deepEqual(
    await searchProjectForUser(
      { projectRepository: harness.repositories.projectRepository },
      owner,
      "missing-workspace",
      "OPS",
      " r "
    ),
    { query: "r", results: [] }
  );
});

test("project readiness search enforces workspace membership and project scope", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-access");
  const outsider = createNamedSession("outsider-access");
  const workspace = await harness.createWorkspace(owner, "search-access");
  const { project } = await createProjectWithSearchData(harness, owner, workspace, "OPS", "");

  await assert.rejects(
    () =>
      searchProjectForUser(
        { projectRepository: harness.repositories.projectRepository },
        outsider,
        workspace.slug,
        project.key,
        "release"
      ),
    (error) => error instanceof Error && "status" in error && error.status === 403
  );

  await assert.rejects(
    () =>
      searchProjectForUser(
        { projectRepository: harness.repositories.projectRepository },
        owner,
        workspace.slug,
        "MISS",
        "release"
      ),
    (error) => error instanceof Error && "status" in error && error.status === 404
  );
});
