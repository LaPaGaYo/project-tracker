import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { sql } from "../packages/db/src/client.ts";
import { BoardView } from "../apps/web/src/components/board-view.tsx";
import { ListView } from "../apps/web/src/components/list-view.tsx";
import { createActivityRepository } from "../apps/web/src/server/activity/repository.ts";
import {
  handleListWorkItems,
  handlePatchWorkItemPosition
} from "../apps/web/src/server/api/project-handlers.ts";
import {
  createProjectForUser
} from "../apps/web/src/server/projects/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import {
  createWorkItemForUser,
  getWorkItemForUser,
  listWorkItemsForUser,
  updateWorkItemForUser
} from "../apps/web/src/server/work-items/service.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import {
  listWorkflowStatesForUser
} from "../apps/web/src/server/workflow-states/service.ts";
import { createWorkflowStateRepository } from "../apps/web/src/server/workflow-states/repository.ts";
import {
  getItemActivityForUser
} from "../apps/web/src/server/activity/service.ts";
import { createWorkspaceRepository } from "../apps/web/src/server/workspaces/repository.ts";
import { createWorkspaceForUser } from "../apps/web/src/server/workspaces/service.ts";

globalThis.React = React;

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

function createProjectHandlerDependencies(session, repositories) {
  return {
    getSession: async () => session,
    projectRepository: repositories.projectRepository,
    workItemRepository: repositories.workItemRepository,
    workflowStateRepository: repositories.workflowStateRepository,
    activityRepository: repositories.activityRepository
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

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("position update API changes item position", async (t) => {
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
    { title: "Sortable task", workflowStateId: states[0]?.id }
  );

  const response = await handlePatchWorkItemPosition(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/position`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ position: 42 })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const { workItem } = await response.json();
  assert.equal(workItem.position, 42);
});

test("position update with state change updates both fields and logs state_changed", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  const { states } = await createProjectWithDefaultStates(harness, owner, workspace, projectKey);
  const [backlog, , inProgress] = states;
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    { title: "Movable task", workflowStateId: backlog?.id }
  );

  const response = await handlePatchWorkItemPosition(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/position`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ position: 7, workflowStateId: inProgress.id })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const updated = await getWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier
  );
  assert.equal(updated.position, 7);
  assert.equal(updated.workflowStateId, inProgress.id);

  const activity = await getItemActivityForUser(
    harness.repositories.activityRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier
  );
  assert.ok(activity.some((entry) => entry.action === "state_changed"));
});

test("within-column reorder logs moved activity", async (t) => {
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
    { title: "Reorderable task", workflowStateId: states[0]?.id }
  );

  const response = await handlePatchWorkItemPosition(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/position`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ position: 3 })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const activity = await getItemActivityForUser(
    harness.repositories.activityRepository,
    owner,
    workspace.slug,
    projectKey,
    item.identifier
  );
  assert.ok(activity.some((entry) => entry.action === "moved"));
});

test("filter by type returns only matching items", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  await createProjectWithDefaultStates(harness, owner, workspace, projectKey);

  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Epic item",
    type: "epic"
  });
  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Task item",
    type: "task"
  });

  const response = await handleListWorkItems(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items?type=task`),
    { slug: workspace.slug, key: projectKey },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const { workItems } = await response.json();
  assert.deepEqual(workItems.map((item) => item.type), ["task"]);
});

test("filter by priority returns only matching items", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  await createProjectWithDefaultStates(harness, owner, workspace, projectKey);

  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Urgent item",
    priority: "urgent"
  });
  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Low item",
    priority: "low"
  });

  const response = await handleListWorkItems(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items?priority=urgent`),
    { slug: workspace.slug, key: projectKey },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const { workItems } = await response.json();
  assert.deepEqual(workItems.map((item) => item.priority), ["urgent"]);
});

test("filter by assignee returns only matching items", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const assigneeA = createNamedSession("member-a");
  const assigneeB = createNamedSession("member-b");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, assigneeA, "member");
  await harness.addMembership(workspace.id, assigneeB, "member");
  const projectKey = createUniqueProjectKey();
  await createProjectWithDefaultStates(harness, owner, workspace, projectKey);

  const first = await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "A item"
  });
  const second = await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "B item"
  });

  await updateWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, first.identifier, {
    assigneeId: assigneeA.userId
  });
  await updateWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, second.identifier, {
    assigneeId: assigneeB.userId
  });

  const response = await handleListWorkItems(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items?assignee=${encodeURIComponent(assigneeA.userId)}`),
    { slug: workspace.slug, key: projectKey },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const { workItems } = await response.json();
  assert.deepEqual(workItems.map((item) => item.assigneeId), [assigneeA.userId]);
});

test("filter by multiple types returns union", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  await createProjectWithDefaultStates(harness, owner, workspace, projectKey);

  const epic = await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Epic item",
    type: "epic"
  });
  const task = await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Task item",
    type: "task"
  });
  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Subtask item",
    type: "subtask",
    parentId: task.id
  });

  const response = await handleListWorkItems(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items?type=task,epic`),
    { slug: workspace.slug, key: projectKey },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const { workItems } = await response.json();
  assert.ok(workItems.every((item) => item.type === "task" || item.type === "epic"));
  assert.ok(workItems.some((item) => item.type === "epic"));
  assert.ok(workItems.some((item) => item.type === "task"));
  assert.ok(workItems.every((item) => item.id !== epic.id || item.type === "epic"));
});

test("sort by priority returns correct order", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  await createProjectWithDefaultStates(harness, owner, workspace, projectKey);

  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "None item",
    priority: "none"
  });
  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Urgent item",
    priority: "urgent"
  });
  await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Medium item",
    priority: "medium"
  });

  const response = await handleListWorkItems(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items?sort=priority&order=desc`),
    { slug: workspace.slug, key: projectKey },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const { workItems } = await response.json();
  assert.deepEqual(workItems.slice(0, 3).map((item) => item.priority), ["urgent", "medium", "none"]);
});

