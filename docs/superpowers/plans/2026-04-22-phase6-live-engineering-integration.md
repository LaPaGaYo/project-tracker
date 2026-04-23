# Phase 6 Live Engineering Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current seeded GitHub status projection with a real GitHub integration that drives work-item engineering state from webhook and reconciliation flows.

**Architecture:** Keep `task_github_status` as the UI-facing read model, add normalized GitHub domain tables under it, ingest webhook events through the web app, and use the worker for backfill and repair. Preserve the Phase 5 project workspace routes and extend them with live engineering context rather than creating a parallel product surface.

**Tech Stack:** Next.js App Router, server route handlers, Drizzle ORM, Postgres, worker runtime in `apps/worker`, Vitest for UI/service tests, Node contract tests, GitHub App webhook verification.

---

### Task 1: Add Shared GitHub Integration Contracts

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types.ts`
- Verify via typecheck: `packages/shared/src/types.ts`

- [ ] Define shared enums and record types for repository connections, PR state, check rollups, deployment environments, work-item link sources, and webhook delivery status.
- [ ] Keep the existing `taskGithub*` enums as UI projection values; add new normalized types without renaming current Phase 5 contracts.
- [ ] Make the new shared types explicit enough that web, db, and worker code can share them without local string unions.
- [ ] Run: `npm run typecheck --workspace @the-platform/shared`
- [ ] Expected: PASS with the new shared contracts.
- [ ] Commit: `feat: add shared github integration contracts`

### Task 2: Add the Durable GitHub Data Model

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/seed.ts`
- Create: `packages/db/src/github-schema.test.ts`
- Create: new Drizzle migration files under `packages/db/drizzle/`

- [ ] Add normalized GitHub tables:
  - `github_repositories`
  - `project_github_connections`
  - `github_pull_requests`
  - `github_check_rollups`
  - `github_deployments`
  - `work_item_github_links`
  - `github_webhook_deliveries`
- [ ] Keep `task_github_status` in place and document it as the derived read model.
- [ ] Add indexes for repository id, provider ids, head SHA, work item ids, and delivery ids so replay and linking stay cheap.
- [ ] Update seed data so the local development project can still render engineering signals through the new model.
- [ ] Run: `npm run db:generate`
- [ ] Run: `npm run db:migrate`
- [ ] Run: `npm run test --workspace @the-platform/db`
- [ ] Expected: PASS with schema tests and migrations generated cleanly.
- [ ] Commit: `feat: add github integration schema`

### Task 3: Add Repository Connection Services

**Files:**
- Create: `apps/web/src/server/github/types.ts`
- Create: `apps/web/src/server/github/repository.ts`
- Create: `apps/web/src/server/github/service.ts`
- Modify: `apps/web/src/server/projects/types.ts`
- Modify: `apps/web/src/server/projects/repository.ts`
- Modify: `apps/web/src/server/projects/workspace.ts`
- Test: `tests/phase6-github-connections.test.mjs`

- [ ] Add repository access methods for creating and reading project GitHub connections.
- [ ] Enforce the initial Phase 6 rule of one primary repository per project.
- [ ] Keep connection mutation owner/admin only.
- [ ] Extend the project workspace projection so it can surface repository connection health and link metadata.
- [ ] Run: `node --import tsx --test tests/phase6-github-connections.test.mjs`
- [ ] Expected: PASS with RBAC and project-scoped repository mapping enforced.
- [ ] Commit: `feat: add github repository connection services`

### Task 4: Add GitHub Webhook Verification and Delivery Persistence

**Files:**
- Create: `apps/web/src/app/api/webhooks/github/route.ts`
- Create: `apps/web/src/server/github/webhooks.ts`
- Create: `apps/web/src/server/github/signature.ts`
- Modify: `.env.example`
- Test: `tests/phase6-github-webhooks.test.mjs`

- [ ] Add GitHub webhook signature verification using a shared secret.
- [ ] Persist every verified delivery into `github_webhook_deliveries` before domain mutation.
- [ ] Make delivery processing idempotent by delivery id.
- [ ] Return clear failure modes for invalid signatures and duplicate deliveries.
- [ ] Run: `node --import tsx --test tests/phase6-github-webhooks.test.mjs`
- [ ] Expected: PASS with verification, dedupe, and persistence behavior covered.
- [ ] Commit: `feat: add github webhook ingestion route`

