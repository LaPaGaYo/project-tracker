import assert from "node:assert/strict";
import test from "node:test";

import { createCommentRepository } from "../apps/web/src/server/comments/repository.ts";
import { createNotificationRepository } from "../apps/web/src/server/notifications/repository.ts";
import { listNotificationsForUser } from "../apps/web/src/server/notifications/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { createProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import {
  createWorkItemForUser,
  updateWorkItemForUser
} from "../apps/web/src/server/work-items/service.ts";
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
  return `W${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
}

function createRepositories() {
  return {
    commentRepository: createCommentRepository(),
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

async function createProjectWithStates(harness, owner, workspace) {
  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Work Item Notifications",
    key: projectKey
  });

  const states = await listWorkflowStatesForUser(
    harness.repositories.workflowStateRepository,
    owner,
    workspace.slug,
    projectKey
  );

  return {
    projectKey,
    states
  };
}

function eventsByType(inbox, eventType) {
  return inbox.filter((entry) => entry.event.eventType === eventType);
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("work item assignment updates notify only the new assignee", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("wi-owner");
  const firstAssignee = createNamedSession("wi-first");
  const secondAssignee = createNamedSession("wi-second");
  const workspace = await harness.createWorkspace(owner, "workitem-assign");

  await harness.addMembership(workspace.id, firstAssignee, "member");
  await harness.addMembership(workspace.id, secondAssignee, "member");
  const { projectKey, states } = await createProjectWithStates(harness, owner, workspace);
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Assignment target",
      workflowStateId: states[0]?.id
    }
  );

  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier,
    {
      assigneeId: firstAssignee.userId
    },
    {
      notificationRepository: harness.repositories.notificationRepository
    }
  );
  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier,
    {
      assigneeId: secondAssignee.userId
    },
    {
      notificationRepository: harness.repositories.notificationRepository
    }
  );

  const firstInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    firstAssignee,
    workspace.slug
  );
  assert.equal(eventsByType(firstInbox, "assignment_changed").length, 1);
  assert.equal(eventsByType(firstInbox, "assignment_changed")[0]?.recipient.reason, "assigned");

  const secondInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    secondAssignee,
    workspace.slug
  );
  assert.equal(eventsByType(secondInbox, "assignment_changed").length, 1);
  assert.equal(eventsByType(secondInbox, "assignment_changed")[0]?.recipient.reason, "assigned");

  assert.deepEqual(
    await listNotificationsForUser(harness.repositories.notificationRepository, owner, workspace.slug),
    []
  );
});

test("state changes and urgent priority notify assignee plus prior participants without notifying the actor", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("wi-owner");
  const assignee = createNamedSession("wi-assignee");
  const priorParticipant = createNamedSession("wi-participant");
  const metadataEditor = createNamedSession("wi-editor");
  const workspace = await harness.createWorkspace(owner, "workitem-change");

  await harness.addMembership(workspace.id, assignee, "member");
  await harness.addMembership(workspace.id, priorParticipant, "member");
  await harness.addMembership(workspace.id, metadataEditor, "member");
  const { projectKey, states } = await createProjectWithStates(harness, owner, workspace);
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "State and priority target",
      assigneeId: assignee.userId,
      priority: "high",
      workflowStateId: states[0]?.id
    }
  );
  await harness.repositories.commentRepository.createComment({
    workspaceId: workspace.id,
    projectId: item.projectId,
    workItemId: item.id,
    authorId: priorParticipant.userId,
    content: "Following this item"
  });
  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    metadataEditor,
    workspace.slug,
    projectKey,
    item.identifier,
    {
      title: "Edited metadata only"
    }
  );

  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier,
    {
      workflowStateId: states[1]?.id
    },
    {
      notificationRepository: harness.repositories.notificationRepository
    }
  );
  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier,
    {
      priority: "urgent"
    },
    {
      notificationRepository: harness.repositories.notificationRepository
    }
  );

  const assigneeInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    assignee,
    workspace.slug
  );
  assert.equal(eventsByType(assigneeInbox, "state_changed").length, 1);
  assert.equal(eventsByType(assigneeInbox, "state_changed")[0]?.recipient.reason, "assigned");
  assert.equal(eventsByType(assigneeInbox, "priority_raised").length, 1);

  const participantInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    priorParticipant,
    workspace.slug
  );
  assert.equal(eventsByType(participantInbox, "state_changed").length, 1);
  assert.equal(eventsByType(participantInbox, "state_changed")[0]?.recipient.reason, "participant");
  assert.equal(eventsByType(participantInbox, "priority_raised").length, 1);

  assert.deepEqual(
    await listNotificationsForUser(harness.repositories.notificationRepository, owner, workspace.slug),
    []
  );
  assert.deepEqual(
    await listNotificationsForUser(harness.repositories.notificationRepository, metadataEditor, workspace.slug),
    []
  );
});
