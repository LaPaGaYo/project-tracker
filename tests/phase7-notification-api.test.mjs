import assert from "node:assert/strict";
import test from "node:test";

import { createNotificationRepository } from "../apps/web/src/server/notifications/repository.ts";
import { createNotificationForSource } from "../apps/web/src/server/notifications/service.ts";
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
  return `A${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
}

async function importNotificationHandlers() {
  try {
    return await import("../apps/web/src/server/api/notification-handlers.ts");
  } catch (error) {
    assert.fail(`notification API handlers are unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createRepositories() {
  return {
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

function createNotificationHandlerDependencies(session, repositories) {
  return {
    getSession: async () => session,
    notificationRepository: repositories.notificationRepository
  };
}

async function createProjectWithItem(harness, owner, workspace) {
  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Notification API",
    key: projectKey
  });

  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Notification API target"
    }
  );

  return {
    projectKey,
    item
  };
}

async function createInboxNotification(harness, owner, workspace, item, recipient, sourceId) {
  return createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: item.projectId,
      workItemId: item.id,
      sourceType: "work_item",
      sourceId,
      eventType: "assignment_changed",
      actorId: owner.userId,
      priority: "normal",
      title: "Notification API event",
      url: `/workspaces/${workspace.slug}/items/${item.identifier}`,
      recipients: [
        {
          recipientId: recipient.userId,
          reason: "assigned"
        }
      ]
    }
  );
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("notification API lists inbox and marks current user's notifications read", async (t) => {
  const handlers = await importNotificationHandlers();
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("api-owner");
  const member = createNamedSession("api-member");
  const workspace = await harness.createWorkspace(owner, "notification-api");
  await harness.addMembership(workspace.id, member, "member");
  const { item } = await createProjectWithItem(harness, owner, workspace);

  await createInboxNotification(harness, owner, workspace, item, member, `api-one-${uniqueSuffix()}`);
  await createInboxNotification(harness, owner, workspace, item, member, `api-two-${uniqueSuffix()}`);

  const dependencies = createNotificationHandlerDependencies(member, harness.repositories);
  const listResponse = await handlers.handleListNotifications(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notifications`),
    { slug: workspace.slug },
    dependencies
  );
  assert.equal(listResponse.status, 200);
  const listBody = await listResponse.json();
  assert.equal(listBody.notifications.length, 2);
  assert.equal(listBody.notifications.filter((entry) => entry.isUnread).length, 2);

  const firstNotificationId = listBody.notifications[0].recipient.id;
  const markOneResponse = await handlers.handlePatchNotification(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notifications/${firstNotificationId}`, {
      method: "PATCH"
    }),
    { slug: workspace.slug, notificationId: firstNotificationId },
    dependencies
  );
  assert.equal(markOneResponse.status, 200);
  const markOneBody = await markOneResponse.json();
  assert.equal(markOneBody.notification.recipientId, member.userId);
  assert.notEqual(markOneBody.notification.readAt, null);

  const markAllResponse = await handlers.handleMarkAllNotificationsRead(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notifications/mark-all-read`, {
      method: "POST"
    }),
    { slug: workspace.slug },
    dependencies
  );
  assert.equal(markAllResponse.status, 200);
  assert.deepEqual(await markAllResponse.json(), {
    updatedCount: 1
  });

  const finalListResponse = await handlers.handleListNotifications(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notifications`),
    { slug: workspace.slug },
    dependencies
  );
  const finalListBody = await finalListResponse.json();
  assert.equal(finalListBody.notifications.filter((entry) => entry.isUnread).length, 0);
});

test("notification API returns 404 for another user's recipient row and 403 for non-members", async (t) => {
  const handlers = await importNotificationHandlers();
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("api-owner");
  const member = createNamedSession("api-member");
  const outsider = createNamedSession("api-outsider");
  const workspace = await harness.createWorkspace(owner, "notification-isolation");
  await harness.addMembership(workspace.id, member, "member");
  const { item } = await createProjectWithItem(harness, owner, workspace);

  const created = await createInboxNotification(
    harness,
    owner,
    workspace,
    item,
    member,
    `api-isolation-${uniqueSuffix()}`
  );
  const memberRecipientId = created.recipients[0]?.id;
  assert.ok(memberRecipientId);

  const ownerMarkResponse = await handlers.handlePatchNotification(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notifications/${memberRecipientId}`, {
      method: "PATCH"
    }),
    { slug: workspace.slug, notificationId: memberRecipientId },
    createNotificationHandlerDependencies(owner, harness.repositories)
  );
  assert.equal(ownerMarkResponse.status, 404);
  assert.deepEqual(await ownerMarkResponse.json(), {
    error: "notification not found."
  });

  const outsiderListResponse = await handlers.handleListNotifications(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notifications`),
    { slug: workspace.slug },
    createNotificationHandlerDependencies(outsider, harness.repositories)
  );
  assert.equal(outsiderListResponse.status, 403);
  assert.deepEqual(await outsiderListResponse.json(), {
    error: "workspace access denied."
  });
});

test("notification preferences API reads defaults and persists current user updates", async (t) => {
  const handlers = await importNotificationHandlers();
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("api-owner");
  const member = createNamedSession("api-member");
  const workspace = await harness.createWorkspace(owner, "notification-prefs");
  await harness.addMembership(workspace.id, member, "member");
  const dependencies = createNotificationHandlerDependencies(member, harness.repositories);

  const getDefaultsResponse = await handlers.handleGetNotificationPreferences(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notification-preferences`),
    { slug: workspace.slug },
    dependencies
  );
  assert.equal(getDefaultsResponse.status, 200);
  const defaultsBody = await getDefaultsResponse.json();
  assert.equal(defaultsBody.preferences.commentsEnabled, true);
  assert.equal(defaultsBody.preferences.githubEnabled, true);

  const patchResponse = await handlers.handlePatchNotificationPreferences(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notification-preferences`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        commentsEnabled: false,
        githubEnabled: false,
        mentionsEnabled: false
      })
    }),
    { slug: workspace.slug },
    dependencies
  );
  assert.equal(patchResponse.status, 200);
  const patchBody = await patchResponse.json();
  assert.equal(patchBody.preferences.commentsEnabled, false);
  assert.equal(patchBody.preferences.githubEnabled, false);
  assert.equal(patchBody.preferences.mentionsEnabled, false);

  const getUpdatedResponse = await handlers.handleGetNotificationPreferences(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/notification-preferences`),
    { slug: workspace.slug },
    dependencies
  );
  const updatedBody = await getUpdatedResponse.json();
  assert.equal(updatedBody.preferences.commentsEnabled, false);
  assert.equal(updatedBody.preferences.githubEnabled, false);
  assert.equal(updatedBody.preferences.mentionsEnabled, false);
});
