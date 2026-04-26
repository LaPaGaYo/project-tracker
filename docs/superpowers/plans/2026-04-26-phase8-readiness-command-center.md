# Phase 8 Readiness Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Overview into a readiness command center with deterministic readiness reporting, source-linked team actions, scoped readiness search, and readiness-critical polish.

**Architecture:** Keep Phase 8 local-first and rule-based. Add a pure server-side readiness projection, wire it into the existing project workspace view model, add a project-scoped Postgres search service plus API route, and render the new Overview as a lead-first readiness snapshot with team actions below.

**Tech Stack:** Next.js App Router, React client components where interactivity is required, Drizzle ORM, Postgres, existing project workspace server loaders, Node integration tests, Vitest UI tests, shared TypeScript contracts.

---

## File Structure

- `apps/web/src/server/projects/readiness.ts` owns pure readiness derivation from project, stage, plan, work item, GitHub, engineering, and inbox inputs.
- `apps/web/src/server/projects/search.ts` owns project-scoped readiness search and RBAC checks.
- `apps/web/src/server/projects/workspace.ts` continues to assemble the project workspace view and now includes readiness in `overview`.
- `apps/web/src/features/overview/overview-view.tsx` becomes the high-level page composition.
- `apps/web/src/features/overview/readiness-summary.tsx` renders the executive snapshot.
- `apps/web/src/features/overview/readiness-signal-card.tsx` renders the signal cards.
- `apps/web/src/features/overview/readiness-action-list.tsx` renders deterministic source-linked team actions.
- `apps/web/src/features/overview/readiness-search.tsx` owns the client-side scoped search UI.
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/search/route.ts` exposes project-scoped search.
- `tests/phase8-readiness-projection.test.mjs` covers pure readiness rules and workspace integration.
- `tests/phase8-project-search.test.mjs` covers search ranking and workspace isolation.
- `tests/phase8-search-api.test.mjs` covers auth, RBAC, query validation, and response shape.
- `apps/web/src/features/overview/__tests__/overview-view.test.tsx` covers the new Overview UI.

---

### Task 1: Add Pure Readiness Projection

**Files:**
- Create: `apps/web/src/server/projects/readiness.ts`
- Create: `tests/phase8-readiness-projection.test.mjs`

- [ ] **Step 1: Write failing tests for readiness status rules**

Add `tests/phase8-readiness-projection.test.mjs` with three pure projection tests:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectReadiness } from "../apps/web/src/server/projects/readiness.ts";

const now = new Date("2026-04-26T12:00:00.000Z").toISOString();

function task(overrides = {}) {
  return {
    id: overrides.id ?? "task-1",
    projectId: "project-1",
    workspaceId: "workspace-1",
    identifier: overrides.identifier ?? "OPS-1",
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
    updatedAt: now
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
    sortOrder: overrides.sortOrder ?? 0
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
    sortOrder: overrides.sortOrder ?? 0
  };
}

function githubStatus(overrides = {}) {
  return {
    id: overrides.id ?? "github-1",
    taskId: overrides.taskId ?? "task-1",
    prStatus: overrides.prStatus ?? "No PR",
    ciStatus: overrides.ciStatus ?? "Unknown",
    deployStatus: overrides.deployStatus ?? "Not deployed"
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
      createdAt: now
    },
    recipient: {
      id: "recipient-1",
      eventId: "event-1",
      workspaceId: "workspace-1",
      recipientId: "user-1",
      reason: "participant",
      readAt: overrides.readAt ?? null,
      dismissedAt: null,
      createdAt: now
    },
    workItemIdentifier: "OPS-1",
    projectKey: "OPS",
    workspaceSlug: "platform-ops",
    isUnread: overrides.readAt === undefined || overrides.readAt === null
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
        blockedReason: "CI is failing"
      })
    ],
    githubStatuses: [githubStatus({ taskId: "task-1", ciStatus: "Failing", prStatus: "Open PR" })],
    engineeringItems: [],
    notificationInbox: []
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
    githubStatuses: [githubStatus({ prStatus: "Review requested", ciStatus: "Passing", deployStatus: "Staging" })],
    engineeringItems: [],
    notificationInbox: [inbox()]
  });

  assert.equal(readiness.status, "Ready with risk");
  assert.match(readiness.narrative, /urgent/);
  assert.ok(readiness.metrics.some((metric) => metric.label === "Notifications" && metric.value === "1 unread"));
  assert.ok(readiness.actions.some((action) => action.sourceType === "notification"));
});

test("readiness projection marks stable projects ready", () => {
  const readiness = buildProjectReadiness({
    currentStage: stage({ gateStatus: "Passed" }),
    stages: [stage({ gateStatus: "Passed" })],
    planItems: [planItem({ status: "Done" })],
    tasks: [task({ status: "Done", priority: "medium" })],
    githubStatuses: [githubStatus({ prStatus: "Merged", ciStatus: "Passing", deployStatus: "Production" })],
    engineeringItems: [],
    notificationInbox: []
  });

  assert.equal(readiness.status, "Ready");
  assert.match(readiness.narrative, /no blocking work/);
  assert.equal(readiness.actions.length, 0);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --import tsx --test tests/phase8-readiness-projection.test.mjs
```

