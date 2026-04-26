# Idea Brief: Phase 8 - Readiness Command Center

## Problem

The project workspace now has Jira-like execution, plan alignment, lightweight comments, live GitHub engineering status, and in-app notifications. The remaining product gap is decision clarity: teams can see many surfaces, but they still need to interpret whether the current project is ready to move forward and what the next team action should be.

Without a lead-first readiness surface, project owners must synthesize plan progress, blocked work, engineering signals, and notifications manually.

## Goals

1. **Readiness Command Center** - Make Overview the primary project decision surface.

2. **Lead-first Overview reporting** - Show readiness status, narrative, signal metrics, decision cues, and milestone context before detailed execution views.

3. **Deterministic team action list** - Convert local project, plan, work item, GitHub, and notification signals into explainable source-linked actions.

4. **Scoped readiness search** - Add project-scoped search across readiness-relevant work items, plan items, comments, engineering signals, and notifications.

5. **Readiness-critical polish** - Cover empty actions, search short-query/no-result/error states, and no-GitHub-repository engineering setup guidance.

## Constraints

- Readiness is derived from local project state and deterministic rules.
- Readiness search stays project-scoped and workspace-member scoped.
- Overview must remain lightweight enough for team alignment, not become a portfolio analytics product.
- Existing board, list, plan, engineering, docs, and notification surfaces remain the source-linked detail views.

## Non-Goals

- Global portfolio dashboard
- Analytics warehouse
- AI-generated recommendations
- Full-text infrastructure
- Global command palette
- External reporting or BI integrations

## Decisions

1. **Overview leads with readiness** - The project landing surface answers "can we move forward?" before showing lower-level detail.

2. **Server-side readiness projection** - `apps/web/src/server/projects/readiness.ts` owns deterministic readiness derivation from local state.

3. **Source-linked actions** - Actions link back to plan, work item, engineering, or notification surfaces so teams can resolve the signal directly.

4. **Simple Postgres-backed search** - Phase 8 uses scoped matching without introducing global search infrastructure.

5. **Polish only where readiness depends on it** - Empty, error, and setup states are tightened where they affect readiness comprehension.

## Success Criteria

- Overview renders a Readiness Command Center with status, narrative, metrics, decision cues, and milestone context.
- Readiness status can be `Ready`, `Ready with risk`, or `Blocked`, derived from deterministic local rules.
- The team action list is source-linked and explains blockers, review needs, urgent work, unread high-priority notifications, and plan gaps.
- Project-scoped readiness search returns relevant work item, plan, comment, GitHub, and notification results with RBAC enforced.
- Search has distinct short-query guidance, no-result copy, and failure copy.
- Engineering shows a clear setup state when no GitHub repository is connected.
- Phase 8 final verification passes: targeted tests, lint, typecheck, full tests, build, and browser smoke check.

## Technical Direction

- Readiness projection: `apps/web/src/server/projects/readiness.ts`
- Workspace integration: `apps/web/src/server/projects/workspace.ts`
- Search service: `apps/web/src/server/projects/search.ts`
- Search API: `apps/web/src/app/api/workspaces/[slug]/projects/[key]/search/route.ts`
- Overview UI: `apps/web/src/features/overview/`
- Engineering polish: `apps/web/src/features/engineering/engineering-view.tsx`
- Coverage: `tests/phase8-*.test.mjs`, Overview UI tests, Engineering UI tests

## Phase Position

Phase 8 of 8. Builds on:
- Phase 2: Auth and workspace membership
- Phase 3: Projects and work items
- Phase 4: Board/list execution views
- Phase 5: Detail, comments, plan, overview, docs, and project workspace shell
- Phase 6: Live GitHub engineering integration
- Phase 7: In-app notifications and collaboration foundation

Next: close Phase 8 with full verification, browser smoke validation, review, and PR/merge readiness.
