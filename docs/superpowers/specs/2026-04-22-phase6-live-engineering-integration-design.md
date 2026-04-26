# Phase 6 Live Engineering Integration Design

## Goal

Turn the current GitHub status projection into a real integration so project work items can reflect live PR, CI, and deploy state without relying on seed data or manual updates.

## Current Baseline

- `task_github_status` already exists and the UI consumes it through the project workspace projection.
- `Plan`, `Overview`, `Board`, `Detail`, and `Engineering` now live on the real `/workspaces/[slug]/projects/[key]` route family.
- The current `Engineering` surface is still a read model built from local rows, not a GitHub-backed integration.
- `apps/worker` is still a placeholder and there is no GitHub ingestion, repository mapping, or reconciliation loop yet.

## Product Intent

The product direction is:

- `Jira` for execution structure
- `GitHub` for live engineering state
- `Notion` for lighter collaboration and planning context

Phase 5 completed the Jira-like execution shell. Phase 6 should make the GitHub half real.

## Chosen Approach

Use a `GitHub App + webhook ingestion + local read model` architecture.

Why this approach:

- Page loads stay fast because UI reads local Postgres state instead of calling GitHub on every request.
- Webhooks provide near-real-time updates for PRs, checks, and deployments.
- A worker can repair drift, backfill state, and retry failed sync without pushing that complexity into request handlers.
- A GitHub App supports workspace-safe multi-repo access better than PAT-based polling.

## Rejected Approaches

### 1. Direct live fetch from GitHub during page render

Rejected because it would create slow pages, fragile rate-limit behavior, and inconsistent UX when GitHub is degraded.

### 2. PAT-based polling only

Rejected because it weakens security, makes multi-workspace administration awkward, and delays updates compared with webhook-driven ingestion.

### 3. Keep `task_github_status` as a manual projection only

Rejected because it does not deliver the product differentiation the current product direction depends on.

## Phase 6 Scope

Phase 6 includes:

- connect a project to one primary GitHub repository
- receive GitHub webhooks for pull requests, check runs, and deployments
- normalize GitHub events into local durable tables
- auto-link GitHub activity to work items by item identifier
- keep `task_github_status` updated as the UI-facing read model
- expose richer engineering context in board cards, issue detail, and the `Engineering` page
- add worker-driven reconciliation and backfill

Phase 6 does not include:

- multi-repository project orchestration
- editable docs/wiki storage
- notifications or mention dispatch
- sprint planning changes
- portfolio or executive reporting

## User-Facing Outcome

After Phase 6:

- a project can be connected to GitHub
- a work item with identifier like `OPS-128` is automatically associated with matching PR activity
- board cards can show live PR / CI / deploy signals
- issue detail can show linked branch and PR context
- the `Engineering` page shows real repository and delivery state instead of seeded summaries
- stale or missed webhook updates can be repaired by reconciliation jobs

## UX Rules

### Project Connection

- each project gets one primary repository in Phase 6
- repository connection is configured inside project settings or a temporary engineering setup entrypoint
- connection stores installation and repository metadata locally

### Work Item Linking

Auto-linking should use the work item identifier in this order:

- PR title contains `OPS-123`
- PR body contains `OPS-123`
- branch name contains `ops-123`

If multiple work items match, do not silently link all of them. Phase 6 should link only when the match is unambiguous; ambiguous cases stay unlinked until a later manual-link feature exists.

### Board and List

- board cards should show compact engineering chips for `PR`, `CI`, and `Deploy`
- list rows should show the same signals in a denser form
- lack of GitHub activity is rendered as absence or muted status, not as an error state

### Issue Detail

- issue detail should show repository name, linked branch, linked PR, latest check state, and latest deploy state
- detail remains editable for planning fields and comments; GitHub data is read-only in this phase

### Engineering Page

The engineering page becomes the cross-issue engineering dashboard for the current project. It should show:

- repository connection health
- open linked PRs
- failing checks
- latest deploys by environment
- unlinked PRs that mention a work item identifier but could not be attached cleanly
- recent webhook/reconciliation failures that need operator attention

## Architecture

### Source of Truth

GitHub is the source of truth for engineering events. Postgres is the source of truth for product-facing cached engineering state.