Expected: FAIL because `apps/web/src/server/projects/readiness.ts` does not exist.

- [ ] **Step 3: Implement readiness types and projection**

Create `apps/web/src/server/projects/readiness.ts` with these exported types and functions:

```ts
import type {
  NotificationInboxItem,
  PlanItemRecord,
  ProjectStageRecord,
  TaskGithubStatusRecord,
  WorkItemRecord
} from "@the-platform/shared";

import type { ProjectWorkspaceEngineeringItemView } from "../../features/workspace/project-workspace-view";

export type ProjectReadinessStatus = "Ready" | "Ready with risk" | "Blocked";
export type ProjectReadinessTone = "success" | "warning" | "danger" | "neutral";
export type ProjectReadinessActionSource = "work_item" | "plan" | "github" | "notification";

export interface ProjectReadinessMetric {
  label: string;
  value: string;
  detail: string;
  tone: ProjectReadinessTone;
}

export interface ProjectReadinessDecisionCue {
  label: string;
  value: string;
  tone: ProjectReadinessTone;
}

export interface ProjectReadinessAction {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceType: ProjectReadinessActionSource;
  priority: "high" | "medium" | "low";
}

export interface ProjectReadinessView {
  status: ProjectReadinessStatus;
  tone: ProjectReadinessTone;
  narrative: string;
  metrics: ProjectReadinessMetric[];
  decisionCues: ProjectReadinessDecisionCue[];
  actions: ProjectReadinessAction[];
}

interface BuildProjectReadinessInput {
  currentStage: ProjectStageRecord | null;
  stages: ProjectStageRecord[];
  planItems: PlanItemRecord[];
  tasks: WorkItemRecord[];
  githubStatuses: TaskGithubStatusRecord[];
  engineeringItems: ProjectWorkspaceEngineeringItemView[];
  notificationInbox: NotificationInboxItem[];
}
```

Implement `buildProjectReadiness(input: BuildProjectReadinessInput): ProjectReadinessView` with these deterministic rules:

- `Blocked` if the current stage is `Blocked`, any task has `status === "Blocked"` or a non-empty `blockedReason`, or any GitHub status has `ciStatus === "Failing"`.
- `Ready with risk` if not blocked and any task has `priority === "urgent"`, any GitHub status has `prStatus === "Open PR"` or `prStatus === "Review requested"`, any status has `deployStatus === "Staging"` without a production deploy in the project, any unread notification has event priority `high`, or the current stage has incomplete plan items.
- `Ready` if no blocked rule and no risk rule applies.
- Sort actions by priority order: failing checks, blocked work items, urgent work, review PRs, unread high-priority notifications, incomplete current-stage plan items.
- Cap `actions` at five entries.

- [ ] **Step 4: Run the readiness projection test**

Run:

