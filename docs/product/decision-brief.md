# Decision Brief: Phase 6 - Live Engineering Integration

## Context

Phase 5 completed the functional project workspace: board/list execution, work item detail, comments, planning, overview, docs, and engineering views all live under `/workspaces/[slug]/projects/[key]`. Phase 6 makes the engineering layer real by connecting project work items to GitHub repository activity.

The product direction remains: Jira for execution structure, GitHub for live engineering status, and Notion-like lightness for planning and docs.

## Key Decisions

### 1. Webhook-first GitHub integration

GitHub events enter through `POST /api/webhooks/github`. The route verifies the webhook signature, persists a delivery receipt, and then hands off to domain projection logic.

**Why:** Webhooks give fast updates without calling GitHub during page render. Persisted receipts make delivery idempotency, replay, and operator diagnosis possible.

### 2. Local Postgres read model

The UI reads local tables, with `task_github_status` kept as the compact work-item summary model. Normalized GitHub tables sit beneath it and drive recalculation.

**Why:** Board, detail, and engineering pages need predictable load times and should keep working from the last known state when GitHub is unavailable.

### 3. One primary repository per project

Phase 6 supports a single primary GitHub repository connection per project.

**Why:** This keeps the first live integration shippable while preserving a clear path to multi-repo orchestration later.

### 4. Unambiguous identifier auto-linking

Work items link to GitHub activity when an identifier appears in PR title, PR body, or branch name and resolves to exactly one work item.

**Why:** Automatic linking creates the product value. Refusing ambiguous matches protects trust in the board.

### 5. Worker-backed reconciliation

The worker owns backfill, failed delivery replay, and linked repository resync.

**Why:** Webhooks are the fast path, but production integrations need a repair path. Reconciliation must be safe to re-run.

### 6. Read-only engineering facts in the UI

Board cards, list rows, issue detail, and the engineering page display GitHub state. Editing GitHub records from the product UI is out of scope for Phase 6.

**Why:** The product should expose engineering truth without pretending to be a GitHub replacement.

## Non-Goals

- Multi-repository projects
- Manual PR/link management UI for ambiguous matches
- Browser-side GitHub API calls
- Editable docs/wiki system
- Notifications and mention dispatch
- Real-time collaborative editing
- Portfolio reporting

## RBAC Rules

| Role | Read Engineering State | Connect Repository | Process Webhooks | Edit Work Item Fields |
|------|------------------------|--------------------|------------------|-----------------------|
| Viewer | Yes | No | No | No |
| Member | Yes | No | No | Yes |
| Admin | Yes | Yes | No | Yes |
| Owner | Yes | Yes | No | Yes |
| System/Webhook | No UI access | No | Yes | Derived writes only |

## Success Criteria

1. A project has one primary repository connection with owner/admin mutation rules.
2. GitHub webhook signatures are verified before any domain write.
3. Verified deliveries are persisted and duplicate deliveries are idempotent.
4. Pull request, check, and deployment payloads update normalized GitHub records.
5. Work items auto-link to GitHub activity when identifier matching is unambiguous.
6. `task_github_status` updates from normalized GitHub state.
7. Board cards and list rows show compact `PR / CI / Deploy` chips.
8. Issue detail shows repository, branch, PR, check, and deploy context.
9. The engineering page shows repository sync health, linked PRs, failing checks, deployments, and issue summaries.
10. Worker reconciliation can backfill, replay failed deliveries, and resync linked repository state safely.
11. Existing Phase 5 create/edit/comment behavior remains intact.

## Next Phase

Phase 7 should focus on notifications and collaboration follow-ons:

- mention notification dispatch
- activity notifications for comments, assignments, status changes, PR/check/deploy changes
- real-time or near-real-time UI refresh
- manual handling for ambiguous GitHub links
- persisted docs/collaboration improvements if notifications are stable
