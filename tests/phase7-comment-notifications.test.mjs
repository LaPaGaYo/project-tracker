import assert from "node:assert/strict";
import test from "node:test";

import { createCommentRepository } from "../apps/web/src/server/comments/repository.ts";
import { createCommentForUser } from "../apps/web/src/server/comments/service.ts";
import { createNotificationRepository } from "../apps/web/src/server/notifications/repository.ts";
import { listNotificationsForUser } from "../apps/web/src/server/notifications/service.ts";
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
  return `C${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
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

async function createProjectWithItem(harness, owner, workspace, assignee) {
  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Comment Notifications",
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
      title: "Comment notification target",
      assigneeId: assignee.userId,
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

test("comment creation notifies valid mentions, assignee, and prior participants only", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("comment-owner");
  const mentioned = createNamedSession("comment-mentioned");
  const assignee = createNamedSession("comment-assignee");
  const priorParticipant = createNamedSession("comment-participant");
  const outsider = createNamedSession("comment-outsider");
  const workspace = await harness.createWorkspace(owner, "comment-notify");

  await harness.addMembership(workspace.id, mentioned, "member");
  await harness.addMembership(workspace.id, assignee, "member");
  await harness.addMembership(workspace.id, priorParticipant, "member");

  const { projectKey, item } = await createProjectWithItem(harness, owner, workspace, assignee);
  await harness.repositories.commentRepository.createComment({
    workspaceId: workspace.id,
    projectId: item.projectId,
    workItemId: item.id,
    authorId: priorParticipant.userId,
    content: "Existing discussion context"
  });

  const created = await createCommentForUser(
    harness.repositories.commentRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier,
    {
      content: `Please review @${mentioned.userId} @${outsider.userId} @${owner.userId}`
    },
    {
      notificationRepository: harness.repositories.notificationRepository
    }
  );

  const mentionedInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    mentioned,
    workspace.slug
  );
  assert.equal(mentionedInbox.length, 1);
  assert.equal(mentionedInbox[0]?.event.sourceType, "comment");
  assert.equal(mentionedInbox[0]?.event.sourceId, created.id);
  assert.equal(mentionedInbox[0]?.event.eventType, "mention_created");
  assert.equal(mentionedInbox[0]?.recipient.reason, "mention");

  const assigneeInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    assignee,
    workspace.slug
  );
  assert.equal(assigneeInbox.length, 1);
  assert.equal(assigneeInbox[0]?.event.eventType, "comment_created");
  assert.equal(assigneeInbox[0]?.recipient.reason, "participant");

  const participantInbox = await listNotificationsForUser(
    harness.repositories.notificationRepository,
    priorParticipant,
    workspace.slug
  );
  assert.equal(participantInbox.length, 1);
  assert.equal(participantInbox[0]?.event.eventType, "comment_created");
  assert.equal(participantInbox[0]?.recipient.reason, "participant");

  assert.deepEqual(
    await listNotificationsForUser(harness.repositories.notificationRepository, owner, workspace.slug),
    []
  );
  await assert.rejects(
    () => listNotificationsForUser(harness.repositories.notificationRepository, outsider, workspace.slug),
    (error) => error instanceof Error && "status" in error && error.status === 403
  );
});
