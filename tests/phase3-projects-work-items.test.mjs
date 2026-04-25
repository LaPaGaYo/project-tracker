import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "../packages/db/src/client.ts";
import { createActivityRepository } from "../apps/web/src/server/activity/repository.ts";
import {
  createProjectForUser,
  deleteProjectForUser,
  getProjectForUser,
  listProjectsForUser
} from "../apps/web/src/server/projects/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { handleListProjects } from "../apps/web/src/server/api/project-handlers.ts";
import { createNotificationRepository } from "../apps/web/src/server/notifications/repository.ts";
import {
  createWorkItemForUser,
  deleteWorkItemForUser,
  getWorkItemForUser,
  updateWorkItemForUser
} from "../apps/web/src/server/work-items/service.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
import {
  createWorkflowStateForUser,
  deleteWorkflowStateForUser,
  listWorkflowStatesForUser,
  updateWorkflowStateForUser
} from "../apps/web/src/server/workflow-states/service.ts";
import { createWorkflowStateRepository } from "../apps/web/src/server/workflow-states/repository.ts";
import {
  getItemActivityForUser,
  getProjectActivityForUser
} from "../apps/web/src/server/activity/service.ts";
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

function expectWorkspaceError(status, message) {
  return {
    name: "WorkspaceError",
    status,
    ...(message ? { message } : {})
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
    notificationRepository: createNotificationRepository(),
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
    notificationRepository: repositories.notificationRepository,
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

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("create project in workspace, verify workspace scoping", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  const project = await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  assert.equal(project.workspaceId, workspace.id);
  const projects = await listProjectsForUser(harness.repositories.projectRepository, owner, workspace.slug);
  assert.equal(projects.length, 1);
});

test("create work items with hierarchy and verify depth limit", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const member = createNamedSession("member-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, member, "member");

  await createProjectForUser(harness.repositories.projectRepository, member, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  const epic = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    member,
    workspace.slug,
    "OPS",
    { title: "Epic", type: "epic" }
  );
  const task = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    member,
    workspace.slug,
    "OPS",
    { title: "Task", type: "task", parentId: epic.id }
  );
  const subtask = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    member,
    workspace.slug,
    "OPS",
    { title: "Subtask", type: "subtask", parentId: task.id }
  );

  assert.equal(subtask.parentId, task.id);

  await assert.rejects(
    createWorkItemForUser(harness.repositories.workItemRepository, member, workspace.slug, "OPS", {
      title: "Too Deep",
      type: "subtask",
      parentId: subtask.id
    }),
    expectWorkspaceError(400, "subtasks cannot have children.")
  );
});

test("verify human-readable ID generation", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const member = createNamedSession("member-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, member, "member");
  await createProjectForUser(harness.repositories.projectRepository, member, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  const first = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    member,
    workspace.slug,
    "OPS",
    { title: "First task" }
  );
  const second = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    member,
    workspace.slug,
    "OPS",
    { title: "Second task" }
  );

  assert.equal(first.identifier, "OPS-1");
  assert.equal(second.identifier, "OPS-2");
});

test("assign work item to workspace member", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const memberA = createNamedSession("member-a");
  const memberB = createNamedSession("member-b");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, memberA, "member");
  await harness.addMembership(workspace.id, memberB, "member");
  await createProjectForUser(harness.repositories.projectRepository, memberA, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    memberA,
    workspace.slug,
    "OPS",
    { title: "Assignable task" }
  );

  const updated = await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    memberA,
    workspace.slug,
    "OPS",
    item.identifier,
    { assigneeId: memberB.userId }
  );

  assert.equal(updated.assigneeId, memberB.userId);
});

test("move work item through workflow states", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const admin = createNamedSession("admin-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, admin, "admin");
  await createProjectForUser(harness.repositories.projectRepository, admin, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  const [backlog, todo, inProgress] = await listWorkflowStatesForUser(
    harness.repositories.workflowStateRepository,
    admin,
    workspace.slug,
    "OPS"
  );
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    admin,
    workspace.slug,
    "OPS",
    { title: "Stateful task", workflowStateId: backlog.id }
  );

  const updated = await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    admin,
    workspace.slug,
    "OPS",
    item.identifier,
    { workflowStateId: inProgress.id }
  );

  assert.equal(updated.workflowStateId, inProgress.id);
  assert.notEqual(todo.id, inProgress.id);
});

test("verify activity log entries for each mutation", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });
  const project = await getProjectForUser(
    harness.repositories.projectRepository,
    owner,
    workspace.slug,
    "OPS"
  );
  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    "OPS",
    { title: "Audited task" }
  );
  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    "OPS",
    item.identifier,
    { priority: "high" }
  );

  const projectActivity = await getProjectActivityForUser(
    harness.repositories.activityRepository,
    owner,
    workspace.slug,
    "OPS"
  );
  const itemActivity = await getItemActivityForUser(
    harness.repositories.activityRepository,
    owner,
    workspace.slug,
    "OPS",
    item.identifier
  );

  assert.ok(projectActivity.some((entry) => entry.entityId === project.id && entry.action === "created"));
  assert.ok(itemActivity.some((entry) => entry.entityId === item.id && entry.action === "updated"));
});

