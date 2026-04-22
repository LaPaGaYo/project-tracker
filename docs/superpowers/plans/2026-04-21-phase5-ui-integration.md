# Phase 5 UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Jira-inspired workspace redesign into the working Phase 5 product line so the `/workspaces/[slug]/projects/[key]` experience keeps real create/edit/comment functionality while adopting the new execution UI.

**Architecture:** Keep the Phase 5 `/workspaces/[slug]/projects/[key]` route family, service layer, API handlers, and RBAC behavior as the single source of truth. Port only the redesign’s information architecture, chrome, and presentation patterns into that functional surface; do not promote the fixture-backed `/projects/[projectSlug]` route family into the product path.

**Tech Stack:** Next.js App Router, React 19, server actions, Drizzle ORM, Postgres, Tailwind CSS, Vitest for UI tests, Node contract tests.

---

## Current Reality

- Functional baseline branch: `codex/run-2026-04-20T13-45-58-613Z`
- Integration branch/worktree: `branch/phase5-ui-integration` at `/Users/henry/Documents/project-tracker/.worktrees/phase5-ui-integration`
- Functional baseline status: `npm test` passes with 45/45 contract and integration tests.
- Redesign branch: `codex/project-workspace-ui-redesign`
- Branch divergence is large: merge base is `b8a724e`, so this is a selective integration, not a git merge.
- There are uncommitted UI changes in `/Users/henry/Documents/project-tracker/.nexus-worktrees/run-2026-04-20T13-45-58-613Z` touching:
  - `apps/web/src/app/workspaces/[slug]/projects/[key]/project-detail-content.tsx`
  - `apps/web/src/components/app-shell.tsx`
  - `apps/web/src/components/board-column.tsx`
  - `apps/web/src/components/create-work-item-dialog.tsx`
  - `apps/web/src/components/description-editor.tsx`
  - `apps/web/src/components/detail-panel.tsx`
  - `apps/web/src/components/filter-bar.tsx`
  - `apps/web/src/components/list-view.tsx`
  - `apps/web/src/components/metadata-sidebar.tsx`
  - `apps/web/src/components/timeline.tsx`
  - `apps/web/src/components/view-toggle.tsx`
  - `apps/web/src/components/work-item-card.tsx`
- Treat those uncommitted changes as candidate patches to review and fold in deliberately during the UI integration tasks below. Do not assume they are already preserved elsewhere.

## Integration Rules

- Keep `/workspaces/[slug]/projects/[key]` as the only product project surface.
- Keep existing repositories, services, API route handlers, and permission rules.
- Absorb visual/system patterns from the redesign branch, not its fixture route tree.
- Preserve or improve all existing Phase 5 capabilities:
  - create work item
  - board/list interactions
  - detail panel editing
  - comments
  - description version history
  - activity timeline
- Any redesign view that is not yet backed by real data must ship behind the Phase 5 data model, not demo fixtures.

### Task 1: Bring the UI Test Harness Into the Functional Branch

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/test/render.tsx`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/src/features/workspace/__tests__/project-shell.test.tsx`
- Create: `apps/web/src/features/workspace/__tests__/project-nav.test.tsx`
- Create: `apps/web/src/features/board/__tests__/board-view.test.tsx`
- Create: `apps/web/src/features/board/__tests__/issue-detail.test.tsx`

- [ ] Add the Vitest/testing-library dependencies already proven in the redesign branch so this line can validate UI behavior locally.
- [ ] Add the shared web test setup and render helper from the redesign branch, but adapt import paths to the Phase 5 component tree.
- [ ] Write a minimal set of UI tests around the existing functional project surface:
  - app shell navigation renders
  - board surface renders cards from functional props
  - detail panel renders title, metadata, and GitHub/status equivalents when provided
- [ ] Run: `npm run test --workspace @the-platform/web`
- [ ] Expected: PASS with the new UI tests and no regression in existing root-level contract tests.
- [ ] Commit: `test: add ui harness for phase 5 integration`

