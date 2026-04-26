import assert from "node:assert/strict";
import test from "node:test";

import { createNotificationRepository } from "../apps/web/src/server/notifications/repository.ts";
import {
  createNotificationForSource,
  getNotificationPreferencesForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  updateNotificationPreferencesForUser
} from "../apps/web/src/server/notifications/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import { createWorkItemForUser } from "../apps/web/src/server/work-items/service.ts";
import { createWorkflowStateRepository } from "../apps/web/src/server/workflow-states/repository.ts";
import { listWorkflowStatesForUser } from "../apps/web/src/server/workflow-states/service.ts";
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
  return `N${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
}

function createRepositories() {
  return {
    notificationRepository: createNotificationRepository(),
    projectRepository: createProjectRepository(),
    workItemRepository: createWorkItemRepository(),
    workflowStateRepository: createWorkflowStateRepository(),
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

async function createProjectWithItem(harness, owner, workspace) {
  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Notification Ops",
    key: projectKey
  });

  const states = await listWorkflowStatesForUser(
    harness.repositories.workflowStateRepository,
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
      title: "Notification target",
      workflowStateId: states[0]?.id
    }
  );

  return {
    projectKey,
    item
  };
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("notification service creates idempotent recipient rows and filters preferences plus self notifications", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-notify");
  const teammate = createNamedSession("teammate-notify");
  const muted = createNamedSession("muted-notify");
  const outsider = createNamedSession("outsider-notify");
  const workspace = await harness.createWorkspace(owner, "notify-service");
  await harness.addMembership(workspace.id, teammate, "member");
  await harness.addMembership(workspace.id, muted, "member");
  const { item } = await createProjectWithItem(harness, owner, workspace);

  const defaultPreferences = await getNotificationPreferencesForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug
  );
  assert.equal(defaultPreferences.commentsEnabled, true);

  await updateNotificationPreferencesForUser(
    harness.repositories.notificationRepository,
    muted,
    workspace.slug,
    {
      commentsEnabled: false
    }
  );

  const firstResult = await createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: item.projectId,
      workItemId: item.id,
      sourceType: "comment",
      sourceId: "comment-1",
      eventType: "comment_created",
      actorId: owner.userId,
      priority: "normal",
      title: "New comment on Notification target",
      body: "A teammate commented on the issue.",
      url: `/workspaces/${workspace.slug}/projects/${item.identifier?.split("-")[0]}/items/${item.identifier}`,
      metadata: {
        identifier: item.identifier
      },
      recipients: [
        { recipientId: owner.userId, reason: "owner" },
        { recipientId: teammate.userId, reason: "participant" },
        { recipientId: muted.userId, reason: "participant" },
        { recipientId: outsider.userId, reason: "participant" }
      ]
    }
  );

  assert.equal(firstResult.recipients.length, 1);
  assert.equal(firstResult.recipients[0]?.recipientId, teammate.userId);

  const secondResult = await createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: item.projectId,
      workItemId: item.id,
      sourceType: "comment",
      sourceId: "comment-1",
      eventType: "comment_created",
      actorId: owner.userId,
      title: "Duplicate comment notification",
      url: `/workspaces/${workspace.slug}/projects/${item.identifier?.split("-")[0]}/items/${item.identifier}`,
      recipients: [{ recipientId: teammate.userId, reason: "participant" }]
    }
  );

  assert.equal(secondResult.event.id, firstResult.event.id);
  assert.equal(secondResult.recipients.length, 1);

  const teammateInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug
  );
  assert.equal(teammateInbox.length, 1);
  assert.equal(teammateInbox[0]?.event.sourceId, "comment-1");
  assert.equal(teammateInbox[0]?.isUnread, true);

  assert.deepEqual(
    await listNotificationsForUser(harness.repositories.notificationRepository, owner, workspace.slug),
    []
  );
  assert.deepEqual(
    await listNotificationsForUser(harness.repositories.notificationRepository, muted, workspace.slug),
    []
  );

  await assert.rejects(
    () => listNotificationsForUser(harness.repositories.notificationRepository, outsider, workspace.slug),
    (error) => error instanceof Error && "status" in error && error.status === 403
  );
});

test("notification service marks only the current user's recipient rows read", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-read");
  const teammate = createNamedSession("teammate-read");
  const secondTeammate = createNamedSession("second-read");
  const workspace = await harness.createWorkspace(owner, "notify-read");
  await harness.addMembership(workspace.id, teammate, "member");
  await harness.addMembership(workspace.id, secondTeammate, "member");
  const { item } = await createProjectWithItem(harness, owner, workspace);

  const created = await createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: item.projectId,
      workItemId: item.id,
      sourceType: "work_item",
      sourceId: `${item.id}:assignment`,
      eventType: "assignment_changed",
      actorId: owner.userId,
      priority: "normal",
      title: "Assigned to Notification target",
      url: `/workspaces/${workspace.slug}/projects/${item.identifier?.split("-")[0]}/items/${item.identifier}`,
      recipients: [
        { recipientId: teammate.userId, reason: "assigned" },
        { recipientId: secondTeammate.userId, reason: "assigned" }
      ]
    }
  );

  const teammateRecipient = created.recipients.find((recipient) => recipient.recipientId === teammate.userId);
  const secondRecipient = created.recipients.find((recipient) => recipient.recipientId === secondTeammate.userId);
  assert.ok(teammateRecipient);
  assert.ok(secondRecipient);

  await assert.rejects(
    () =>
      markNotificationReadForUser(
        harness.repositories.notificationRepository,
        teammate,
        workspace.slug,
        secondRecipient.id
      ),
    (error) => error instanceof Error && "status" in error && error.status === 404
  );

  const marked = await markNotificationReadForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug,
    teammateRecipient.id
  );
  assert.equal(marked.recipientId, teammate.userId);
  assert.notEqual(marked.readAt, null);

  const teammateInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug
  );
  assert.equal(teammateInbox[0]?.isUnread, false);

  await createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: item.projectId,
      workItemId: item.id,
      sourceType: "work_item",
      sourceId: `${item.id}:state`,
      eventType: "state_changed",
      actorId: owner.userId,
      priority: "normal",
      title: "Notification target moved",
      url: `/workspaces/${workspace.slug}/projects/${item.identifier?.split("-")[0]}/items/${item.identifier}`,
      recipients: [{ recipientId: teammate.userId, reason: "participant" }]
    }
  );

  const markAllResult = await markAllNotificationsReadForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug
  );
  assert.equal(markAllResult.updatedCount, 1);

  const unreadAfterMarkAll = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug
  );
  assert.equal(unreadAfterMarkAll.filter((entry) => entry.isUnread).length, 0);
});

test("notification service lists project-scoped unread rows without workspace pagination", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-project-scope");
  const teammate = createNamedSession("teammate-project-scope");
  const workspace = await harness.createWorkspace(owner, "notify-project-scope");
  await harness.addMembership(workspace.id, teammate, "member");
  const currentProject = await createProjectWithItem(harness, owner, workspace);
  const otherProject = await createProjectWithItem(harness, owner, workspace);

  const currentUnread = await createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: currentProject.item.projectId,
      workItemId: currentProject.item.id,
      sourceType: "work_item",
      sourceId: `${currentProject.item.id}:unread`,
      eventType: "priority_raised",
      actorId: owner.userId,
      priority: "high",
      title: "Current project unread",
      url: `/workspaces/${workspace.slug}/projects/${currentProject.projectKey}/items/${currentProject.item.identifier}`,
      recipients: [{ recipientId: teammate.userId, reason: "participant" }]
    }
  );
  const currentRead = await createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: currentProject.item.projectId,
      workItemId: currentProject.item.id,
      sourceType: "work_item",
      sourceId: `${currentProject.item.id}:read`,
      eventType: "state_changed",
      actorId: owner.userId,
      priority: "high",
      title: "Current project read",
      url: `/workspaces/${workspace.slug}/projects/${currentProject.projectKey}/items/${currentProject.item.identifier}`,
      recipients: [{ recipientId: teammate.userId, reason: "participant" }]
    }
  );
  await createNotificationForSource(
    harness.repositories.notificationRepository,
    owner,
    workspace.slug,
    {
      projectId: otherProject.item.projectId,
      workItemId: otherProject.item.id,
      sourceType: "work_item",
      sourceId: `${otherProject.item.id}:unread`,
      eventType: "priority_raised",
      actorId: owner.userId,
      priority: "high",
      title: "Other project unread",
      url: `/workspaces/${workspace.slug}/projects/${otherProject.projectKey}/items/${otherProject.item.identifier}`,
      recipients: [{ recipientId: teammate.userId, reason: "participant" }]
    }
  );

  await markNotificationReadForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug,
    currentRead.recipients[0].id
  );

  const projectInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    teammate,
    workspace.slug,
    {
      projectId: currentProject.item.projectId,
      unreadOnly: true,
      limit: null
    }
  );

  assert.deepEqual(
    projectInbox.map((entry) => entry.recipient.id),
    [currentUnread.recipients[0].id]
  );
  assert.ok(projectInbox.every((entry) => entry.event.projectId === currentProject.item.projectId));
  assert.ok(projectInbox.every((entry) => entry.isUnread));
});