```bash
node --import tsx --test tests/phase8-readiness-projection.test.mjs
```

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/server/projects/readiness.ts tests/phase8-readiness-projection.test.mjs
git commit -m "feat: add project readiness projection"
```

---

### Task 2: Wire Readiness Into Project Workspace View

**Files:**
- Modify: `apps/web/src/server/projects/workspace.ts`
- Modify: `apps/web/src/app/workspaces/[slug]/projects/[key]/project-page-data.ts`
- Modify: `tests/phase4-project-workspace.test.mjs`

- [ ] **Step 1: Extend workspace projection tests**

In `tests/phase4-project-workspace.test.mjs`, update the first workspace projection test after the existing `workspaceView.overview.health` assertion:

```js
assert.equal(workspaceView.overview.readiness.status, "Blocked");
assert.ok(workspaceView.overview.readiness.metrics.some((metric) => metric.label === "GitHub"));
assert.ok(workspaceView.overview.readiness.actions.some((action) => action.sourceType === "github"));
```

Add a new test near the existing overview milestone test:

```js
test("project workspace overview includes readiness signals from the current user's inbox", async () => {
  const session = createNamedSession("readiness-owner");
  const project = {
    id: "project-readiness",
    workspaceId: "workspace-readiness",
    key: "OPS3",
    itemCounter: 1,
    title: "Ops Readiness",
    description: "Readiness notification harness.",
    stage: "Active",
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const stages = [
    {
      id: "stage-current",
      projectId: project.id,
      slug: "readiness",
      title: "Phase 8: Readiness",
      goal: "Expose project readiness.",
      status: "In Progress",
      gateStatus: "In review",
      sortOrder: 0
    }
  ];
  const notificationInbox = [
    {
      event: {
        id: "event-readiness",
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        sourceType: "system",
        sourceId: "readiness",
        eventType: "github_webhook_failed",
        actorId: null,
        priority: "high",
        title: "Webhook failed",
        body: "GitHub webhook failed processing.",
        url: "/workspaces/alpha-workspace/projects/OPS3/engineering",
        metadata: null,
        createdAt: new Date().toISOString()
      },
      recipient: {
        id: "recipient-readiness",
        eventId: "event-readiness",
        workspaceId: project.workspaceId,
        recipientId: session.userId,
        reason: "system",
        readAt: null,
        dismissedAt: null,
        createdAt: new Date().toISOString()
      },
      workItemIdentifier: null,
      projectKey: project.key,
      workspaceSlug: "alpha-workspace",
      isUnread: true
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
    project.key,
    { notificationInbox }
  );

  assert.equal(workspaceView.overview.readiness.status, "Ready with risk");
  assert.ok(workspaceView.overview.readiness.actions.some((action) => action.sourceType === "notification"));
});
```

- [ ] **Step 2: Run the failing workspace projection test**

Run:

```bash
node --import tsx --test tests/phase4-project-workspace.test.mjs
```

Expected: FAIL because `overview.readiness` is not defined and `getProjectWorkspaceForUser` does not accept notification inbox options.

- [ ] **Step 3: Update workspace view model**

In `apps/web/src/server/projects/workspace.ts`:

- Import `buildProjectReadiness` and `NotificationInboxItem`.
- Add `readiness: ProjectReadinessView` to `ProjectWorkspaceView["overview"]`.
- Add a fourth optional parameter to `getProjectWorkspaceForUser`:

```ts
interface ProjectWorkspaceOptions {
  notificationInbox?: NotificationInboxItem[];
}

export async function getProjectWorkspaceForUser(
  dependencies: ProjectWorkspaceDependencies,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  options: ProjectWorkspaceOptions = {}
): Promise<ProjectWorkspaceView> {
  // existing body
}
```

When building `overview`, call:

```ts
readiness: buildProjectReadiness({
  currentStage,
  stages: sortedStages,
  planItems,
  tasks: sortedTasks,
  githubStatuses,
  engineeringItems,
  notificationInbox: options.notificationInbox ?? []
})
```

- [ ] **Step 4: Pass inbox rows from the project page loader**

In `apps/web/src/app/workspaces/[slug]/projects/[key]/project-page-data.ts`, fetch notifications before calling `getProjectWorkspaceForUser`:

```ts
const [workspaces, project, notificationRows, notificationPreferences] = await Promise.all([
  listWorkspacesForUser(workspaceRepository, session),
  getProjectForUser(projectRepository, session, workspaceSlug, projectKey),
  listNotificationsForUser(notificationRepository, session, workspaceSlug, { limit: 20 }),
  getNotificationPreferencesForUser(notificationRepository, session, workspaceSlug)
]);

const [workspaceView, projectStages, planItems] = await Promise.all([
  getProjectWorkspaceForUser(
    {
      projectRepository,
      workItemRepository
    },
    session,
    workspaceSlug,
    projectKey,
    { notificationInbox: notificationRows }
  ),
  projectRepository.listProjectStages(project.id),
  projectRepository.listPlanItems(project.id)
]);
```

Keep the existing `notificationInbox` object shape returned from `loadProjectPageData`.

- [ ] **Step 5: Run workspace projection tests**

Run:

```bash
node --import tsx --test tests/phase4-project-workspace.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/server/projects/workspace.ts apps/web/src/app/workspaces/[slug]/projects/[key]/project-page-data.ts tests/phase4-project-workspace.test.mjs
git commit -m "feat: wire readiness into project overview data"
```

---

### Task 3: Redesign Overview Readiness UI

**Files:**
- Modify: `apps/web/src/features/overview/overview-view.tsx`
- Create: `apps/web/src/features/overview/readiness-summary.tsx`
- Create: `apps/web/src/features/overview/readiness-signal-card.tsx`
- Create: `apps/web/src/features/overview/readiness-action-list.tsx`
- Modify: `apps/web/src/features/overview/__tests__/overview-view.test.tsx`

- [ ] **Step 1: Replace the Overview UI test with readiness expectations**

Update `apps/web/src/features/overview/__tests__/overview-view.test.tsx` so the fixture includes `overview.readiness`:

```tsx
const overview = {
  currentStage: "Phase 8: Readiness",
  health: ["Scope: stable", "Delivery risk: low", "Engineering risk: stable"],
  milestones: [
    { label: "Notifications", monthStart: 0, monthSpan: 2, tone: "completed" as const },
    { label: "Readiness", monthStart: 2, monthSpan: 2, tone: "current" as const }
  ],
  readiness: {
    status: "Ready with risk" as const,
    tone: "warning" as const,
    narrative: "Ready with risk: 1 PR is awaiting review.",
    metrics: [
      { label: "Plan", value: "4/5 done", detail: "1 current-stage item remains", tone: "warning" as const },
      { label: "Issues", value: "1 urgent", detail: "No blocked work", tone: "warning" as const },
      { label: "GitHub", value: "1 review", detail: "Checks are passing", tone: "warning" as const },
      { label: "Notifications", value: "2 unread", detail: "1 high priority", tone: "warning" as const }
    ],
    decisionCues: [
      { label: "Ship gate", value: "In review", tone: "warning" as const },
      { label: "Primary blocker", value: "None", tone: "success" as const }
    ],
    actions: [
      {
        id: "review-pr-task-1",
        title: "Review OPS-4 pull request",
        detail: "Review requested before release.",
        href: "/workspaces/platform-ops/projects/OPS/engineering",
        sourceType: "github" as const,
        priority: "medium" as const
      }
    ]
  }
};
```

Assert:

```tsx
expect(screen.getByText("Readiness command center")).toBeInTheDocument();
expect(screen.getByText("Ready with risk")).toBeInTheDocument();
expect(screen.getByText("Ready with risk: 1 PR is awaiting review.")).toBeInTheDocument();
expect(screen.getByText("4/5 done")).toBeInTheDocument();
expect(screen.getByText("Decision cues")).toBeInTheDocument();
expect(screen.getByRole("link", { name: /Review OPS-4 pull request/i })).toHaveAttribute(
  "href",
  "/workspaces/platform-ops/projects/OPS/engineering"
);
expect(screen.getByText("Milestone roadmap")).toBeInTheDocument();
```

- [ ] **Step 2: Run the failing UI test**

Run:

```bash
npm run test --workspace @the-platform/web -- overview-view
```

Expected: FAIL because the readiness components are not rendered.

- [ ] **Step 3: Add `ReadinessSignalCard`**

Create `apps/web/src/features/overview/readiness-signal-card.tsx`:

```tsx
import type { ProjectReadinessMetric } from "@/server/projects/readiness";

const toneClass: Record<ProjectReadinessMetric["tone"], string> = {
  danger: "border-red-300/30 bg-red-500/10 text-red-100",
  neutral: "border-white/10 bg-black/10 text-planka-text",
  success: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-500/10 text-amber-100"
};

export function ReadinessSignalCard({ metric }: { metric: ProjectReadinessMetric }) {
  return (
    <article className={`rounded-[1.5rem] border p-4 ${toneClass[metric.tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{metric.label}</p>
      <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
      <p className="mt-2 text-sm leading-6 opacity-75">{metric.detail}</p>
    </article>
  );
}
```

- [ ] **Step 4: Add `ReadinessActionList`**

Create `apps/web/src/features/overview/readiness-action-list.tsx`:

```tsx
import Link from "next/link";

import type { ProjectReadinessAction } from "@/server/projects/readiness";

const sourceLabel: Record<ProjectReadinessAction["sourceType"], string> = {
  github: "GitHub",
  notification: "Notification",
  plan: "Plan",
  work_item: "Work item"
};

export function ReadinessActionList({ actions }: { actions: ProjectReadinessAction[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Team action list</p>
          <h2 className="mt-1 text-2xl font-semibold text-planka-text">Next best moves</h2>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-planka-text-muted">
          Rule based
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {actions.length > 0 ? (
          actions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="block rounded-[1.5rem] border border-white/10 bg-planka-card/70 px-4 py-4 transition hover:border-white/20 hover:bg-planka-selected/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-planka-text">{action.title}</p>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-planka-text-muted">
                  {sourceLabel[action.sourceType]}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-planka-text-muted">{action.detail}</p>
            </Link>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-white/10 bg-planka-card/60 px-4 py-4 text-sm text-planka-text-muted">
            No readiness actions. The current stage has no blocking work or high-priority signals.
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Add `ReadinessSummary`**

Create `apps/web/src/features/overview/readiness-summary.tsx`:

```tsx
import type { ProjectReadinessView } from "@/server/projects/readiness";

import { ReadinessSignalCard } from "./readiness-signal-card";

const statusClass: Record<ProjectReadinessView["tone"], string> = {
  danger: "border-red-300/30 bg-red-500/10 text-red-100",
  neutral: "border-white/10 bg-black/10 text-planka-text",
  success: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-500/10 text-amber-100"
};

export function ReadinessSummary({ readiness }: { readiness: ProjectReadinessView }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-6 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">
            Readiness command center
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold text-planka-text">{readiness.status}</h1>
            <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${statusClass[readiness.tone]}`}>
              {readiness.tone}
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-planka-text-muted">{readiness.narrative}</p>
        </div>
        <aside className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-planka-text-muted">Decision cues</p>
          <dl className="mt-3 space-y-3">
            {readiness.decisionCues.map((cue) => (
              <div key={cue.label} className="flex items-start justify-between gap-4 text-sm">
                <dt className="text-planka-text-muted">{cue.label}</dt>
                <dd className="text-right font-semibold text-planka-text">{cue.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readiness.metrics.map((metric) => (
          <ReadinessSignalCard key={metric.label} metric={metric} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Compose the new Overview**

Modify `apps/web/src/features/overview/overview-view.tsx`:

- Import `ReadinessSummary` and `ReadinessActionList`.
- Render `ReadinessSummary` first.
- Render `MilestoneRoadmap` below it.
- Render `ReadinessActionList` in the right/lower area on desktop.
- Keep the current milestone roadmap visible.

- [ ] **Step 7: Run the Overview UI test**

Run:

```bash
npm run test --workspace @the-platform/web -- overview-view
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/web/src/features/overview apps/web/src/features/overview/__tests__/overview-view.test.tsx
git commit -m "feat: add readiness overview UI"
```

---

### Task 4: Add Project-Scoped Readiness Search Service

**Files:**
- Create: `apps/web/src/server/projects/search.ts`
- Create: `tests/phase8-project-search.test.mjs`

- [ ] **Step 1: Write failing search tests**

Create `tests/phase8-project-search.test.mjs` that:

- creates two workspaces
- creates one project in each workspace
- adds work items, plan items, comments, and GitHub status to the first project
- calls `searchProjectForUser`
- asserts grouped result types and ranking
- asserts cross-workspace data is excluded

Use this assertion shape:

```js
assert.deepEqual(results.results.map((result) => result.type), [
  "work_item",
  "comment",
  "plan",
  "engineering"
]);
assert.equal(results.results[0].title, "OPS-1 Fix release pipeline");
assert.ok(results.results.every((result) => result.href.startsWith(`/workspaces/${workspace.slug}/projects/${projectKey}`)));
assert.ok(!results.results.some((result) => result.title.includes("Other workspace")));
```

- [ ] **Step 2: Run the failing search test**

Run:

```bash
node --import tsx --test tests/phase8-project-search.test.mjs
```

Expected: FAIL because `apps/web/src/server/projects/search.ts` does not exist.

- [ ] **Step 3: Implement search result types**

Create `apps/web/src/server/projects/search.ts` with:

```ts
import { and, eq, ilike, isNull, or } from "drizzle-orm";

import {
  comments,
  db,
  githubPullRequests,
  planItems,
  projectStages,
  projects,
  taskGithubStatus,
  tasks,
  workItemGithubLinks
} from "@the-platform/db";

import { resolveWorkspaceContext } from "../work-management/utils";
import { WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";
import type { ProjectRepository } from "./types";

export type ProjectSearchResultType = "work_item" | "plan" | "comment" | "engineering" | "notification";

export interface ProjectSearchResult {
  id: string;
  type: ProjectSearchResultType;
  title: string;
  snippet: string;
  href: string;
  chip: string;
  rank: number;
}

export interface ProjectSearchResponse {
  query: string;
  results: ProjectSearchResult[];
}

interface SearchProjectDependencies {
  projectRepository: Pick<ProjectRepository, "findWorkspaceBySlug" | "getMembership" | "getProjectByKey">;
}
```

- [ ] **Step 4: Implement `searchProjectForUser`**

Add:

```ts
export async function searchProjectForUser(
  dependencies: SearchProjectDependencies,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  query: string
): Promise<ProjectSearchResponse> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { query: trimmed, results: [] };
  }

  const { workspace } = await resolveWorkspaceContext(
    dependencies.projectRepository,
    session,
    workspaceSlug,
    "viewer"
  );
  const project = await dependencies.projectRepository.getProjectByKey(workspace.id, projectKey);
  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  const pattern = `%${trimmed}%`;
  const baseHref = `/workspaces/${workspace.slug}/projects/${project.key}`;

  const [workItemRows, planRows, commentRows, engineeringRows] = await Promise.all([
    db.select().from(tasks).where(
      and(
        eq(tasks.projectId, project.id),
        or(
          ilike(tasks.identifier, pattern),
          ilike(tasks.title, pattern),
          ilike(tasks.description, pattern)
        )
      )
    ),
    db
      .select({ planItem: planItems, stage: projectStages })
      .from(planItems)
      .innerJoin(projectStages, eq(planItems.stageId, projectStages.id))
      .where(
        and(
          eq(projectStages.projectId, project.id),
          or(
            ilike(planItems.title, pattern),
            ilike(planItems.outcome, pattern),
            ilike(planItems.blocker, pattern),
            ilike(projectStages.title, pattern),
            ilike(projectStages.goal, pattern),
            ilike(projectStages.gateStatus, pattern)
          )
        )
      ),
    db
      .select({ comment: comments, task: tasks })
      .from(comments)
      .innerJoin(tasks, eq(comments.workItemId, tasks.id))
      .where(and(eq(tasks.projectId, project.id), isNull(comments.deletedAt), ilike(comments.content, pattern))),
    db
      .select({ task: tasks, githubStatus: taskGithubStatus, pullRequest: githubPullRequests })
      .from(taskGithubStatus)
      .innerJoin(tasks, eq(taskGithubStatus.taskId, tasks.id))
      .leftJoin(workItemGithubLinks, eq(workItemGithubLinks.workItemId, tasks.id))
      .leftJoin(githubPullRequests, eq(workItemGithubLinks.pullRequestId, githubPullRequests.id))
      .where(
        and(
          eq(tasks.projectId, project.id),
          or(
            ilike(tasks.identifier, pattern),
            ilike(tasks.title, pattern),
            ilike(githubPullRequests.title, pattern),
            ilike(githubPullRequests.headBranch, pattern)
          )
        )
      )
  ]);

  const results: ProjectSearchResult[] = [
    ...workItemRows.map((item) => ({
      id: `work-item-${item.id}`,
      type: "work_item" as const,
      title: `${item.identifier ?? "Work item"} ${item.title}`,
      snippet: item.description || item.status,
      href: `${baseHref}?selected=${item.identifier ?? item.id}`,
      chip: item.priority === "urgent" || item.status === "Blocked" ? "Risk" : item.status,
      rank: item.identifier?.toLowerCase() === trimmed.toLowerCase() ? 0 : 10
    })),
    ...commentRows.map((row) => ({
      id: `comment-${row.comment.id}`,
      type: "comment" as const,
      title: `${row.task.identifier ?? "Comment"} comment`,
      snippet: row.comment.content,
      href: `${baseHref}?selected=${row.task.identifier ?? row.task.id}`,
      chip: "Comment",
      rank: 30
    })),
    ...planRows.map((row) => ({
      id: `plan-${row.planItem.id}`,
      type: "plan" as const,
      title: row.planItem.title,
      snippet: row.planItem.blocker ?? row.planItem.outcome,
      href: `${baseHref}/plan`,
      chip: row.stage.gateStatus,
      rank: row.planItem.blocker ? 20 : 40
    })),
    ...engineeringRows.map((row) => ({
      id: `engineering-${row.task.id}`,
      type: "engineering" as const,
      title: `${row.task.identifier ?? "Work item"} engineering`,
      snippet: row.pullRequest?.title ?? `${row.githubStatus.prStatus} · ${row.githubStatus.ciStatus}`,
      href: `${baseHref}/engineering`,
      chip: row.githubStatus.ciStatus === "Failing" ? "Failing" : row.githubStatus.prStatus,
      rank: row.githubStatus.ciStatus === "Failing" ? 20 : 50
    }))
  ];

  return {
    query: trimmed,
    results: results.sort((left, right) => left.rank - right.rank || left.title.localeCompare(right.title)).slice(0, 20)
  };
}
```

If `ilike` rejects nullable columns during typecheck, wrap nullable text fields with `sql<string>` expressions in the implementation.

- [ ] **Step 5: Run search tests**

Run:

```bash
node --import tsx --test tests/phase8-project-search.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/server/projects/search.ts tests/phase8-project-search.test.mjs
git commit -m "feat: add project readiness search service"
```

---

### Task 5: Add Search API Route

**Files:**
- Create: `apps/web/src/app/api/workspaces/[slug]/projects/[key]/search/route.ts`
- Create: `tests/phase8-search-api.test.mjs`

- [ ] **Step 1: Write failing API tests**

Create `tests/phase8-search-api.test.mjs` with tests for:

- authenticated workspace member can search
- query shorter than 2 characters returns empty results
- non-member receives 403
- missing project receives 404

Use route-level request calls by importing `GET` from the route file and stubbing session through the same pattern used in existing API tests.

- [ ] **Step 2: Run the failing API test**

Run:

```bash
node --import tsx --test tests/phase8-search-api.test.mjs
```

Expected: FAIL because the route file does not exist.

- [ ] **Step 3: Implement the route**

Create `apps/web/src/app/api/workspaces/[slug]/projects/[key]/search/route.ts`:

```ts
import { getAppSession } from "@/server/auth";
import { createProjectRepository } from "@/server/projects/repository";
import { searchProjectForUser } from "@/server/projects/search";
import { WorkspaceError } from "@/server/workspaces/core";

const dependencies = {
  getSession: getAppSession,
  projectRepository: createProjectRepository()
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function handleError(error: unknown) {
  if (error instanceof WorkspaceError) {
    return json({ error: error.message }, error.status);
  }

  throw error;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
    }>;
  }
) {
  const session = await dependencies.getSession();
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  const params = await context.params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  try {
    const results = await searchProjectForUser(
      { projectRepository: dependencies.projectRepository },
      session,
      params.slug,
      params.key,
      query
    );
    return json(results);
  } catch (error) {
    return handleError(error);
  }
}
```

- [ ] **Step 4: Run API tests**

Run:

```bash
node --import tsx --test tests/phase8-search-api.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/app/api/workspaces/[slug]/projects/[key]/search/route.ts tests/phase8-search-api.test.mjs
git commit -m "feat: add readiness search api"
```

---

### Task 6: Add Scoped Search UI to Overview

**Files:**
- Create: `apps/web/src/features/overview/readiness-search.tsx`
- Modify: `apps/web/src/features/overview/overview-view.tsx`
- Modify: `apps/web/src/features/overview/__tests__/overview-view.test.tsx`

- [ ] **Step 1: Extend Overview UI tests for search states**

In `overview-view.test.tsx`, add a test that stubs `fetch`, types `pipeline`, and expects grouped results:

```tsx
it("searches readiness signals from the overview", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        query: "pipeline",
        results: [
          {
            id: "work-item-1",
            type: "work_item",
            title: "OPS-1 Fix release pipeline",
            snippet: "Pipeline blocks the release.",
            href: "/workspaces/platform-ops/projects/OPS?selected=OPS-1",
            chip: "Risk",
            rank: 0
          }
        ]
      })
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={overview} />);

  fireEvent.change(screen.getByPlaceholderText("Search blockers, PRs, comments..."), {
    target: { value: "pipeline" }
  });

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/platform-ops/projects/OPS/search?q=pipeline");
  });
  expect(await screen.findByRole("link", { name: /OPS-1 Fix release pipeline/i })).toHaveAttribute(
    "href",
    "/workspaces/platform-ops/projects/OPS?selected=OPS-1"
  );
});
```

Import `fireEvent`, `waitFor`, and `vi` at the top of the test file.

- [ ] **Step 2: Run the failing Overview search test**

Run:

```bash
npm run test --workspace @the-platform/web -- overview-view
```

Expected: FAIL because `OverviewView` does not accept `workspaceSlug` and `projectKey`, and `ReadinessSearch` does not exist.

- [ ] **Step 3: Create `ReadinessSearch`**

Create `apps/web/src/features/overview/readiness-search.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { ProjectSearchResult } from "@/server/projects/search";

