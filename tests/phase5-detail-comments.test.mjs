import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "../packages/db/src/client.ts";
import { createActivityRepository } from "../apps/web/src/server/activity/repository.ts";
import { getItemActivityForUser } from "../apps/web/src/server/activity/service.ts";
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
  return `P${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7)}`;
}

function createNamedSession(prefix) {
  const suffix = uniqueSuffix();
  return createSession(`${prefix}-${suffix}`, `${prefix}-${suffix}@example.com`);
}

function createRepositories() {
  return {
    activityRepository: createActivityRepository(),
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

async function createProjectWithDefaultStates(harness, owner, workspace, projectKey = "OPS") {
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ops Control",
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

async function importCommentRepositoryFactory() {
  try {
    const module = await import("../apps/web/src/server/comments/repository.ts");
    return module.createCommentRepository;
  } catch (error) {
    assert.fail(`comments repository is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function importCommentServiceModule() {
  try {
    return await import("../apps/web/src/server/comments/service.ts");
  } catch (error) {
    assert.fail(`comments service is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function importDetailHandlersModule() {
  try {
    return await import("../apps/web/src/server/api/detail-handlers.ts");
  } catch (error) {
    assert.fail(`detail handlers are unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createDetailRepositories() {
  const createCommentRepository = await importCommentRepositoryFactory();

  return {
    activityRepository: createActivityRepository(),
    commentRepository: createCommentRepository(),
    projectRepository: createProjectRepository(),
    workItemRepository: createWorkItemRepository(),
    workflowStateRepository: createWorkflowStateRepository()
  };
}

async function createDetailHandlerDependencies(session) {
  const repositories = await createDetailRepositories();

  return {
    getSession: async () => session,
    ...repositories
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("member comment CRUD works and logs activity entries", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  const { states } = await createProjectWithDefaultStates(harness, owner, workspace, projectKey);
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Detail target",
      description: "Initial description",
      workflowStateId: states[0]?.id
    }
  );

  const detailHandlers = await importDetailHandlersModule();
  const dependencies = await createDetailHandlerDependencies(owner);

  const createResponse = await detailHandlers.handleCreateComment(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content: "**First** comment" })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    dependencies
  );

  assert.equal(createResponse.status, 201);
  const { comment: createdComment } = await createResponse.json();
  assert.equal(createdComment.content, "**First** comment");

  const patchResponse = await detailHandlers.handlePatchComment(
    new Request(
      `http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments/${createdComment.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ content: "Edited comment" })
      }
    ),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier, commentId: createdComment.id },
    dependencies
  );

  assert.equal(patchResponse.status, 200);
  const { comment: updatedComment } = await patchResponse.json();
  assert.equal(updatedComment.content, "Edited comment");

  const deleteResponse = await detailHandlers.handleDeleteComment(
    new Request(
      `http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments/${createdComment.id}`,
      {
        method: "DELETE"
      }
    ),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier, commentId: createdComment.id },
    dependencies
  );

  assert.equal(deleteResponse.status, 204);

  const listResponse = await detailHandlers.handleListComments(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments`),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    dependencies
  );

  assert.equal(listResponse.status, 200);
  const { comments } = await listResponse.json();
  assert.deepEqual(comments, []);

  const activity = await getItemActivityForUser(
    harness.repositories.activityRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier
  );

  assert.ok(activity.some((entry) => entry.action === "created" && entry.metadata?.target === "comment"));
  assert.ok(activity.some((entry) => entry.action === "updated" && entry.metadata?.target === "comment"));
  assert.ok(activity.some((entry) => entry.action === "deleted" && entry.metadata?.target === "comment"));
});

test("viewer cannot create comments and admin can delete comments created by others", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const viewer = createNamedSession("viewer-a");
  const admin = createNamedSession("admin-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  const { states } = await createProjectWithDefaultStates(harness, owner, workspace, projectKey);

  await harness.addMembership(workspace.id, viewer, "viewer");
  await harness.addMembership(workspace.id, admin, "admin");

  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Permission target",
      workflowStateId: states[0]?.id
    }
  );

  const detailHandlers = await importDetailHandlersModule();
  const ownerDependencies = await createDetailHandlerDependencies(owner);
  const viewerDependencies = await createDetailHandlerDependencies(viewer);
  const adminDependencies = await createDetailHandlerDependencies(admin);

  const createResponse = await detailHandlers.handleCreateComment(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content: "Owner comment" })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    ownerDependencies
  );

  assert.equal(createResponse.status, 201);
  const { comment } = await createResponse.json();

  const viewerResponse = await detailHandlers.handleCreateComment(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content: "Viewer comment" })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    viewerDependencies
  );

  assert.equal(viewerResponse.status, 403);
  assert.deepEqual(await viewerResponse.json(), {
    error: "only members and above can create comments."
  });

  const adminDeleteResponse = await detailHandlers.handleDeleteComment(
    new Request(
      `http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments/${comment.id}`,
      {
        method: "DELETE"
      }
    ),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier, commentId: comment.id },
    adminDependencies
  );

  assert.equal(adminDeleteResponse.status, 204);
});

test("description updates create versions and preserve newest-first history", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  const { states } = await createProjectWithDefaultStates(harness, owner, workspace, projectKey);
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Versioned task",
      description: "First draft",
      workflowStateId: states[0]?.id
    }
  );

  const detailHandlers = await importDetailHandlersModule();
  const dependencies = await createDetailHandlerDependencies(owner);

  const secondDraftResponse = await detailHandlers.handlePatchDescription(
    new Request(
      `http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/description`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ content: "Second draft" })
      }
    ),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    dependencies
  );

  assert.equal(secondDraftResponse.status, 200);
  const { workItem: secondDraftItem } = await secondDraftResponse.json();
  assert.equal(secondDraftItem.description, "Second draft");

  await wait(5);

  const thirdDraftResponse = await detailHandlers.handlePatchDescription(
    new Request(
      `http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/description`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ content: "Third draft" })
      }
    ),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    dependencies
  );

  assert.equal(thirdDraftResponse.status, 200);
  const { workItem: thirdDraftItem } = await thirdDraftResponse.json();
  assert.equal(thirdDraftItem.description, "Third draft");

  const versionsResponse = await detailHandlers.handleListDescriptionVersions(
    new Request(
      `http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/description/versions`
    ),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    dependencies
  );

  assert.equal(versionsResponse.status, 200);
  const { versions } = await versionsResponse.json();
  assert.equal(versions.length, 2);
  assert.equal(versions[0].content, "Second draft");
  assert.equal(versions[1].content, "First draft");

  const activity = await getItemActivityForUser(
    harness.repositories.activityRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier
  );

  assert.ok(
    activity.some(
      (entry) =>
        entry.action === "updated" &&
        entry.metadata?.after &&
        typeof entry.metadata.after === "object" &&
        entry.metadata.after.description === "Third draft"
    )
  );
});

test("timeline merges non-comment activity with comments in descending timestamp order", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  const { states } = await createProjectWithDefaultStates(harness, owner, workspace, projectKey);
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Timeline target",
      description: "Starting point",
      workflowStateId: states[0]?.id
    }
  );

  const detailHandlers = await importDetailHandlersModule();
  const commentService = await importCommentServiceModule();
  const dependencies = await createDetailHandlerDependencies(owner);

  const firstCommentResponse = await detailHandlers.handleCreateComment(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content: "First comment" })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    dependencies
  );

  assert.equal(firstCommentResponse.status, 201);
  await wait(5);

  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier,
    {
      title: "Retitled timeline item"
    }
  );

  await wait(5);

  const secondCommentResponse = await detailHandlers.handleCreateComment(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content: "Newest comment" })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    dependencies
  );

  assert.equal(secondCommentResponse.status, 201);

  const timeline = await commentService.listWorkItemTimelineForUser(
    {
      activityRepository: harness.repositories.activityRepository,
      commentRepository: (await createDetailRepositories()).commentRepository,
      workItemRepository: harness.repositories.workItemRepository
    },
    owner,
    workspace.slug,
    projectKey,
    item.identifier
  );

  assert.equal(timeline[0]?.kind, "comment");
  assert.equal(timeline[0]?.comment?.content, "Newest comment");
  assert.equal(timeline[1]?.kind, "activity");
  assert.equal(timeline[1]?.activity?.action, "updated");
  assert.equal(timeline[2]?.kind, "comment");
  assert.equal(timeline[2]?.comment?.content, "First comment");
});
