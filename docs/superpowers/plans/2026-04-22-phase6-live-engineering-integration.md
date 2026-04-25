# Phase 6 Live Engineering Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the current seeded GitHub status projection with a real GitHub integration that drives work-item engineering state from webhook and reconciliation flows.

**Architecture:** Keep `task_github_status` as the UI-facing read model, add normalized GitHub domain tables under it, ingest webhook events through the web app, and use the worker for backfill and repair. Preserve the Phase 5 project workspace routes and extend them with live engineering context rather than creating a parallel product surface.

**Tech Stack:** Next.js App Router, server route handlers, Drizzle ORM, Postgres, worker runtime in `apps/worker`, Vitest for UI/service tests, Node contract tests, GitHub App webhook verification.

---

### Task 1: Add Shared GitHub Integration Contracts

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types.ts`
- Verify via typecheck: `packages/shared/src/types.ts`

- [x] Define shared enums and record types for repository connections, PR state, check rollups, deployment environments, work-item link sources, and webhook delivery status.
- [x] Keep the existing `taskGithub*` enums as UI projection values; add new normalized types without renaming current Phase 5 contracts.
- [x] Make the new shared types explicit enough that web, db, and worker code can share them without local string unions.
- [x] Run: `npm run typecheck --workspace @the-platform/shared`
- [x] Expected: PASS with the new shared contracts.
- [x] Commit: `feat: add shared github integration contracts`

### Task 2: Add the Durable GitHub Data Model

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/seed.ts`
- Create: `packages/db/src/github-schema.test.ts`
- Create: new Drizzle migration files under `packages/db/drizzle/`

- [x] Add normalized GitHub tables:
  - `github_repositories`
  - `project_github_connections`
  - `github_pull_requests`
  - `github_check_rollups`
  - `github_deployments`
  - `work_item_github_links`
  - `github_webhook_deliveries`
- [x] Keep `task_github_status` in place and document it as the derived read model.
- [x] Add indexes for repository id, provider ids, head SHA, work item ids, and delivery ids so replay and linking stay cheap.
- [x] Update seed data so the local development project can still render engineering signals through the new model.
- [x] Run: `npm run db:generate`
- [x] Run: `npm run db:migrate`
- [x] Run: `npm run test --workspace @the-platform/db`
- [x] Expected: PASS with schema tests and migrations generated cleanly.
- [x] Commit: `feat: add github integration schema`

### Task 3: Add Repository Connection Services

**Files:**
- Create: `apps/web/src/server/github/types.ts`
- Create: `apps/web/src/server/github/repository.ts`
- Create: `apps/web/src/server/github/service.ts`
- Modify: `apps/web/src/server/projects/types.ts`
- Modify: `apps/web/src/server/projects/repository.ts`
- Modify: `apps/web/src/server/projects/workspace.ts`
- Test: `tests/phase6-github-connections.test.mjs`

- [x] Add repository access methods for creating and reading project GitHub connections.
- [x] Enforce the initial Phase 6 rule of one primary repository per project.
- [x] Keep connection mutation owner/admin only.
- [x] Extend the project workspace projection so it can surface repository connection health and link metadata.
- [x] Run: `node --import tsx --test tests/phase6-github-connections.test.mjs`
- [x] Expected: PASS with RBAC and project-scoped repository mapping enforced.
- [x] Commit: `feat: add github repository connection services`

### Task 4: Add GitHub Webhook Verification and Delivery Persistence

**Files:**
- Create: `apps/web/src/app/api/webhooks/github/route.ts`
- Create: `apps/web/src/server/github/webhooks.ts`
- Create: `apps/web/src/server/github/signature.ts`
- Modify: `.env.example`
- Test: `tests/phase6-github-webhooks.test.mjs`

- [x] Add GitHub webhook signature verification using a shared secret.
- [x] Persist every verified delivery into `github_webhook_deliveries` before domain mutation.
- [x] Make delivery processing idempotent by delivery id.
- [x] Return clear failure modes for invalid signatures and duplicate deliveries.
- [x] Run: `node --import tsx --test tests/phase6-github-webhooks.test.mjs`
- [x] Expected: PASS with verification, dedupe, and persistence behavior covered.
- [x] Commit: `feat: add github webhook ingestion route`

### Task 5: Normalize PR, Check, and Deploy Events Into the Read Model

**Files:**
- Modify: `apps/web/src/server/github/repository.ts`
- Modify: `apps/web/src/server/github/service.ts`
- Modify: `apps/web/src/server/projects/workspace.ts`
- Modify: `apps/web/src/server/work-items/repository.ts`
- Modify: `apps/web/src/server/work-items/service.ts`
- Create: `tests/phase6-github-projection.test.mjs`
- Test: `tests/phase4-project-workspace.test.mjs`