interface ReadinessSearchProps {
  workspaceSlug: string;
  projectKey: string;
}

export function ReadinessSearch({ workspaceSlug, projectKey }: ReadinessSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateQuery(value: string) {
    setQuery(value);
    setError(null);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    startTransition(async () => {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/projects/${projectKey}/search?q=${encodeURIComponent(value.trim())}`
      );

      if (!response.ok) {
        setError("Search failed. Try again from the project overview.");
        setResults([]);
        return;
      }

      const body = (await response.json()) as { results: ProjectSearchResult[] };
      setResults(body.results);
    });
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Readiness search</p>
      <input
        className="mt-4 w-full rounded-[1.25rem] border border-white/10 bg-planka-card/80 px-4 py-3 text-sm text-planka-text outline-none transition placeholder:text-planka-text-muted focus:border-white/30"
        placeholder="Search blockers, PRs, comments..."
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
      />
      {isPending ? <p className="mt-3 text-sm text-planka-text-muted">Searching readiness signals...</p> : null}
      {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {results.map((result) => (
          <Link
            key={result.id}
            href={result.href}
            className="block rounded-[1.25rem] border border-white/10 bg-planka-card/70 px-4 py-3 transition hover:border-white/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-planka-text">{result.title}</p>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs uppercase tracking-[0.12em] text-planka-text-muted">
                {result.chip}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-planka-text-muted">{result.snippet}</p>
          </Link>
        ))}
        {query.trim().length >= 2 && !isPending && !error && results.length === 0 ? (
          <p className="rounded-[1.25rem] border border-white/10 bg-planka-card/60 px-4 py-3 text-sm text-planka-text-muted">
            No readiness signals found for "{query.trim()}".
          </p>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire search into `OverviewView`**

Change `OverviewView` props:

```ts
export function OverviewView({
  brief,
  overview,
  workspaceSlug,
  projectKey
}: {
  brief: string;
  overview: OverviewViewModel;
  workspaceSlug: string;
  projectKey: string;
}) {
  // render ReadinessSearch in the lower right section
}
```

Update `apps/web/src/app/workspaces/[slug]/projects/[key]/overview/page.tsx` to pass `workspace.slug` and `project.key` from `loadProjectPageData`.

- [ ] **Step 5: Run Overview UI tests**

Run:

```bash
npm run test --workspace @the-platform/web -- overview-view
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/features/overview/readiness-search.tsx apps/web/src/features/overview/overview-view.tsx apps/web/src/features/overview/__tests__/overview-view.test.tsx apps/web/src/app/workspaces/[slug]/projects/[key]/overview/page.tsx
git commit -m "feat: add readiness search UI"
```

---

### Task 7: Add Readiness-Critical Polish States

**Files:**
- Modify: `apps/web/src/features/overview/readiness-action-list.tsx`
- Modify: `apps/web/src/features/overview/readiness-search.tsx`
- Modify: `apps/web/src/features/engineering/engineering-view.tsx`
- Modify: `apps/web/src/features/overview/__tests__/overview-view.test.tsx`
- Modify: `apps/web/src/features/engineering/__tests__/engineering-view.test.tsx`

- [ ] **Step 1: Add UI tests for empty and no-repository states**

In `overview-view.test.tsx`, assert empty actions are explicit:

```tsx
const readyOverview = {
  ...overview,
  readiness: {
    ...overview.readiness,
    status: "Ready" as const,
    tone: "success" as const,
    narrative: "Ready: current stage has no blocking work and engineering signals are stable.",
    actions: []
  }
};

render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={readyOverview} />);

expect(screen.getByText("No readiness actions. The current stage has no blocking work or high-priority signals.")).toBeInTheDocument();
```

In `engineering-view.test.tsx`, assert no repository connected renders a clear setup state:

```tsx
expect(screen.getByText("Connect GitHub to populate engineering readiness signals.")).toBeInTheDocument();
```

- [ ] **Step 2: Run failing UI tests**

Run:

```bash
npm run test --workspace @the-platform/web -- overview-view engineering-view
```

Expected: FAIL if the engineering no-repository state is not explicit.

- [ ] **Step 3: Improve Engineering empty states**

In `apps/web/src/features/engineering/engineering-view.tsx`, when `engineering.connectionStatus === "Setup required"`, render:

```tsx
<div className="mt-4 rounded-[1.5rem] border border-dashed border-white/15 bg-black/10 px-4 py-4 text-sm leading-6 text-planka-text-muted">
  Connect GitHub to populate engineering readiness signals.
</div>
```

Keep current linked PR, failing checks, deployments, and issue summary sections intact.

- [ ] **Step 4: Improve search empty and error copy**

In `ReadinessSearch`, keep three distinct states:

- query shorter than 2 characters: `Search across blockers, PRs, comments, plan items, and notifications.`
- no results: `No readiness signals found for "{query}".`
- failed request: `Search failed. Try again from the project overview.`

- [ ] **Step 5: Run UI tests**

Run:

```bash
npm run test --workspace @the-platform/web -- overview-view engineering-view
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/features/overview apps/web/src/features/engineering
git commit -m "feat: polish readiness empty states"
```

---

### Task 8: Final Documentation and Verification

**Files:**
- Modify: `docs/product/idea-brief.md`
- Modify: `docs/product/decision-brief.md`
- Modify: `docs/product/prd.md`
- Modify: `docs/superpowers/plans/2026-04-26-phase8-readiness-command-center.md`

- [ ] **Step 1: Update product docs for Phase 8**

Update product docs so they identify Phase 8 as:

- Readiness Command Center
- lead-first Overview reporting
- deterministic team action list
- scoped readiness search
- readiness-critical polish

Keep Phase 8 non-goals explicit:

- no global portfolio dashboard
- no analytics warehouse
- no AI-generated recommendations
- no full-text infrastructure
- no global command palette

- [ ] **Step 2: Mark completed plan tasks**

In this plan file, check off completed task steps as implementation progresses.

- [ ] **Step 3: Run targeted tests**

Run:

```bash
node --import tsx --test tests/phase8-readiness-projection.test.mjs tests/phase8-project-search.test.mjs tests/phase8-search-api.test.mjs
npm run test --workspace @the-platform/web -- overview-view engineering-view
```

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Browser smoke check**

Start the app from the Phase 8 worktree:

```bash
npm run dev
```

Open the local Next.js URL and verify:

- Overview shows `Readiness command center`.
- The readiness status matches seeded project signals.
- Team action list links navigate to existing project surfaces.
- Search query with a known identifier returns a work item result.
- Search query with no result shows the no-result state.
- Engineering no-repository projects show the setup state.

- [ ] **Step 6: Commit final docs**

Run:

```bash
git add docs/product/idea-brief.md docs/product/decision-brief.md docs/product/prd.md docs/superpowers/plans/2026-04-26-phase8-readiness-command-center.md
git commit -m "docs: finalize phase 8 readiness plan"
```
