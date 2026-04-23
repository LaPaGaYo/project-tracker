import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "../packages/db/src/client.ts";
import { createProjectForUser, getProjectForUser } from "../apps/web/src/server/projects/service.ts";
import { createProjectRepository } from "../apps/web/src/server/projects/repository.ts";
import { getProjectWorkspaceForUser } from "../apps/web/src/server/projects/workspace.ts";
import { createWorkItemForUser } from "../apps/web/src/server/work-items/service.ts";
import { createWorkItemRepository } from "../apps/web/src/server/work-items/repository.ts";
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

function createProjectionDependencies({ project, stages, planItems, tasks, githubStatuses }) {
  const workspace = {
    id: project.workspaceId,
    name: "Alpha Workspace",
    slug: "alpha-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return {
    projectRepository: {
      async findWorkspaceBySlug(slug) {
        return slug === workspace.slug ? workspace : null;
      },
      async getMembership(workspaceId, userId) {
        return {
          workspaceId,
          userId,
          role: "owner",
          invitedAt: new Date().toISOString(),
          joinedAt: null
        };
      },
      async getProjectByKey(workspaceId, projectKey) {
        return workspaceId === project.workspaceId && projectKey === project.key ? project : null;
      },
      async listProjectStages() {
        return stages;
      },
      async listPlanItems() {
        return planItems;
      },
      async listTaskGithubStatuses() {
        return githubStatuses;
      },
      async getProjectGithubConnection() {
        return null;
      }
    },
    workItemRepository: {
      async listWorkItems() {
        return tasks;
      }
    }
  };
}

test.after(async () => {
  await sql.end({ timeout: 0 });
});

test("project workspace view maps real stage, plan, and engineering records", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-a");
  const reviewer = createNamedSession("reviewer-a");
  const workspace = await harness.createWorkspace(owner, "alpha");
  await harness.addMembership(workspace.id, reviewer, "member");

  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Ops Control",
    key: projectKey
  });

  const project = await getProjectForUser(
    harness.repositories.projectRepository,
    owner,
    workspace.slug,
    projectKey
  );

  const drawerTask = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Build issue drawer with activity, comments, and engineering context",
      type: "task",
      priority: "high",
      position: 0
    }
  );
  const approvalTask = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Approve board card hierarchy and issue drawer model",
      type: "task",
      priority: "medium",
      assigneeId: reviewer.userId,
      position: 1000
    }
  );
  const blockedTask = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Revisit incident response checklists",
      type: "task",
      priority: "low",
      blockedReason: "Waiting for operator review",
      position: 2000
    }
  );

  const [foundationStage] = await sql`
    insert into project_stages (project_id, slug, title, goal, status, gate_status, sort_order)
    values (
      ${project.id},
      'foundation-alignment',
      'Phase 1: Foundation Alignment',
      'Stabilize the shared project shell model and document rollout risks.',
      'Completed',
      'Passed',
      0
    )
    returning id, title
  `;
  const [executionStage] = await sql`
    insert into project_stages (project_id, slug, title, goal, status, gate_status, sort_order)
    values (
      ${project.id},
      'execution-surface',
      'Phase 2: Execution Surface',
      'Align the board, plan, and issue drawer model before rollout.',
      'In Progress',
      'In review',
      1
    )
    returning id, title
  `;

  const [foundationPlanItem] = await sql`
    insert into plan_items (stage_id, title, outcome, status, blocker)
    values (
      ${foundationStage.id},
      'Capture rollout risks and operator handoff notes',
      'The rollout has a clear risk register and operator handoff checklist.',
      'Done',
      null
    )
    returning id
  `;
  const [executionPlanItem] = await sql`
    insert into plan_items (stage_id, title, outcome, status, blocker)
    values (
      ${executionStage.id},
      'Finalize board card hierarchy and issue drawer model',
      'The redesigned board and issue detail model are stable enough for implementation.',
      'In Review',
      null
    )
    returning id
  `;

  await sql`
    update tasks
    set stage_id = ${executionStage.id}, plan_item_id = ${executionPlanItem.id}
    where id in (${drawerTask.id}, ${approvalTask.id})
  `;
  await sql`
    update tasks
    set stage_id = ${foundationStage.id}, plan_item_id = ${foundationPlanItem.id}
    where id = ${blockedTask.id}
  `;

  await sql`
    insert into task_github_status (task_id, pr_status, ci_status, deploy_status)
    values
      (${drawerTask.id}, 'Open PR', 'Failing', 'Staging'),
      (${approvalTask.id}, 'Review requested', 'Passing', 'Not deployed'),
      (${blockedTask.id}, 'No PR', 'Unknown', 'Not deployed')
  `;

  const workspaceView = await getProjectWorkspaceForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      workItemRepository: harness.repositories.workItemRepository
    },
    owner,
    workspace.slug,
    projectKey
  );

  assert.equal(workspaceView.plan.currentStage.title, "Phase 2: Execution Surface");
  assert.equal(workspaceView.plan.currentStage.progressLabel, "0/1 plan items complete");
  assert.equal(workspaceView.plan.items[1]?.linkedIssues.join(", "), `${drawerTask.identifier}, ${approvalTask.identifier}`);
  assert.equal(workspaceView.overview.currentStage, "Phase 2: Execution Surface");
  assert.ok(workspaceView.overview.health.includes("Engineering risk: 1 failing check"));
  assert.equal(workspaceView.engineering.pullRequests, "2 open");
  assert.equal(workspaceView.engineering.checks, "1 failing");
  assert.ok(
    workspaceView.engineering.issueSummary.includes(`${drawerTask.identifier} · open · failing · phase 2`)
  );
});

