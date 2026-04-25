# Idea Brief: Phase 6 - Live Engineering Integration

## Problem

The project workspace now has Jira-like execution, planning, detail, and comments flows, but engineering status still has to be inferred from local rows or manually curated summaries. Teams need the board to reflect what is actually happening in GitHub: PRs, checks, branches, and deployments.

Without live engineering integration, the product risks becoming another project tracker instead of the intended blend of Jira execution, GitHub engineering truth, and lightweight collaboration.

## Goals

1. **Project repository connection** - Connect a project to one primary GitHub repository in Phase 6.

2. **Webhook ingestion** - Receive verified GitHub pull request, check, and deployment events through a server-side webhook endpoint.

3. **Durable engineering model** - Store normalized repository, PR, check, deploy, link, and webhook delivery records in Postgres.

4. **Work item linking** - Automatically link GitHub activity to work items when identifiers such as `OPS-128` appear unambiguously in PR titles, bodies, or branch names.

5. **Local read model** - Keep `task_github_status` as the UI-facing summary so pages load from local data instead of calling GitHub during render.

6. **Engineering UI** - Surface live `PR / CI / Deploy` state in board cards, list rows, issue detail, and the `Engineering` project view.

7. **Worker reconciliation** - Add worker paths for backfill, failed delivery replay, and linked repository resync.

## Constraints

- GitHub credentials and webhook secrets stay server-side only.
- Webhook requests must verify `X-Hub-Signature-256` before domain writes.
- Project repository connection mutation is owner/admin only.
- Phase 6 supports one primary repository per project.
- Ambiguous work item matches stay unlinked instead of guessing.
- UI reads the local Postgres read model, not the live GitHub API.
- Existing Phase 5 create/edit/comment flows must remain unchanged.

## Decisions

1. **GitHub App style architecture** - Use webhook ingestion plus local persistence as the integration shape. Direct browser-to-GitHub calls are out of scope.

2. **Postgres read model** - GitHub remains the source of engineering events, while Postgres stores the product-facing cached state.

3. **Identifier-based auto-linking** - Link only when one work item identifier is found unambiguously in PR title, body, or branch name.

4. **Worker repair path** - Webhooks provide freshness, and the worker provides backfill, replay, and reconciliation when events are missed or fail.

5. **Read-only engineering context** - Phase 6 shows engineering facts on issues and dashboards, but does not let users edit GitHub records from the product UI.

## Non-Goals

- Multi-repository project orchestration
- Manual PR-to-issue linking UI for ambiguous cases
- GitHub OAuth/App installation management UI polish
- Editable docs/wiki storage
- Notifications, mentions, or real-time collaboration
- Portfolio reporting or executive dashboards

## Success Criteria

- A project can be connected to one primary GitHub repository.
- Verified GitHub webhook deliveries are persisted and processed idempotently.
- Pull request, check, and deployment payloads update normalized tables.
- `task_github_status` is recalculated from normalized GitHub state.
- Matching work items auto-link to GitHub activity when identifier matching is unambiguous.
- Board and list views show compact `PR / CI / Deploy` chips from the local read model.
- Issue detail shows repository, branch, PR, check, and deploy context without breaking edit/comment flows.
- The `Engineering` page shows repository health, linked PRs, failing checks, deployments, and issue summaries from real persisted state.
- Worker reconciliation can replay failed deliveries and rebuild linked engineering state without corrupting existing rows.

## Technical Direction

- Next.js route handler: `apps/web/src/app/api/webhooks/github/route.ts`
- GitHub server modules: `apps/web/src/server/github/`
- Durable schema: `github_repositories`, `project_github_connections`, `github_pull_requests`, `github_check_rollups`, `github_deployments`, `work_item_github_links`, `github_webhook_deliveries`
- UI read model: keep and derive `task_github_status`
- Worker entrypoint: `apps/worker/src/index.ts`
- Reconciliation logic: `apps/worker/src/github-reconcile.ts`

## Phase Position

Phase 6 of 8. Builds on:
- Phase 2: Auth & Workspace
- Phase 3: Projects & Work Items
- Phase 4: Board/List Views
- Phase 5: Detail, Comments, Plan, Overview, Docs, and Engineering project workspace

Next: Phase 7 shifts to notifications and collaboration follow-ons, including mention dispatch, activity notifications, live updates, and manual collaboration workflows.