### Read Model

Keep `task_github_status` as the canonical UI-facing summary row for each work item.

That table continues to answer:

- does this work item have an open PR
- are checks currently passing
- has it reached staging or production

Phase 6 adds normalized tables beneath it and derives the read model from them.

### Event Flow

1. GitHub sends webhook to `/api/webhooks/github`
2. webhook route verifies signature and records delivery receipt
3. event handler upserts normalized GitHub records
4. linker resolves work item associations using item identifiers
5. projection updater recalculates `task_github_status`
6. worker performs replay/backfill when webhook delivery is missed or incomplete

### Reconciliation Flow

The worker should support:

- repository backfill after a new connection is created
- periodic PR/check/deploy reconciliation for connected projects
- replay of failed webhook deliveries
- repair of work-item links when identifier parsing logic improves

## Data Model

Phase 6 should add these durable tables:

### `github_repositories`

- local repository record for a GitHub repository connected to a workspace/project
- stores workspace ownership, provider repo id, owner/name/full name, default branch, installation id, active state

### `project_github_connections`

- maps a project to its primary repository
- stores environment names used to classify deploys, such as `staging` and `production`

### `github_pull_requests`

- normalized PR records
- stores provider PR id, repository id, number, title, body excerpt or identifier references, URL, state, draft flag, author, base branch, head branch, head SHA, timestamps

### `github_check_rollups`

- latest CI summary per repository + head SHA
- enough to answer pass/fail/unknown for linked PRs

### `github_deployments`

- latest deployment events per repository + SHA + environment
- enough to classify staging vs production delivery state

### `work_item_github_links`

- resolved relationship between work items and GitHub entities
- stores work item id, repository id, PR id nullable, branch name nullable, link source, confidence, linked at

### `github_webhook_deliveries`

- durable receipt and processing status for webhook deliveries
- enables idempotency, replay, and operator debugging

## Data Contracts

### Shared Types

Shared package should expose:

- repository connection types
- normalized PR/check/deploy record types
- work item engineering link types
- webhook processing status types

### UI Projection

The existing project workspace projection should expand to include:

- repository connection summary
- per-item engineering badges and links
- engineering dashboard sections for PRs, checks, deploys, and sync health

## API Surface

Phase 6 should add:

- `POST /api/webhooks/github`
- internal service actions for creating project repository connections
- read endpoints or server loaders for engineering dashboard sections if the page needs separate pagination or filtering

No browser client should call GitHub directly.

## Security Model

- webhook requests must verify `X-Hub-Signature-256`
- GitHub App credentials stay server-side only
- repository connection mutation remains owner/admin only
- viewer/member roles can read engineering state but cannot modify repository connection settings

## Failure Handling

- unverified webhook deliveries are rejected before any domain write
- verified but failed deliveries are stored as failed receipts with the error summary
- read-model projection updates must be idempotent
- reconciliation jobs must be safe to re-run
- if GitHub is unavailable, UI shows last known engineering state and a stale/sync warning where relevant

## Migration Strategy

- keep existing `task_github_status` rows and migrate them forward
- new normalized tables can start empty
- seed data should still populate a connected-looking local development project, but through the new normalized path where practical

## Testing Strategy

Phase 6 requires:

- contract tests for webhook verification and idempotent delivery handling
- service tests for work item auto-linking and projection rollups
- worker tests for reconciliation and replay behavior
- UI tests for engineering chips on board/detail surfaces
- build verification that no page directly depends on live GitHub API access

## Success Criteria

1. A project can be connected to one primary GitHub repository.
2. Verified GitHub webhook deliveries are persisted and processed idempotently.
3. PR/check/deploy events update normalized tables and refresh `task_github_status`.
4. Work items auto-link to GitHub activity when identifier matching is unambiguous.
5. Board and list views show live engineering badges from the local read model.
6. Issue detail shows linked engineering context without losing Phase 5 edit/comment behavior.
7. Engineering view shows real repository, PR, CI, and deploy data for the project.
8. Worker reconciliation can rebuild engineering state after missed or failed deliveries.
9. RBAC protects repository connection settings and webhook internals.
10. Full repo verification passes after integration.
