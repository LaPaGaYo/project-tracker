import assert from "node:assert/strict";
import test from "node:test";

import { createGithubConnectionRepository } from "../apps/web/src/server/github/repository.ts";
import {
  connectProjectGithubRepositoryForUser,
  projectGithubWebhookEvent
} from "../apps/web/src/server/github/service.ts";
import { computeGithubWebhookSignature } from "../apps/web/src/server/github/signature.ts";
import { syncGithubWebhookRequest } from "../apps/web/src/server/github/webhooks.ts";
import { createProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { getProjectWorkspaceForUser } from "../apps/web/src/server/projects/workspace.ts";
import { createWorkItemForUser } from "../apps/web/src/server/work-items/service.ts";
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
    }
  };
}

function createWebhookRequest({ payload, signature, deliveryId, eventName }) {
  return new Request("http://localhost/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": deliveryId,
      "x-github-event": eventName,
      "x-hub-signature-256": signature
    },
    body: payload
  });
}

async function sendGithubWebhook(repository, { body, deliveryId, eventName }) {
  const payload = JSON.stringify(body);
  const response = await syncGithubWebhookRequest(
    repository,
    createWebhookRequest({
      payload,
      signature: computeGithubWebhookSignature(payload, "topsecret"),
      deliveryId,
      eventName
    }),
    {
      secret: "topsecret",
      now: () => new Date("2026-04-23T18:00:00.000Z"),
      processDelivery: ({ repository: githubRepository, eventName: deliveryEventName, payload: deliveryPayload, receivedAt }) =>
        projectGithubWebhookEvent(repository, githubRepository, deliveryEventName, deliveryPayload, receivedAt)
    }
  );

  assert.equal(response.status, 200);
  return response;
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("github webhook projection updates normalized github tables, task status, and workspace engineering summary", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh-projection");
  const workspace = await harness.createWorkspace(owner, "github-projection");
  const projectKey = createUniqueProjectKey();

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "GitHub Projection",
    key: projectKey
  });

  const workItem = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Surface live engineering state on the project board",
      type: "task",
      priority: "high"
    }
  );

  const [stage] = await sql`
    insert into project_stages (project_id, slug, title, goal, status, gate_status, sort_order)
    select id, 'live-engineering', 'Phase 2: Live Engineering', 'Project webhook events into the workspace.', 'In Progress', 'In review', 0
    from projects
    where workspace_id = ${workspace.id} and key = ${projectKey}
    returning id
  `;

  await sql`
    update tasks
    set stage_id = ${stage.id}
    where id = ${workItem.id}
  `;

  const providerRepositoryId = `repo_projection_${uniqueSuffix()}`;
  const connection = await connectProjectGithubRepositoryForUser(
    harness.repositories.githubRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      providerRepositoryId,
      owner: "the-platform",
      name: "platform-ops",
      fullName: "the-platform/platform-ops",
      defaultBranch: "main",
      installationId: `installation_${uniqueSuffix()}`,
      stagingEnvironmentName: "staging",
      productionEnvironmentName: "production"
    }
  );

  await sendGithubWebhook(harness.repositories.githubRepository, {
    deliveryId: `delivery-pr-${uniqueSuffix()}`,
    eventName: "pull_request",
    body: {
      action: "opened",
      repository: {
        id: providerRepositoryId
      },
      pull_request: {
        id: `pr-${uniqueSuffix()}`,
        number: 128,
        title: `${workItem.identifier} surface live engineering state`,
        body: "Wire GitHub signals into the project workspace.",
        html_url: "https://github.com/the-platform/platform-ops/pull/128",
        state: "open",
        draft: false,
        user: {
          login: "octocat"
        },
        base: {
          ref: "main"
        },
        head: {
          ref: `${workItem.identifier.toLowerCase()}-engineering-rollup`,
          sha: "sha-live-engineering"
        },
        created_at: "2026-04-23T18:00:00.000Z",
        updated_at: "2026-04-23T18:00:00.000Z",
        merged_at: null,
        closed_at: null
      }
    }
  });

  await sendGithubWebhook(harness.repositories.githubRepository, {
    deliveryId: `delivery-check-${uniqueSuffix()}`,
    eventName: "check_run",
    body: {
      action: "completed",
      repository: {
        id: providerRepositoryId
      },
      check_run: {
        id: `check-${uniqueSuffix()}`,
        head_sha: "sha-live-engineering",
        html_url: "https://github.com/the-platform/platform-ops/runs/128",
        status: "completed",
        conclusion: "failure",
        completed_at: "2026-04-23T18:10:00.000Z"
      }
    }
  });

  await sendGithubWebhook(harness.repositories.githubRepository, {
    deliveryId: `delivery-deploy-${uniqueSuffix()}`,
    eventName: "deployment_status",
    body: {
      repository: {
        id: providerRepositoryId
      },
      deployment: {
        id: `deployment-${uniqueSuffix()}`,
        sha: "sha-live-engineering",
        ref: "main",
        environment: "staging"
      },
      deployment_status: {
        state: "success",
        environment: "staging",
        environment_url: "https://staging.the-platform.dev",
        created_at: "2026-04-23T18:20:00.000Z"
      }
    }
  });

  const [pullRequest] = await sql`
    select id, number, title, state, head_sha
    from github_pull_requests
    where repository_id = ${connection.repository.id}
      and number = 128
  `;
  assert.equal(pullRequest?.title, `${workItem.identifier} surface live engineering state`);
  assert.equal(pullRequest?.state, "open");
  assert.equal(pullRequest?.head_sha, "sha-live-engineering");

  const [githubLink] = await sql`
    select work_item_id, source, branch_name
    from work_item_github_links
    where pull_request_id = ${pullRequest.id}
  `;
  assert.equal(githubLink?.work_item_id, workItem.id);
  assert.equal(githubLink?.source, "pr_title");
  assert.equal(githubLink?.branch_name, `${workItem.identifier.toLowerCase()}-engineering-rollup`);

  const [checkRollup] = await sql`
    select status, check_count, completed_at
    from github_check_rollups
    where repository_id = ${connection.repository.id}
      and head_sha = 'sha-live-engineering'
  `;
  assert.equal(checkRollup?.status, "failing");
  assert.equal(checkRollup?.check_count, 1);
  assert.ok(checkRollup?.completed_at);

  const [deployment] = await sql`
    select environment, environment_name, status, url
    from github_deployments
    where repository_id = ${connection.repository.id}
      and head_sha = 'sha-live-engineering'
  `;
  assert.equal(deployment?.environment, "staging");
  assert.equal(deployment?.environment_name, "staging");
  assert.equal(deployment?.status, "success");
  assert.equal(deployment?.url, "https://staging.the-platform.dev");

  const [githubStatus] = await sql`
    select pr_status, ci_status, deploy_status
    from task_github_status
    where task_id = ${workItem.id}
  `;
  assert.equal(githubStatus?.pr_status, "Open PR");
  assert.equal(githubStatus?.ci_status, "Failing");
  assert.equal(githubStatus?.deploy_status, "Staging");

  const workspaceView = await getProjectWorkspaceForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      workItemRepository: harness.repositories.workItemRepository
    },
    owner,
    workspace.slug,
    projectKey
  );

  assert.equal(workspaceView.engineering.repository, "the-platform/platform-ops");
  assert.equal(workspaceView.engineering.pullRequests, "1 open");
  assert.equal(workspaceView.engineering.checks, "1 failing");
  assert.equal(workspaceView.engineering.deploys, "Staging live");
  assert.ok(
    workspaceView.engineering.issueSummary.includes(`${workItem.identifier} · open · failing · phase 2`)
  );
});