- [x] Handle webhook payloads for pull requests, check runs or check suites, and deployments.
- [x] Upsert normalized GitHub records and recalculate `task_github_status` from them.
- [x] Auto-link work items from identifiers in PR title, body, and branch name when the match is unambiguous.
- [x] Leave ambiguous matches unlinked and visible to operators instead of guessing.
- [x] Extend the workspace projection so `Engineering` and detail views consume real repository state instead of seeded summary strings.
- [x] Run: `node --import tsx --test tests/phase6-github-projection.test.mjs tests/phase4-project-workspace.test.mjs`
- [x] Expected: PASS with real rollup logic replacing seeded-only engineering summaries.
- [x] Commit: `feat: project live github events into work item status`

### Task 6: Add Worker Reconciliation and Backfill

**Files:**
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/src/github-reconcile.ts`
- Create: `apps/worker/src/github-client.ts`
- Create: `apps/worker/src/github-reconcile.test.ts`
- Modify: `apps/worker/package.json`
- Test: `tests/phase1-foundation-contract.test.mjs`

- [x] Replace the worker placeholder banner with a real reconciliation entrypoint.
- [x] Add a worker path that can:
  - backfill repository state after a connection is created
  - replay failed deliveries
  - resync linked PR/check/deploy state on a schedule
- [x] Keep the worker safe to re-run and explicit about what it reconciles.
- [x] Run: `npm run test --workspace @the-platform/worker`
- [x] Run: `node --import tsx --test tests/phase1-foundation-contract.test.mjs`
- [x] Expected: PASS with worker responsibilities no longer placeholder-only.
- [x] Commit: `feat: add github reconciliation worker`

### Task 7: Bring Live Engineering State Into the UI

**Files:**
- Modify: `apps/web/src/components/work-item-card.tsx`
- Modify: `apps/web/src/components/work-item-row.tsx`
- Modify: `apps/web/src/components/detail-panel.tsx`
- Modify: `apps/web/src/features/engineering/engineering-view.tsx`
- Modify: `apps/web/src/features/board/__tests__/board-view.test.tsx`
- Modify: `apps/web/src/features/board/__tests__/issue-detail.test.tsx`
- Modify: `apps/web/src/features/engineering/__tests__/engineering-view.test.tsx`

- [x] Add compact `PR / CI / Deploy` chips to board cards and list rows.
- [x] Extend detail panel with read-only repository, branch, PR, and deploy context.
- [x] Replace engineering placeholder summaries with repository-backed sections for linked PRs, failing checks, deploys, and sync health.
- [x] Keep the existing create/edit/comment flows unchanged.
- [x] Run: `npm run test --workspace @the-platform/web -- board-view issue-detail engineering-view`
- [x] Expected: PASS with live engineering UI coverage added.
- [x] Commit: `feat: surface live engineering state in project ui`

### Task 8: Final Verification and Delivery

**Files:**
- Modify: `docs/product/idea-brief.md`
- Modify: `docs/product/decision-brief.md`
- Modify: `docs/product/prd.md`
- Modify: `docs/superpowers/plans/2026-04-22-phase6-live-engineering-integration.md`

- [x] Update product docs so Phase 6 explicitly describes live GitHub integration and Phase 7 shifts to notifications/collaboration follow-ons.
- [x] Run: `npm run lint`
- [x] Run: `npm run typecheck`
- [x] Run: `npm test`
- [x] Run: `npm run build`
- [x] Locally verify the manual GitHub flow through deterministic coverage:
  - connect a project to GitHub
  - receive a PR webhook for a matching work item identifier
  - see board/detail/engineering update from the local read model
  - replay a failed delivery or run reconciliation without corrupting state
- [x] Commit: `docs: finalize phase 6 live engineering integration plan`

## Delivery Notes

Phase 6 is complete on `feature/implement` through the following commits:

- `f2f2b4c` adds shared GitHub integration contracts.
- `9f3d30c` adds normalized GitHub schema, migrations, and seed-backed local repository data.
- `448c9a0` adds project repository connection services and RBAC coverage.
- `1834840` adds signed GitHub webhook ingestion and delivery persistence.
- `3cb292b` projects PR, check, and deployment events into work item engineering state.
- `57edadf` replaces the worker placeholder with GitHub reconciliation modes.
- `91ed0df` surfaces live engineering state in board, list, detail, and engineering views.

Manual verification is represented by automated local contract coverage rather than a live GitHub App install in this environment:

- repository connection behavior is covered by `tests/phase6-github-connections.test.mjs`
- webhook signature, dedupe, and delivery behavior is covered by `tests/phase6-github-webhooks.test.mjs`
- PR/check/deploy projection and matching work-item identifiers are covered by `tests/phase6-github-projection.test.mjs`
- reconciliation replay/backfill/resync behavior is covered by `apps/worker/src/github-reconcile.test.ts`
- board/detail/engineering UI read-model rendering is covered by the web UI tests for `board-view`, `issue-detail`, and `engineering-view`

A credentialed smoke test with a real GitHub App installation should still be run before production rollout.

Phase 7 should move to notifications and collaboration follow-ons:

- mention dispatch and assignment/comment notifications
- activity notifications for GitHub PR/check/deploy changes
- live or near-real-time UI refresh for project workspace changes
- manual handling for ambiguous GitHub links
- persisted docs/collaboration improvements after notification foundations are stable