### Task 5: Normalize PR, Check, and Deploy Events Into the Read Model

**Files:**
- Modify: `apps/web/src/server/github/repository.ts`
- Modify: `apps/web/src/server/github/service.ts`
- Modify: `apps/web/src/server/projects/workspace.ts`
- Modify: `apps/web/src/server/work-items/repository.ts`
- Modify: `apps/web/src/server/work-items/service.ts`
- Create: `tests/phase6-github-projection.test.mjs`
- Test: `tests/phase4-project-workspace.test.mjs`

- [ ] Handle webhook payloads for pull requests, check runs or check suites, and deployments.
- [ ] Upsert normalized GitHub records and recalculate `task_github_status` from them.
- [ ] Auto-link work items from identifiers in PR title, body, and branch name when the match is unambiguous.
- [ ] Leave ambiguous matches unlinked and visible to operators instead of guessing.
- [ ] Extend the workspace projection so `Engineering` and detail views consume real repository state instead of seeded summary strings.
- [ ] Run: `node --import tsx --test tests/phase6-github-projection.test.mjs tests/phase4-project-workspace.test.mjs`
- [ ] Expected: PASS with real rollup logic replacing seeded-only engineering summaries.
- [ ] Commit: `feat: project live github events into work item status`

### Task 6: Add Worker Reconciliation and Backfill

**Files:**
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/src/github-reconcile.ts`
- Create: `apps/worker/src/github-client.ts`
- Create: `apps/worker/src/github-reconcile.test.ts`
- Modify: `apps/worker/package.json`
- Test: `tests/phase1-foundation-contract.test.mjs`

- [ ] Replace the worker placeholder banner with a real reconciliation entrypoint.
- [ ] Add a worker path that can:
  - backfill repository state after a connection is created
  - replay failed deliveries
  - resync linked PR/check/deploy state on a schedule
- [ ] Keep the worker safe to re-run and explicit about what it reconciles.
- [ ] Run: `npm run test --workspace @the-platform/worker`
- [ ] Run: `node --import tsx --test tests/phase1-foundation-contract.test.mjs`
- [ ] Expected: PASS with worker responsibilities no longer placeholder-only.
- [ ] Commit: `feat: add github reconciliation worker`

### Task 7: Bring Live Engineering State Into the UI

**Files:**
- Modify: `apps/web/src/components/work-item-card.tsx`
- Modify: `apps/web/src/components/work-item-row.tsx`
- Modify: `apps/web/src/components/detail-panel.tsx`
- Modify: `apps/web/src/features/engineering/engineering-view.tsx`
- Modify: `apps/web/src/features/board/__tests__/board-view.test.tsx`
- Modify: `apps/web/src/features/board/__tests__/issue-detail.test.tsx`
- Modify: `apps/web/src/features/engineering/__tests__/engineering-view.test.tsx`

- [ ] Add compact `PR / CI / Deploy` chips to board cards and list rows.
- [ ] Extend detail panel with read-only repository, branch, PR, and deploy context.
- [ ] Replace engineering placeholder summaries with repository-backed sections for linked PRs, failing checks, deploys, and sync health.
- [ ] Keep the existing create/edit/comment flows unchanged.
- [ ] Run: `npm run test --workspace @the-platform/web -- board-view issue-detail engineering-view`
- [ ] Expected: PASS with live engineering UI coverage added.
- [ ] Commit: `feat: surface live engineering state in project ui`

### Task 8: Final Verification and Delivery

**Files:**
- Modify: `docs/product/idea-brief.md`
- Modify: `docs/product/decision-brief.md`
- Modify: `docs/product/prd.md`
- Modify: `docs/superpowers/plans/2026-04-22-phase6-live-engineering-integration.md`

- [ ] Update product docs so Phase 6 explicitly describes live GitHub integration and Phase 7 shifts to notifications/collaboration follow-ons.
- [ ] Run: `npm run lint`
- [ ] Run: `npm run typecheck`
- [ ] Run: `npm test`
- [ ] Run: `npm run build`
- [ ] Manually verify:
  - connect a project to GitHub
  - receive a PR webhook for a matching work item identifier
  - see board/detail/engineering update from the local read model
  - replay a failed delivery or run reconciliation without corrupting state
- [ ] Commit: `docs: finalize phase 6 live engineering integration plan`
