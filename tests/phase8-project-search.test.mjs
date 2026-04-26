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

async function createProjectWithWorkItemOnly(harness, owner, workspace, projectKey, title) {
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: `${projectKey} Search`,
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
      description: `${title} description`,
      type: "task",
      priority: "medium",
      position: 0
    }
  );

  return { project, item };
}

async function addPullRequestLink(workspace, item, label) {
  const suffix = uniqueSuffix();
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
      ${`${label.toLowerCase()}-${suffix}`},
      'platform',
      ${`${label.toLowerCase()}-repo-${suffix}`},
      ${`platform/${label.toLowerCase()}-repo-${suffix}`},
      'main',
      ${`${label.toLowerCase()}-installation-${suffix}`}
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
      ${`${label.toLowerCase()}-pr-${suffix}`},
      1,
      ${`${label} rollout wiring`},
      ${`https://example.com/${label.toLowerCase()}/${suffix}`},
      'main',
      ${`${label.toLowerCase()}-rollout-${suffix}`},
      ${`${label.toLowerCase()}${suffix}abcdef1234567890`}
    )
    returning id
  `;

  await sql`
    insert into work_item_github_links (work_item_id, repository_id, pull_request_id, branch_name)
    values (
      ${item.id},
      ${repository.id},
      ${pullRequest.id},
      ${`${label.toLowerCase()}-rollout-${suffix}`}
    )
  `;

  return { repository, pullRequest };
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
  assert.equal(
    results.results.find((result) => result.type === "plan")?.href,
    `/workspaces/${workspace.slug}/projects/${project.key}/plan`
  );
  assert.equal(
    results.results.find((result) => result.type === "engineering")?.href,
    `/workspaces/${workspace.slug}/projects/${project.key}/engineering`
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

test("project readiness search does not synthesize engineering results for plain task matches", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-plain-task");
  const workspace = await harness.createWorkspace(owner, "search-plain-task");
  const { project } = await createProjectWithWorkItemOnly(
    harness,
    owner,
    workspace,
    "PLN",
    "Plain release pipeline task"
  );

  const results = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "release pipeline"
  );

  assert.deepEqual(results.results.map((result) => result.type), ["work_item"]);
});

test("project readiness search returns one engineering result per multi-link task", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-multi-link");
  const workspace = await harness.createWorkspace(owner, "search-multi-link");
  const { project, item } = await createProjectWithWorkItemOnly(
    harness,
    owner,
    workspace,
    "MLT",
    "Prepare rollout task"
  );

  await addPullRequestLink(workspace, item, "Rollout");
  await addPullRequestLink(workspace, item, "Rollout");

  const results = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "rollout"
  );
  const engineeringResults = results.results.filter((result) => result.type === "engineering");

  assert.equal(engineeringResults.length, 1);
  assert.equal(new Set(engineeringResults.map((result) => result.id)).size, engineeringResults.length);
});

test("project readiness search matches scoped work item metadata and risk fields", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-risk-fields");
  const workspace = await harness.createWorkspace(owner, "search-risk-fields");
  const otherWorkspace = await harness.createWorkspace(owner, "search-risk-fields-other");

  const { project, item } = await createProjectWithWorkItemOnly(
    harness,
    owner,
    workspace,
    "RSK",
    "Validate launch handoff"
  );
  await createProjectWithWorkItemOnly(harness, owner, otherWorkspace, "RSK", "Validate launch handoff");

  await sql`
    update tasks
    set
      status = 'Blocked',
      priority = 'urgent',
      labels = array['launch-label-only']::text[],
      blocked_reason = 'release-council-only-token requires launch approval'
    where id = ${item.id}
  `;

  const blockedResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "blocked"
  );
  const urgentResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "urgent"
  );
  const labelResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "launch-label-only"
  );
  const blockedReasonResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "release-council-only-token"
  );

  for (const results of [blockedResults, urgentResults, labelResults, blockedReasonResults]) {
    assert.ok(results.results.some((result) => result.type === "work_item" && result.title === "RSK-1 Validate launch handoff"));
    assert.ok(
      results.results.every((result) =>
        result.href.startsWith(`/workspaces/${workspace.slug}/projects/${project.key}`)
      )
    );
  }
});

test("project readiness search matches engineering GitHub status fields", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-github-status");
  const workspace = await harness.createWorkspace(owner, "search-github-status");
  const { project, item } = await createProjectWithWorkItemOnly(
    harness,
    owner,
    workspace,
    "GST",
    "Validate neutral handoff"
  );

  const { pullRequest } = await addPullRequestLink(workspace, item, "Neutral");
  await sql`
    update github_pull_requests
    set body = 'pr-body-only-token confirms rollout readiness.'
    where id = ${pullRequest.id}
  `;
  await sql`
    insert into task_github_status (task_id, pr_status, ci_status, deploy_status)
    values (${item.id}, 'Review requested', 'Failing', 'Production')
  `;

  const failingResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "failing"
  );
  const reviewResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "review requested"
  );
  const productionResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "production"
  );
  const prBodyResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "pr-body-only-token"
  );
  const engineeringResult = failingResults.results.find((result) => result.type === "engineering");

  assert.ok(engineeringResult);
  assert.equal(engineeringResult.chip, "CI failing");
  assert.equal(engineeringResult.href, `/workspaces/${workspace.slug}/projects/${project.key}/engineering`);
  for (const results of [reviewResults, productionResults, prBodyResults]) {
    assert.ok(results.results.some((result) => result.type === "engineering"));
  }
});

test("project readiness search returns current-user project notifications only", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-notification");
  const member = createNamedSession("member-notification");
  const workspace = await harness.createWorkspace(owner, "search-notification");
  const { project } = await createProjectWithWorkItemOnly(
    harness,
    owner,
    workspace,
    "NTF",
    "Validate neutral notice"
  );

  await sql`
    insert into workspace_members (workspace_id, user_id, role, joined_at)
    values (${workspace.id}, ${member.userId}, 'member', now())
  `;

  const [event] = await sql`
    insert into notification_events (
      workspace_id,
      project_id,
      source_type,
      source_id,
      event_type,
      actor_id,
      priority,
      title,
      body,
      url
    )
    values (
      ${workspace.id},
      ${project.id},
      'github',
      ${`notice-${uniqueSuffix()}`},
      'github_check_changed',
      ${member.userId},
      'high',
      'Title-only deployment notice',
      'Body-only follow-up token is required.',
      ${`/workspaces/${workspace.slug}/projects/${project.key}/engineering`}
    )
    returning id
  `;

  await sql`
    insert into notification_recipients (event_id, workspace_id, recipient_id, reason)
    values (${event.id}, ${workspace.id}, ${owner.userId}, 'owner')
  `;

  const ownerTitleResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "title-only"
  );
  const ownerBodyResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "body-only"
  );
  const memberTitleResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    member,
    workspace.slug,
    project.key,
    "title-only"
  );
  const memberBodyResults = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    member,
    workspace.slug,
    project.key,
    "body-only"
  );

  const titleNotificationResult = ownerTitleResults.results.find((result) => result.type === "notification");
  const bodyNotificationResult = ownerBodyResults.results.find((result) => result.type === "notification");

  assert.ok(titleNotificationResult);
  assert.ok(bodyNotificationResult);
  assert.equal(titleNotificationResult.title, "Title-only deployment notice");
  assert.equal(bodyNotificationResult.title, "Title-only deployment notice");
  assert.equal(titleNotificationResult.href, `/workspaces/${workspace.slug}/projects/${project.key}/engineering`);
  assert.equal(bodyNotificationResult.href, `/workspaces/${workspace.slug}/projects/${project.key}/engineering`);
  assert.ok(!memberTitleResults.results.some((result) => result.type === "notification"));
  assert.ok(!memberBodyResults.results.some((result) => result.type === "notification"));
});

test("project readiness search treats LIKE wildcards as literal query text", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-wildcard");
  const workspace = await harness.createWorkspace(owner, "search-wildcard");
  const { project } = await createProjectWithSearchData(harness, owner, workspace, "WLD", "");

  const results = await searchProjectForUser(
    { projectRepository: harness.repositories.projectRepository },
    owner,
    workspace.slug,
    project.key,
    "%%"
  );

  assert.deepEqual(results, { query: "%%", results: [] });
});