### Task 2: Replace the Project Detail Chrome Without Breaking Behavior

**Files:**
- Modify: `apps/web/src/app/workspaces/[slug]/projects/[key]/project-detail-content.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/components/view-toggle.tsx`
- Modify: `apps/web/src/components/filter-bar.tsx`
- Modify: `apps/web/src/components/board-column.tsx`
- Modify: `apps/web/src/components/list-view.tsx`
- Modify: `apps/web/src/components/work-item-card.tsx`
- Test: `tests/phase4-views.test.mjs`
- Test: `apps/web/src/features/board/__tests__/board-view.test.tsx`

- [ ] Port the redesign’s project header, summary cards, and execution chrome into `project-detail-content.tsx`, but keep the Phase 5 route params and loaded data.
- [ ] Keep the existing `ViewToggle` orchestration for board/list/detail-panel behavior; only change presentation and layout boundaries.
- [ ] Fold in the user’s uncommitted visual changes from the original Phase 5 worktree where they align with the redesign decisions:
  - wider shell
  - improved empty states
  - clearer filter affordances
  - better assignee labels and card density
- [ ] Preserve `onOpenItem`, DnD hooks, filtering, sorting, and query-string state.
- [ ] Run: `node --import tsx --test tests/phase4-views.test.mjs`
- [ ] Run: `npm run test --workspace @the-platform/web -- board-view`
- [ ] Expected: PASS with board/list behaviors unchanged.
- [ ] Commit: `feat: port redesign chrome onto phase 5 project surface`

### Task 3: Keep Create Work Item and Detail Editing First-Class

**Files:**
- Modify: `apps/web/src/components/create-work-item-dialog.tsx`
- Modify: `apps/web/src/components/detail-panel.tsx`
- Modify: `apps/web/src/components/metadata-sidebar.tsx`
- Modify: `apps/web/src/components/description-editor.tsx`
- Modify: `apps/web/src/components/timeline.tsx`
- Modify: `apps/web/src/components/comment-input.tsx`
- Modify: `apps/web/src/components/comment-list.tsx`
- Test: `tests/phase5-detail-comments.test.mjs`
- Test: `tests/phase5-detail-panel-navigation.test.mjs`
- Test: `apps/web/src/features/board/__tests__/issue-detail.test.tsx`

- [ ] Apply the redesign’s issue drawer/detail sensibility to the existing detail panel instead of replacing the panel with a static mock.
- [ ] Keep create/edit paths fully live:
  - `CreateWorkItemDialog` continues submitting through `createWorkItemAction`
  - detail title, metadata, description, and comments continue mutating via the existing handlers
- [ ] Deliberately review the uncommitted Phase 5 UI patches here before re-implementing:
  - click-to-edit title UX
  - form pending states
  - cleaner timeline descriptions
  - metadata card grouping
- [ ] Do not reintroduce debounced title behavior if the current immediate-save interaction is already contract-tested differently; preserve Phase 5 semantics unless a test is updated intentionally.
- [ ] Run: `node --import tsx --test tests/phase5-detail-comments.test.mjs tests/phase5-detail-panel-navigation.test.mjs`
- [ ] Run: `npm run test --workspace @the-platform/web -- issue-detail`
- [ ] Expected: PASS with create/edit/comment flows still working.
- [ ] Commit: `feat: align phase 5 detail interactions with redesign`

### Task 4: Add Real Plan, Overview, Docs, and Engineering Views to the Functional Route Tree