test("sort by created date returns correct order", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  await createProjectWithDefaultStates(harness, owner, workspace, projectKey);

  const first = await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "First item"
  });
  const second = await createWorkItemForUser(harness.repositories.workItemRepository, owner, workspace.slug, projectKey, {
    title: "Second item"
  });

  const response = await handleListWorkItems(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items?sort=created_at&order=desc`),
    { slug: workspace.slug, key: projectKey },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const { workItems } = await response.json();
  assert.deepEqual(workItems.slice(0, 2).map((item) => item.identifier), [second.identifier, first.identifier]);
});

test("viewer role cannot update position", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const viewer = createNamedSession("viewer-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, viewer, "viewer");
  const projectKey = createUniqueProjectKey();
  const { states } = await createProjectWithDefaultStates(harness, owner, workspace, projectKey);
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    { title: "Locked item", workflowStateId: states[0]?.id }
  );

  const response = await handlePatchWorkItemPosition(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${item.identifier}/position`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ position: 12 })
    }),
    { slug: workspace.slug, key: projectKey, identifier: item.identifier },
    createProjectHandlerDependencies(viewer, harness.repositories)
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "only members and above can update work items."
  });
});

test("board view renders subtasks present in filtered items", () => {
  const state = {
    id: "state-backlog",
    projectId: "project-1",
    name: "Backlog",
    category: "backlog",
    position: 0,
    color: "#64748b",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z"
  };
  const subtask = {
    id: "item-subtask",
    projectId: "project-1",
    workspaceId: "workspace-1",
    identifier: "PRJ-3",
    title: "Visible subtask",
    description: "Should render in board results",
    status: "todo",
    type: "subtask",
    parentId: "item-parent",
    assigneeId: null,
    priority: "medium",
    labels: null,
    workflowStateId: state.id,
    position: 0,
    blockedReason: null,
    dueDate: null,
    completedAt: null,
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z"
  };

  const markup = renderToStaticMarkup(
    createElement(BoardView, {
      workspaceSlug: "alpha",
      projectKey: "PRJ",
      items: [subtask],
      members: [],
      states: [state]
    })
  );

  assert.match(markup, /Visible subtask/);
  assert.doesNotMatch(markup, /No items/);
});

test("list view renders subtasks even when parent is missing from items list (filtered view)", () => {
  const state = {
    id: "state-backlog",
    projectId: "project-1",
    name: "Backlog",
    category: "backlog",
    position: 0,
    color: "#64748b",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z"
  };
  const subtask = {
    id: "item-subtask",
    projectId: "project-1",
    workspaceId: "workspace-1",
    identifier: "PRJ-3",
    title: "Orphaned subtask",
    description: "Should render in list results",
    status: "todo",
    type: "subtask",
    parentId: "item-parent", // Parent is NOT in the items array
    assigneeId: null,
    priority: "medium",
    labels: null,
    workflowStateId: state.id,
    position: 0,
    blockedReason: null,
    dueDate: null,
    completedAt: null,
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z"
  };

  const markup = renderToStaticMarkup(
    createElement(ListView, {
      items: [subtask],
      members: [],
      states: [state],
      disableHooks: true
    })
  );

  assert.match(markup, /Orphaned subtask/);
});

test("position update persists all affected sibling positions", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const projectKey = createUniqueProjectKey();
  const { states } = await createProjectWithDefaultStates(harness, owner, workspace, projectKey);
  const [backlog, todo] = states;

  const moved = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Moved item",
      workflowStateId: backlog?.id,
      position: 0
    }
  );
  const first = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "First target item",
      workflowStateId: todo?.id,
      position: 0
    }
  );
  const second = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Second target item",
      workflowStateId: todo?.id,
      position: 1000
    }
  );

  const response = await handlePatchWorkItemPosition(
    new Request(`http://localhost/api/workspaces/${workspace.slug}/projects/${projectKey}/items/${moved.identifier}/position`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        position: 0,
        workflowStateId: todo.id,
        affectedItems: [
          { identifier: moved.identifier, position: 0, workflowStateId: todo.id },
          { identifier: first.identifier, position: 1000, workflowStateId: todo.id },
          { identifier: second.identifier, position: 2000, workflowStateId: todo.id }
        ]
      })
    }),
    { slug: workspace.slug, key: projectKey, identifier: moved.identifier },
    createProjectHandlerDependencies(owner, harness.repositories)
  );

  assert.equal(response.status, 200);
  const reordered = await listWorkItemsForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    { workflowStateIds: [todo.id] }
  );

  assert.deepEqual(
    reordered.map((item) => ({
      identifier: item.identifier,
      position: item.position
    })),
    [
      { identifier: moved.identifier, position: 0 },
      { identifier: first.identifier, position: 1000 },
      { identifier: second.identifier, position: 2000 }
    ]
  );
});
