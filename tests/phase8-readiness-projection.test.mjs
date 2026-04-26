import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectReadiness } from "../apps/web/src/server/projects/readiness.ts";

const now = new Date("2026-04-26T12:00:00.000Z").toISOString();

function task(overrides = {}) {
  return {
    id: overrides.id ?? "task-1",
    projectId: "project-1",
    workspaceId: "workspace-1",
    identifier: Object.hasOwn(overrides, "identifier")
      ? overrides.identifier
      : "OPS-1",
    title: overrides.title ?? "Ship the readiness view",
    description: overrides.description ?? "",
    status: overrides.status ?? "Doing",
    type: "task",
    parentId: null,
    assigneeId: overrides.assigneeId ?? "user-2",
    priority: overrides.priority ?? "medium",
    labels: overrides.labels ?? null,
    workflowStateId: null,
    stageId: overrides.stageId ?? "stage-current",
    planItemId: overrides.planItemId ?? "plan-current",
    position: overrides.position ?? 0,
    blockedReason: overrides.blockedReason ?? null,
    dueDate: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function stage(overrides = {}) {
  return {
    id: overrides.id ?? "stage-current",
    projectId: "project-1",
    slug: "current",
    title: overrides.title ?? "Phase 8: Readiness",
    goal: "Make project readiness clear.",
    status: overrides.status ?? "In Progress",
    gateStatus: overrides.gateStatus ?? "In review",
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function planItem(overrides = {}) {
  return {
    id: overrides.id ?? "plan-current",
    stageId: overrides.stageId ?? "stage-current",
    title: overrides.title ?? "Finish readiness projection",
    outcome: "Overview can explain readiness.",
    status: overrides.status ?? "Todo",
    blocker: overrides.blocker ?? null,
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function githubStatus(overrides = {}) {
  return {
    id: overrides.id ?? "github-1",
    taskId: overrides.taskId ?? "task-1",
    prStatus: overrides.prStatus ?? "No PR",
    ciStatus: overrides.ciStatus ?? "Unknown",
    deployStatus: overrides.deployStatus ?? "Not deployed",
  };
}

function inbox(overrides = {}) {
  return {
    event: {
      id: "event-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      workItemId: "task-1",
      sourceType: "work_item",
      sourceId: "task-1",
      eventType: "priority_raised",
      actorId: "user-2",
      priority: overrides.priority ?? "high",
      title: "OPS-1 needs attention",
      body: "Priority was raised.",
      url: "/workspaces/platform-ops/projects/OPS?selected=OPS-1",
      metadata: null,
      createdAt: now,
    },
    recipient: {
      id: "recipient-1",
      eventId: "event-1",
      workspaceId: "workspace-1",
      recipientId: "user-1",
      reason: "participant",
      readAt: overrides.readAt ?? null,
      dismissedAt: null,
      createdAt: now,
    },
    workItemIdentifier: "OPS-1",
    projectKey: "OPS",
    workspaceSlug: "platform-ops",
    isUnread: overrides.readAt === undefined || overrides.readAt === null,
  };
}

test("readiness projection marks blocked projects and explains the primary blockers", () => {
  const readiness = buildProjectReadiness({
    currentStage: stage({ status: "Blocked", gateStatus: "Blocked" }),
    stages: [stage({ status: "Blocked", gateStatus: "Blocked" })],
    planItems: [planItem()],
    tasks: [
      task({
        identifier: "OPS-12",
        title: "Fix release pipeline",
        status: "Blocked",
        blockedReason: "CI is failing",
      }),
    ],
    githubStatuses: [
      githubStatus({
        taskId: "task-1",
        ciStatus: "Failing",
        prStatus: "Open PR",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [],
  });

  assert.equal(readiness.status, "Blocked");
  assert.match(readiness.narrative, /1 failing check/);
  assert.match(readiness.narrative, /1 blocked work item/);
  assert.equal(readiness.decisionCues[0]?.label, "Ship gate");
  assert.equal(readiness.actions[0]?.sourceType, "github");
  assert.equal(readiness.actions[1]?.sourceType, "work_item");
});

test("readiness projection marks projects ready with risk when work remains but blockers are absent", () => {
  const readiness = buildProjectReadiness({
    currentStage: stage(),
    stages: [stage()],
    planItems: [planItem({ status: "In Review" })],
    tasks: [task({ identifier: "OPS-7", priority: "urgent" })],
    githubStatuses: [
      githubStatus({
        prStatus: "Review requested",
        ciStatus: "Passing",
        deployStatus: "Staging",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [inbox()],
  });

  assert.equal(readiness.status, "Ready with risk");
  assert.match(readiness.narrative, /urgent/);
  assert.ok(
    readiness.metrics.some(
      (metric) =>
        metric.label === "Notifications" && metric.value === "1 unread"
    )
  );
  assert.ok(
    readiness.actions.every((action) => !action.id.startsWith("github-deploy-"))
  );
  assert.ok(
    readiness.actions.some((action) => action.sourceType === "notification")
  );
});

test("readiness projection marks stable projects ready", () => {
  const readiness = buildProjectReadiness({
    currentStage: stage({ gateStatus: "Passed" }),
    stages: [stage({ gateStatus: "Passed" })],
    planItems: [planItem({ status: "Done" })],
    tasks: [task({ status: "Done", priority: "medium" })],
    githubStatuses: [
      githubStatus({
        prStatus: "Merged",
        ciStatus: "Passing",
        deployStatus: "Production",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [],
  });

  assert.equal(readiness.status, "Ready");
  assert.match(readiness.narrative, /no blocking work/);
  assert.equal(readiness.actions.length, 0);
});

test("readiness projection ignores completed blocked work items", () => {
  const readiness = buildProjectReadiness({
    currentStage: stage({ gateStatus: "Passed" }),
    stages: [stage({ gateStatus: "Passed" })],
    planItems: [planItem({ status: "Done" })],
    tasks: [
      task({
        status: "Done",
        blockedReason: "Old blocker should not count",
        completedAt: now,
      }),
    ],
    githubStatuses: [
      githubStatus({
        prStatus: "Merged",
        ciStatus: "Passing",
        deployStatus: "Production",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [],
  });

  assert.equal(readiness.status, "Ready");
  assert.equal(readiness.actions.length, 0);
});

test("readiness projection ignores completed urgent work items", () => {
  const readiness = buildProjectReadiness({
    currentStage: stage({ gateStatus: "Passed" }),
    stages: [stage({ gateStatus: "Passed" })],
    planItems: [planItem({ status: "Done" })],
    tasks: [task({ status: "Done", priority: "urgent", completedAt: now })],
    githubStatuses: [
      githubStatus({
        prStatus: "Merged",
        ciStatus: "Passing",
        deployStatus: "Production",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [],
  });

  assert.equal(readiness.status, "Ready");
  assert.equal(readiness.actions.length, 0);
});

test("readiness projection builds stable action hrefs when base project href is provided", () => {
  const readiness = buildProjectReadiness({
    baseProjectHref: "/workspaces/platform-ops/projects/OPS/",
    currentStage: stage({ status: "Blocked", gateStatus: "Blocked" }),
    stages: [stage({ status: "Blocked", gateStatus: "Blocked" })],
    planItems: [planItem()],
    tasks: [
      task({
        id: "task-blocked",
        identifier: "OPS-12",
        status: "Blocked",
        blockedReason: "Waiting on approvals",
      }),
      task({
        id: "task-missing-identifier",
        identifier: null,
        priority: "urgent",
      }),
    ],
    githubStatuses: [
      githubStatus({
        id: "github-failing",
        taskId: "task-blocked",
        ciStatus: "Failing",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [],
  });

  assert.equal(
    readiness.actions.find(
      (action) => action.id === "blocked-work-item-task-blocked"
    )?.href,
    "/workspaces/platform-ops/projects/OPS/items/OPS-12"
  );
  assert.equal(
    readiness.actions.find(
      (action) => action.id === "urgent-work-item-task-missing-identifier"
    )?.href,
    "/workspaces/platform-ops/projects/OPS"
  );
  assert.equal(
    readiness.actions.find(
      (action) => action.id === "github-check-github-failing"
    )?.href,
    "/workspaces/platform-ops/projects/OPS/engineering"
  );
  assert.equal(
    readiness.actions.find((action) => action.id === "plan-plan-current")?.href,
    "/workspaces/platform-ops/projects/OPS/plan"
  );
});

test("readiness projection explains stage-only blocked projects", () => {
  const readiness = buildProjectReadiness({
    baseProjectHref: "/workspaces/platform-ops/projects/OPS",
    currentStage: stage({ status: "Blocked", gateStatus: "Blocked" }),
    stages: [stage({ status: "Blocked", gateStatus: "Blocked" })],
    planItems: [planItem({ status: "Done" })],
    tasks: [],
    githubStatuses: [],
    engineeringItems: [],
    notificationInbox: [],
  });

  assert.equal(readiness.status, "Blocked");
  assert.match(readiness.narrative, /current stage is blocked/);
  assert.equal(readiness.actions[0]?.sourceType, "plan");
  assert.equal(
    readiness.actions[0]?.title,
    "Resolve blocked stage gate: Phase 8: Readiness"
  );
  assert.equal(
    readiness.actions[0]?.href,
    "/workspaces/platform-ops/projects/OPS/plan"
  );
});

test("readiness projection explains staging-only risk", () => {
  const readiness = buildProjectReadiness({
    currentStage: stage(),
    stages: [stage()],
    planItems: [planItem({ status: "Done" })],
    tasks: [task({ status: "Done" })],
    githubStatuses: [
      githubStatus({
        ciStatus: "Passing",
        deployStatus: "Staging",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [],
  });

  assert.equal(readiness.status, "Ready with risk");
  assert.match(readiness.narrative, /staging deploy without production/);
});

test("readiness projection orders action categories and caps actions at five", () => {
  const readiness = buildProjectReadiness({
    baseProjectHref: "/workspaces/platform-ops/projects/OPS",
    currentStage: stage({ status: "Blocked", gateStatus: "Blocked" }),
    stages: [stage({ status: "Blocked", gateStatus: "Blocked" })],
    planItems: [
      planItem({ id: "plan-1" }),
      planItem({ id: "plan-2", title: "Second current-stage plan item" }),
    ],
    tasks: [
      task({
        id: "task-blocked",
        identifier: "OPS-12",
        status: "Blocked",
        blockedReason: "Dependency unavailable",
      }),
      task({
        id: "task-urgent",
        identifier: "OPS-13",
        priority: "urgent",
      }),
    ],
    githubStatuses: [
      githubStatus({
        id: "github-failing",
        taskId: "task-blocked",
        ciStatus: "Failing",
      }),
      githubStatus({
        id: "github-review",
        taskId: "task-urgent",
        prStatus: "Review requested",
        ciStatus: "Passing",
      }),
    ],
    engineeringItems: [],
    notificationInbox: [inbox()],
  });

  assert.deepEqual(
    readiness.actions.map((action) => action.id),
    [
      "github-check-github-failing",
      "blocked-work-item-task-blocked",
      "stage-gate-stage-current",
      "urgent-work-item-task-urgent",
      "github-pr-github-review",
    ]
  );
});