test("project workspace projection preserves plan ordering and production deploy state", async () => {
  const session = createNamedSession("projection-owner");
  const project = {
    id: "project-1",
    workspaceId: "workspace-1",
    key: "OPS",
    itemCounter: 2,
    title: "Ops Control",
    description: "Project workspace projection harness.",
    stage: "Active",
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const stages = [
    {
      id: "stage-0",
      projectId: project.id,
      slug: "foundation-alignment",
      title: "Phase 1: Foundation Alignment",
      goal: "Capture the foundation decisions and operator handoff notes.",
      status: "Completed",
      gateStatus: "Passed",
      sortOrder: 0
    },
    {
      id: "stage-1",
      projectId: project.id,
      slug: "execution-surface",
      title: "Phase 2: Execution Surface",
      goal: "Align the board, plan, and issue drawer model before rollout.",
      status: "In Progress",
      gateStatus: "In review",
      sortOrder: 1
    }
  ];
  const planItems = [
    {
      id: "plan-2",
      stageId: "stage-1",
      title: "Alpha rollout notes",
      outcome: "Secondary item should stay second despite alphabetical precedence.",
      status: "Todo",
      blocker: null,
      sortOrder: 1
    },
    {
      id: "plan-1",
      stageId: "stage-1",
      title: "Zebra gate decision",
      outcome: "Primary item should stay first because of durable plan order.",
      status: "In Review",
      blocker: null,
      sortOrder: 0
    }
  ];
  const tasks = [
    {
      id: "task-1",
      projectId: project.id,
      workspaceId: project.workspaceId,
      identifier: "OPS-1",
      title: "Link the primary plan item",
      description: "",
      status: "Doing",
      type: "task",
      parentId: null,
      assigneeId: null,
      priority: "high",
      labels: null,
      workflowStateId: null,
      stageId: "stage-1",
      planItemId: "plan-1",
      position: 0,
      blockedReason: null,
      dueDate: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  const githubStatuses = [
    {
      id: "github-1",
      taskId: "task-1",
      prStatus: "Merged",
      ciStatus: "Passing",
      deployStatus: "Production"
    }
  ];

  const workspaceView = await getProjectWorkspaceForUser(
    createProjectionDependencies({ project, stages, planItems, tasks, githubStatuses }),
    session,
    "alpha-workspace",
    project.key
  );

  assert.deepEqual(
    workspaceView.plan.items.map((item) => item.title),
    ["Zebra gate decision", "Alpha rollout notes"]
  );
  assert.deepEqual(
    workspaceView.overview.milestones.map((milestone) => milestone.tone),
    ["completed", "current"]
  );
  assert.equal(workspaceView.engineering.deploys, "Production live");
});

test("project workspace overview marks completed stages distinctly from upcoming work", async () => {
  const session = createNamedSession("overview-owner");
  const project = {
    id: "project-2",
    workspaceId: "workspace-2",
    key: "OPS2",
    itemCounter: 0,
    title: "Ops Roadmap",
    description: "Overview milestone tone harness.",
    stage: "Active",
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const stages = [
    {
      id: "stage-completed",
      projectId: project.id,
      slug: "foundation",
      title: "Phase 1: Foundation Alignment",
      goal: "Completed groundwork",
      status: "Completed",
      gateStatus: "Passed",
      sortOrder: 0
    },
    {
      id: "stage-current",
      projectId: project.id,
      slug: "execution",
      title: "Phase 2: Execution Surface",
      goal: "Current rollout work",
      status: "In Progress",
      gateStatus: "In review",
      sortOrder: 1
    },
    {
      id: "stage-upcoming",
      projectId: project.id,
      slug: "engineering",
      title: "Phase 3: Engineering Signals",
      goal: "Upcoming rollout work",
      status: "Planned",
      gateStatus: "Pending",
      sortOrder: 2
    }
  ];

  const workspaceView = await getProjectWorkspaceForUser(
    createProjectionDependencies({
      project,
      stages,
      planItems: [],
      tasks: [],
      githubStatuses: []
    }),
    session,
    "alpha-workspace",
    project.key
  );

  assert.deepEqual(
    workspaceView.overview.milestones.map((milestone) => milestone.tone),
    ["completed", "current", "upcoming"]
  );
});

test("task github status rejects invalid enum values at the database boundary", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-enum");
  const workspace = await harness.createWorkspace(owner, "enum");

  const projectKey = createUniqueProjectKey();
  await createProjectForUser(harness.repositories.projectRepository, owner, workspace.slug, {
    name: "Enum Check",
    key: projectKey
  });

  const task = await createWorkItemForUser(
    harness.repositories.workItemRepository,
    owner,
    workspace.slug,
    projectKey,
    {
      title: "Reject invalid github status values",
      type: "task",
      priority: "medium"
    }
  );

  await assert.rejects(
    async () => {
      await sql`
        insert into task_github_status (task_id, pr_status, ci_status, deploy_status)
        values (${task.id}, 'Bad PR state', 'Passing', 'Staging')
      `;
    },
    /invalid input value for enum|violates check constraint/i
  );
});
