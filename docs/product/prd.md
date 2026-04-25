# PRD: Phase 6 - Live Engineering Integration

## Overview

Replace the seeded/manual engineering status projection with a real GitHub integration. Phase 6 connects a project to a GitHub repository, ingests PR/check/deploy events, derives the local work-item engineering read model, and surfaces that state in the project workspace.

## Scope Sections

### 6.1 Repository Connection

A project can be associated with one primary GitHub repository.

**Requirements:**
- Store GitHub repository metadata locally: provider id, owner, name, full name, default branch, installation id, and active state.
- Store the project-to-repository connection with staging and production environment labels.
- Enforce one primary repository per project.
- Allow only owner/admin roles to create or update the connection.
- Surface repository connection status in the project workspace projection.

### 6.2 Webhook Verification and Delivery Receipts

GitHub events enter through a server-side webhook route.

**Requirements:**
- Add `POST /api/webhooks/github`.
- Verify `X-Hub-Signature-256` using the configured webhook secret.
- Reject invalid signatures before any domain write.
- Persist verified delivery receipts with delivery id, event name, action, status, payload, and error summary.
- Treat duplicate delivery ids as idempotent duplicates.

### 6.3 Normalized GitHub Domain Model

Persist GitHub data in durable tables before deriving UI state.

**Requirements:**
- Add normalized records for repositories, project connections, pull requests, check rollups, deployments, work item links, and webhook deliveries.
- Upsert pull request events by repository and PR number/provider id.
- Upsert check rollups by repository and head SHA.
- Upsert deployments by repository, SHA, environment, and provider deployment id.
- Preserve `task_github_status` as the UI-facing read model.

### 6.4 Work Item Auto-linking

Automatically associate GitHub activity with work items when safe.

**Requirements:**
- Parse work item identifiers from PR title, PR body, and branch name.
- Link only when the identifier resolves to exactly one work item in the project.
- Store link source, confidence, branch, repository, and PR relationship in `work_item_github_links`.
- Leave ambiguous or missing matches unlinked.
- Recalculate `task_github_status` after link-affecting events.

### 6.5 Worker Reconciliation

The worker repairs and backfills engineering state outside request handlers.

**Requirements:**
- Replace the placeholder worker entrypoint with real reconciliation modes.
- Support repository backfill after connection.
- Support failed delivery replay.
- Support linked repository resync.
- Keep all worker paths safe to re-run.
- Provide explicit logs for what was reconciled.

### 6.6 Project Workspace UI

Expose live engineering state where users make execution decisions.

**Requirements:**
- Board cards show compact `PR / CI / Deploy` chips when engineering data exists.
- List rows show the same signals in dense form.
- Issue detail shows read-only repository, branch, PR, check, and deployment context.
- The `Engineering` view shows repository sync health, linked PRs, failing checks, deployments, and issue summaries.
- Existing create, edit, comment, and timeline behavior remains unchanged.

### 6.7 Verification

Automated coverage must prove the integration chain without requiring live GitHub network access.

**Requirements:**
- Shared contract typecheck passes.
- DB schema and migration tests pass.
- GitHub connection RBAC and project mapping tests pass.
- Webhook signature, dedupe, and persistence tests pass.
- Projection tests cover PR/check/deploy rollups and work item linking.
- Worker tests cover backfill, failed delivery replay, and linked repository resync.
- UI tests cover board/list chips, issue detail engineering context, and engineering view sections.
- Full repo lint, typecheck, test, and build pass.

## Data Model

```
github_repositories:
  id: uuid PK
  workspace_id: uuid FK
  provider: text
  provider_repository_id: text
  owner: text
  name: text
  full_name: text
  default_branch: text
  installation_id: text
  is_active: boolean

project_github_connections:
  id: uuid PK
  project_id: uuid FK
  repository_id: uuid FK
  is_primary: boolean
  staging_environment: text
  production_environment: text

github_pull_requests:
  id: uuid PK
  repository_id: uuid FK
  provider_pull_request_id: text
  number: integer
  title: text
  body_excerpt: text
  url: text
  state: text
  draft: boolean
  base_branch: text
  head_branch: text
  head_sha: text

github_check_rollups:
  id: uuid PK
  repository_id: uuid FK
  head_sha: text
  status: text
  conclusion: text
  url: text

github_deployments:
  id: uuid PK
  repository_id: uuid FK
  provider_deployment_id: text
  environment: text
  sha: text
  state: text
  url: text

work_item_github_links:
  id: uuid PK
  work_item_id: uuid FK
  repository_id: uuid FK
  pull_request_id: uuid FK nullable
  branch_name: text nullable
  source: text
  confidence: text

github_webhook_deliveries:
  id: uuid PK
  delivery_id: text unique
  event_name: text
  action: text
  status: text
  payload: jsonb
  error_summary: text nullable
```

## Exit Criteria

- All 11 success criteria from the decision brief are met.
- Phase 6 tests pass without live GitHub network access.
- Full repo verification passes: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Product docs identify Phase 7 as notifications and collaboration follow-ons.