**Files:**
- Create: `apps/web/src/app/workspaces/[slug]/projects/[key]/plan/page.tsx`
- Create: `apps/web/src/app/workspaces/[slug]/projects/[key]/overview/page.tsx`
- Create: `apps/web/src/app/workspaces/[slug]/projects/[key]/docs/page.tsx`
- Create: `apps/web/src/app/workspaces/[slug]/projects/[key]/engineering/page.tsx`
- Create: `apps/web/src/features/plan/*`
- Create: `apps/web/src/features/overview/*`
- Create: `apps/web/src/features/docs/*`
- Create: `apps/web/src/features/engineering/*`
- Create: `apps/web/src/lib/content/platform-ops.ts` or equivalent real-content adapter
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/app/workspaces/[slug]/projects/[key]/page.tsx`
- Modify: `apps/web/src/app/workspaces/[slug]/projects/[key]/project-detail-content.tsx`
- Modify: `apps/web/src/server/projects/*`
- Modify: `apps/web/src/server/work-items/*`
- Modify: `packages/shared/src/*`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/seed.ts`
- Test: `tests/phase4-views.test.mjs`
- Test: new contract tests for plan/overview/engineering payload shaping

- [ ] Add tabbed or segmented navigation under the existing workspaces project route so `Board`, `Backlog/List`, `Plan`, `Overview`, `Docs`, and `Engineering` live in one cohesive project workspace.
- [ ] Reuse the redesign branch’s visual sections and tests where useful, but back every view from the real Phase 5 model and loaders.
- [ ] Extend the Phase 5 schema only where the redesign adds durable concepts that matter to the product:
  - project stages
  - plan items
  - GitHub/CI/deploy issue status
- [ ] Ensure the new data model composes with existing `projects`, `tasks`, comments, and activity history instead of replacing them.
- [ ] Run targeted migration and seed checks before wiring pages.
- [ ] Commit in slices:
  - `feat: add stage and plan data model to phase 5`
  - `feat: add plan and overview project views`
  - `feat: add docs and engineering project views`

### Task 5: Remove the Fixture Product Surface and Collapse to One Truth

**Files:**
- Delete or quarantine: `apps/web/src/app/projects/[projectSlug]/**`
- Delete or quarantine: `apps/web/src/lib/demo/project-workspace.ts`
- Delete or quarantine: `apps/web/src/lib/server/project-workspace*.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `tests/phase1-foundation-contract.test.mjs`
- Modify: `tests/project-workspace-contract.test.mjs`
- Modify: `README.md`
- Modify: `docs/product/*`

- [ ] Decide whether the redesign-only `/projects/[projectSlug]` tree is still useful as a demo/story surface.
- [ ] If not useful, remove it and update the home-page redirect to the real workspaces project path.
- [ ] If temporarily retained, move it under an explicitly non-product path and document it as non-canonical.
- [ ] Remove any remaining fixture-backed loader path from the production app.
- [ ] Update docs so only one project experience is described as current.
- [ ] Commit: `refactor: retire duplicate project workspace route family`

### Task 6: Final Verification and Delivery

**Files:**
- Modify as needed: `README.md`
- Modify as needed: `docs/product/prd.md`
- Modify as needed: `docs/superpowers/plans/2026-04-21-phase5-ui-integration.md`

- [ ] Run: `npm run lint`
- [ ] Run: `npm run typecheck`
- [ ] Run: `npm test`
- [ ] Run: `npm run build`
- [ ] Manually verify:
  - create work item from the redesigned project surface
  - edit title, metadata, description, and comments in detail panel
  - board/list filters still drive the same underlying data
  - plan/overview/docs/engineering views render real project data
- [ ] Update this plan with any scope corrections discovered during implementation.
- [ ] Commit: `docs: finalize phase 5 ui integration delivery notes`

## Verification Matrix

- Functional safety net:
  - `tests/phase2-auth-workspace.test.mjs`
  - `tests/phase3-projects-work-items.test.mjs`
  - `tests/phase4-views.test.mjs`
  - `tests/phase5-detail-comments.test.mjs`
  - `tests/phase5-detail-panel-navigation.test.mjs`
- UI safety net to add/maintain:
  - `apps/web/src/features/workspace/__tests__/*`
  - `apps/web/src/features/board/__tests__/*`
- Full repo commands:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