test("github webhook projection leaves ambiguous issue references unlinked", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh-ambiguous");
  const workspace = await harness.createWorkspace(owner, "github-ambiguous");
  const projectKey = createUniqueProjectKey();

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ambiguous Projection",
    key: projectKey
  });

  const firstItem = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Coordinate the shared rollout cutover",
      type: "task"
    }
  );
  const secondItem = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Clean up the related deployment checklist",
      type: "task"
    }
  );

  const providerRepositoryId = `repo_ambiguous_${uniqueSuffix()}`;
  const connection = await connectProjectGithubRepositoryForUser(
    harness.repositories.githubRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      providerRepositoryId,
      owner: "the-platform",
      name: "ambiguous-ops",
      fullName: "the-platform/ambiguous-ops",
      defaultBranch: "main",
      installationId: `installation_${uniqueSuffix()}`
    }
  );

  await sendGithubWebhook(harness.repositories.githubRepository, {
    deliveryId: `delivery-ambiguous-${uniqueSuffix()}`,
    eventName: "pull_request",
    body: {
      action: "opened",
      repository: {
        id: providerRepositoryId
      },
      pull_request: {
        id: `pr-${uniqueSuffix()}`,
        number: 256,
        title: `${firstItem.identifier} ${secondItem.identifier} shared rollout changes`,
        body: "Do not guess the matching issue when multiple identifiers are present.",
        html_url: "https://github.com/the-platform/ambiguous-ops/pull/256",
        state: "open",
        draft: false,
        user: {
          login: "octocat"
        },
        base: {
          ref: "main"
        },
        head: {
          ref: "shared-rollout-changes",
          sha: "sha-ambiguous"
        },
        created_at: "2026-04-23T19:00:00.000Z",
        updated_at: "2026-04-23T19:00:00.000Z",
        merged_at: null,
        closed_at: null
      }
    }
  });

  const [pullRequest] = await sql`
    select id, number
    from github_pull_requests
    where repository_id = ${connection.repository.id}
      and number = 256
  `;
  assert.equal(pullRequest?.number, 256);

  const linkRows = await sql`
    select work_item_id
    from work_item_github_links
    where pull_request_id = ${pullRequest.id}
  `;
  assert.equal(linkRows.length, 0);

  const statusRows = await sql`
    select task_id
    from task_github_status
    where task_id in (${firstItem.id}, ${secondItem.id})
  `;
  assert.equal(statusRows.length, 0);
});