test("viewer role cannot create project or work item", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const viewer = createNamedSession("viewer-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, viewer, "viewer");

  await assert.rejects(
    createProjectForUser(harness.repositories.projectRepository, viewer, workspace.slug, {
      name: "Ops Control",
      key: "OPS"
    }),
    expectWorkspaceError(403)
  );

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  await assert.rejects(
    createWorkItemForUser(harness.repositories.workItemRepository, viewer, workspace.slug, "OPS", {
      title: "Blocked task"
    }),
    expectWorkspaceError(403)
  );
});

test("member cannot delete project", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const member = createNamedSession("member-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, member, "member");

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  await assert.rejects(
    deleteProjectForUser(harness.repositories.projectRepository, member, workspace.slug, "OPS"),
    expectWorkspaceError(403)
  );
});

test("cross-workspace isolation returns 403 through the real projects API", async (t) => {
  const harness = createPersistedHarness(t);
  const ownerA = createNamedSession("owner-a");
  const ownerB = createNamedSession("owner-b");
  const alphaWorkspace = await harness.createWorkspace(ownerA, "alpha");
  await harness.createWorkspace(ownerB, "beta");

  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, ownerA, alphaWorkspace.slug, {
    name: "Ops Control",
    key: projectKey
  });

  const response = await handleListProjects(
    new Request(`http://localhost/api/workspaces/${alphaWorkspace.slug}/projects`),
    { slug: alphaWorkspace.slug },
    createProjectHandlerDependencies(ownerB, harness.repositories)
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "workspace access denied."
  });
});

test("concurrent ID generation yields distinct sequential IDs in the real repository", async (t) => {
  const harness = createPersistedHarness(t);
  const session = createNamedSession("member-a");
  const workspace = await harness.createWorkspace(session, "gamma");
  const projectKey = createUniqueProjectKey();

  await createProjectForUser(harness.repositories.projectRepository, session, workspace.slug, {
    name: "Ops Control",
    key: projectKey
  });

  const [first, second] = await Promise.all([
    createWorkItemForUser(harness.repositories.workItemRepository, session, workspace.slug, projectKey, {
      title: "Parallel task A"
    }),
    createWorkItemForUser(harness.repositories.workItemRepository, session, workspace.slug, projectKey, {
      title: "Parallel task B"
    })
  ]);

  assert.deepEqual(
    [first.identifier, second.identifier].sort(),
    [`${projectKey}-1`, `${projectKey}-2`]
  );
});

test("owner-only state changes enforce non-empty state before delete", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const workspace = await harness.createWorkspace(owner, "alpha");

  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  const states = await listWorkflowStatesForUser(
    harness.repositories.workflowStateRepository,
    owner,
    workspace.slug,
    "OPS"
  );

  const blockedState = await createWorkflowStateForUser(
    harness.repositories.workflowStateRepository,
    owner,
    workspace.slug,
    "OPS",
    { name: "Blocked", category: "active", color: "#f97316" }
  );

  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    "OPS",
    { title: "Blocked task", workflowStateId: blockedState.id }
  );

  await assert.rejects(
    deleteWorkflowStateForUser(
      harness.repositories.workflowStateRepository,
      owner,
      workspace.slug,
      "OPS",
      blockedState.id
    ),
    expectWorkspaceError(409, "workflow state still has work items.")
  );

  await updateWorkflowStateForUser(
    harness.repositories.workflowStateRepository,
    owner,
    workspace.slug,
    "OPS",
    blockedState.id,
    { name: "Blocked Intake" }
  );
  await updateWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    "OPS",
    item.identifier,
    { workflowStateId: states[0].id }
  );
  await deleteWorkflowStateForUser(
    harness.repositories.workflowStateRepository,
    owner,
    workspace.slug,
    "OPS",
    blockedState.id
  );
});

test("creator can delete their own work item while viewer cannot", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const member = createNamedSession("member-a");
  const viewer = createNamedSession("viewer-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, member, "member");
  await harness.addMembership(workspace.id, viewer, "viewer");
  await createProjectForUser(harness.repositories.projectRepository, member, workspace.slug, {
    name: "Ops Control",
    key: "OPS"
  });

  const item = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    member,
    workspace.slug,
    "OPS",
    { title: "Disposable task" }
  );

  await assert.rejects(
    deleteWorkItemForUser(harness.repositories.workItemRepository, viewer, workspace.slug, "OPS", item.identifier),
    expectWorkspaceError(403)
  );

  await deleteWorkItemForUser(
    harness.repositories.workItemRepository,
    member,
    workspace.slug,
    "OPS",
    item.identifier
  );

  await assert.rejects(
    getWorkItemForUser(harness.repositories.workItemRepository, member, workspace.slug, "OPS", item.identifier),
    expectWorkspaceError(404)
  );
});
