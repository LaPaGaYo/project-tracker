import assert from "node:assert/strict";
import test from "node:test";

import { createCommentRepository } from "../apps/web/src/server/comments/repository.ts";
import { createGithubConnectionRepository } from "../apps/web/src/server/github/repository.ts";
import {
  connectProjectGithubRepositoryForUser,
  projectGithubWebhookEvent
} from "../apps/web/src/server/github/service.ts";
import { computeGithubWebhookSignature } from "../apps/web/src/server/github/signature.ts";
import { syncGithubWebhookRequest } from "../apps/web/src/server/github/webhooks.ts";
import { createNotificationRepository } from "../apps/web/src/server/notifications/repository.ts";
import { listNotificationsForUser } from "../apps/web/src/server/notifications/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import { createWorkItemForUser } from "../apps/web/src/server/work-items/service.ts";
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
  return `H${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
}

function createRepositories() {
  return {
    commentRepository: createCommentRepository(),
    githubRepository: createGithubConnectionRepository(),
    notificationRepository: createNotificationRepository(),
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

async function sendGithubWebhook(
  repositories,
  { body, deliveryId, eventName, processDelivery }
) {
  const payload = JSON.stringify(body);
  const response = await syncGithubWebhookRequest(
    repositories.githubRepository,
    createWebhookRequest({
      payload,
      signature: computeGithubWebhookSignature(payload, "topsecret"),
      deliveryId,
      eventName
    }),
    {
      secret: "topsecret",
      now: () => new Date("2026-04-24T18:00:00.000Z"),
      notificationRepository: repositories.notificationRepository,
      processDelivery:
        processDelivery ??
        (({ repository: githubRepository, eventName: deliveryEventName, payload: deliveryPayload, receivedAt }) =>
          projectGithubWebhookEvent(
            repositories.githubRepository,
            githubRepository,
            deliveryEventName,
            deliveryPayload,
            receivedAt,
            {
              notificationRepository: repositories.notificationRepository
            }
          ))
    }
  );

  return response;
}

function pullRequestPayload(providerRepositoryId, workItem, overrides = {}) {
  return {
    action: "opened",
    repository: {
      id: providerRepositoryId
    },
    pull_request: {
      id: `pr-${uniqueSuffix()}`,
      number: 42,
      title: `${workItem.identifier} ship notification wiring`,
      body: "Connect engineering updates to issue followers.",
      html_url: "https://github.com/the-platform/platform-ops/pull/42",
      state: "open",
      draft: false,
      user: {
        login: "octocat"
      },
      base: {
        ref: "main"
      },
      head: {
        ref: `${workItem.identifier.toLowerCase()}-github-notifications`,
        sha: "sha-github-notifications"
      },
      created_at: "2026-04-24T18:00:00.000Z",
      updated_at: "2026-04-24T18:00:00.000Z",
      merged_at: null,
      closed_at: null,
      ...overrides.pullRequest
    },
    ...overrides.payload
  };
}

async function createGithubNotificationHarness(t, label) {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession(`${label}-owner`);
  const assignee = createNamedSession(`${label}-assignee`);
  const participant = createNamedSession(`${label}-participant`);
  const workspace = await harness.createWorkspace(owner, label);

  await harness.addMembership(workspace.id, assignee, "member");
  await harness.addMembership(workspace.id, participant, "member");
  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "GitHub Notifications",
    key: projectKey
  });

  const workItem = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "GitHub notification target",
      assigneeId: assignee.userId
    }
  );
  await harness.repositories.commentRepository.createComment({
    workspaceId: workspace.id,
    projectId: workItem.projectId,
    workItemId: workItem.id,
    authorId: participant.userId,
    content: "Following the engineering rollout"
  });

  const providerRepositoryId = `repo_notify_${uniqueSuffix()}`;
  await connectProjectGithubRepositoryForUser(
    harness.repositories.githubRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      providerRepositoryId,
      owner: "the-platform",
      name: `${label}-ops`,
      fullName: `the-platform/${label}-ops`,
      defaultBranch: "main",
      installationId: `installation_${uniqueSuffix()}`,
      stagingEnvironmentName: "staging",
      productionEnvironmentName: "production"
    }
  );

  return {
    harness,
    owner,
    assignee,
    participant,
    workspace,
    workItem,
    providerRepositoryId
  };
}

async function inbox(repository, session, workspace) {
  return listNotificationsForUser(repository, session, workspace.slug, { limit: 50 });
}

function eventsByType(entries, eventType) {
  return entries.filter((entry) => entry.event.eventType === eventType);
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("github pull request updates notify linked item followers and replay is idempotent", async (t) => {
  const { harness, owner, assignee, participant, workspace, workItem, providerRepositoryId } =
    await createGithubNotificationHarness(t, "github-pr-notify");

  const prId = `pr-${uniqueSuffix()}`;
  const openedPayload = pullRequestPayload(providerRepositoryId, workItem, {
    pullRequest: {
      id: prId,
      number: 77
    }
  });

  assert.equal(
    (await sendGithubWebhook(harness.repositories, {
      deliveryId: `delivery-pr-open-${uniqueSuffix()}`,
      eventName: "pull_request",
      body: openedPayload
    })).status,
    200
  );
  assert.equal(
    (await sendGithubWebhook(harness.repositories, {
      deliveryId: `delivery-pr-open-replay-${uniqueSuffix()}`,
      eventName: "pull_request",
      body: openedPayload
    })).status,
    200
  );
  assert.equal(
    (await sendGithubWebhook(harness.repositories, {
      deliveryId: `delivery-pr-review-${uniqueSuffix()}`,
      eventName: "pull_request",
      body: pullRequestPayload(providerRepositoryId, workItem, {
        payload: {
          action: "review_requested"
        },
        pullRequest: {
          id: prId,
          number: 77,
          updated_at: "2026-04-24T18:05:00.000Z"
        }
      })
    })).status,
    200
  );
  assert.equal(
    (await sendGithubWebhook(harness.repositories, {
      deliveryId: `delivery-pr-merged-${uniqueSuffix()}`,
      eventName: "pull_request",
      body: pullRequestPayload(providerRepositoryId, workItem, {
        payload: {
          action: "closed"
        },
        pullRequest: {
          id: prId,
          number: 77,
          state: "closed",
          merged: true,
          merged_at: "2026-04-24T18:10:00.000Z",
          closed_at: "2026-04-24T18:10:00.000Z",
          updated_at: "2026-04-24T18:10:00.000Z"
        }
      })
    })).status,
    200
  );
  assert.equal(
    (await sendGithubWebhook(harness.repositories, {
      deliveryId: `delivery-pr-closed-${uniqueSuffix()}`,
      eventName: "pull_request",
      body: pullRequestPayload(providerRepositoryId, workItem, {
        payload: {
          action: "closed"
        },
        pullRequest: {
          id: `pr-${uniqueSuffix()}`,
          number: 78,
          state: "closed",
          merged: false,
          closed_at: "2026-04-24T18:15:00.000Z",
          updated_at: "2026-04-24T18:15:00.000Z"
        }
      })
    })).status,
    200
  );

  const assigneePrNotifications = eventsByType(
    await inbox(harness.repositories.notificationRepository, assignee, workspace),
    "github_pr_changed"
  );
  assert.equal(assigneePrNotifications.length, 4);
  assert.ok(assigneePrNotifications.every((entry) => entry.recipient.reason === "assigned"));

  const participantPrNotifications = eventsByType(
    await inbox(harness.repositories.notificationRepository, participant, workspace),
    "github_pr_changed"
  );
  assert.equal(participantPrNotifications.length, 4);
  assert.ok(participantPrNotifications.every((entry) => entry.recipient.reason === "participant"));

  const ownerPrNotifications = eventsByType(
    await inbox(harness.repositories.notificationRepository, owner, workspace),
    "github_pr_changed"
  );
  assert.equal(ownerPrNotifications.length, 4);
});

test("github check recovery and production deploy notify linked item followers", async (t) => {
  const { harness, assignee, participant, workspace, workItem, providerRepositoryId } =
    await createGithubNotificationHarness(t, "github-check-notify");

  const prId = `pr-${uniqueSuffix()}`;
  await sendGithubWebhook(harness.repositories, {
    deliveryId: `delivery-pr-link-${uniqueSuffix()}`,
    eventName: "pull_request",
    body: pullRequestPayload(providerRepositoryId, workItem, {
      pullRequest: {
        id: prId,
        number: 88
      }
    })
  });

  await sendGithubWebhook(harness.repositories, {
    deliveryId: `delivery-check-fail-${uniqueSuffix()}`,
    eventName: "check_run",
    body: {
      action: "completed",
      repository: {
        id: providerRepositoryId
      },
      check_run: {
        id: `check-${uniqueSuffix()}`,
        head_sha: "sha-github-notifications",
        html_url: "https://github.com/the-platform/platform-ops/runs/88",
        status: "completed",
        conclusion: "failure",
        completed_at: "2026-04-24T18:20:00.000Z"
      }
    }
  });
  await sendGithubWebhook(harness.repositories, {
    deliveryId: `delivery-check-pass-${uniqueSuffix()}`,
    eventName: "check_run",
    body: {
      action: "completed",
      repository: {
        id: providerRepositoryId
      },
      check_run: {
        id: `check-${uniqueSuffix()}`,
        head_sha: "sha-github-notifications",
        html_url: "https://github.com/the-platform/platform-ops/runs/89",
        status: "completed",
        conclusion: "success",
        completed_at: "2026-04-24T18:25:00.000Z"
      }
    }
  });
  await sendGithubWebhook(harness.repositories, {
    deliveryId: `delivery-deploy-prod-${uniqueSuffix()}`,
    eventName: "deployment_status",
    body: {
      repository: {
        id: providerRepositoryId
      },
      deployment: {
        id: `deployment-${uniqueSuffix()}`,
        sha: "sha-github-notifications",
        ref: "main",
        environment: "production"
      },
      deployment_status: {
        state: "success",
        environment: "production",
        environment_url: "https://app.the-platform.dev",
        created_at: "2026-04-24T18:30:00.000Z"
      }
    }
  });

  const assigneeInbox = await inbox(harness.repositories.notificationRepository, assignee, workspace);
  assert.equal(eventsByType(assigneeInbox, "github_check_changed").length, 2);
  assert.equal(eventsByType(assigneeInbox, "github_deploy_changed").length, 1);

  const participantInbox = await inbox(harness.repositories.notificationRepository, participant, workspace);
  assert.equal(eventsByType(participantInbox, "github_check_changed").length, 2);
  assert.equal(eventsByType(participantInbox, "github_deploy_changed").length, 1);
});

test("failed github webhook processing notifies workspace owners and admins", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("github-failure-owner");
  const admin = createNamedSession("github-failure-admin");
  const member = createNamedSession("github-failure-member");
  const workspace = await harness.createWorkspace(owner, "github-failure");
  await harness.addMembership(workspace.id, admin, "admin");
  await harness.addMembership(workspace.id, member, "member");
  const projectKey = createUniqueProjectKey();

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "GitHub Failure Notifications",
    key: projectKey
  });
  const providerRepositoryId = `repo_failure_${uniqueSuffix()}`;
  await connectProjectGithubRepositoryForUser(
    harness.repositories.githubRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      providerRepositoryId,
      owner: "the-platform",
      name: "failure-ops",
      fullName: "the-platform/failure-ops",
      defaultBranch: "main",
      installationId: `installation_${uniqueSuffix()}`
    }
  );

  const response = await sendGithubWebhook(harness.repositories, {
    deliveryId: `delivery-failed-${uniqueSuffix()}`,
    eventName: "pull_request",
    body: {
      action: "opened",
      repository: {
        id: providerRepositoryId
      },
      pull_request: {
        id: `pr-${uniqueSuffix()}`,
        number: 99,
        title: "failure projection",
        html_url: "https://github.com/the-platform/failure-ops/pull/99",
        state: "open",
        base: {
          ref: "main"
        },
        head: {
          ref: "failure-projection",
          sha: "sha-failure"
        }
      }
    },
    processDelivery: async () => {
      throw new Error("projection exploded");
    }
  });

  assert.equal(response.status, 500);
  assert.equal(
    eventsByType(await inbox(harness.repositories.notificationRepository, owner, workspace), "github_webhook_failed").length,
    1
  );
  assert.equal(
    eventsByType(await inbox(harness.repositories.notificationRepository, admin, workspace), "github_webhook_failed").length,
    1
  );
  assert.deepEqual(await inbox(harness.repositories.notificationRepository, member, workspace), []);
});
