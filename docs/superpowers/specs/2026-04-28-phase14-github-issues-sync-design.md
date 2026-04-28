# Phase 14 GitHub Issues Sync Design

## Goal

Build the durable GitHub Issues sync foundation for connected repositories.

Phase 14 implements a conservative full-sync base:

- import GitHub issues into platform work items;
- keep issue title, body, and open/closed state synchronized in both directions when explicitly enabled;
- record sync status, errors, and conflicts instead of silently overwriting data;
- show GitHub issue comments inside the platform work item timeline as inbound external timeline entries.

Phase 14 stops at GitHub comments inbound. Phase 15 will handle platform comments outbound plus bidirectional comment edit/delete lifecycle.

## Current Baseline

The product already has the pieces needed to authenticate and connect repositories:

- Phase 9 added server-side GitHub App installation token minting for background workers.
- Phase 11 added rollback-safe repository import and project connection creation.
- Phase 12 added GitHub App installation setup, repository listing, repository picker UI, and selected repository import.
- Phase 13 added GitHub App user authorization proof before repository import.
- Phase 6 added GitHub PR, check, deployment projection through webhooks and worker reconciliation.

The current gaps are:

- no durable GitHub issue table;
- no work item to GitHub issue mapping;
- no issue sync status, conflict, or retry state;
- no parser/projector for GitHub `issues` or `issue_comment` webhooks;
- no issue import path in the worker GitHub client;
- local comments are platform-authored and notification-producing, so GitHub comments should not be inserted through the existing local comment creation service.

## Product Decision

Use a conservative full-sync model with field ownership.

GitHub owns GitHub-native fields:

- issue title;
- issue body;
- open/closed state;
- GitHub issue number, URL, author, timestamps, and source metadata.

The platform owns execution fields:

- workflow state and board column;
- priority;
- stage;
- plan item;
- assignee;
- blocked reason;
- position.

Cross-system writeback is allowed only for explicitly supported GitHub-owned fields. Unsupported fields remain read-only projections until a later phase defines ownership.

## Scope

Phase 14 includes:

- schema and shared constants for issue sync state;
- GitHub issue projection table;
- work item to GitHub issue sync mapping table;
- outbound issue sync operation table for retry and webhook loop prevention;
- GitHub issue comments projection table for inbound timeline rendering;
- initial issue import for a connected repository;
- webhook handling for `issues` and `issue_comment`;
- worker backfill/reconcile support for issues and issue comments;
- explicit platform writeback for title, description/body, and state when project settings allow it;
- conflict detection when both sides changed a GitHub-owned field after the last successful sync;
- issue sync status UI in the work item detail panel;
- external GitHub comment timeline rendering;
- project-level issue sync settings with conservative defaults;
- product docs update so current repository-visible product context reflects Phase 14.

Phase 14 does not include:

- platform comments outbound to GitHub;
- bidirectional comment edit/delete lifecycle;
- GitHub labels, milestones, assignees, issue type, dependencies, or GitHub Projects field sync;
- deleting GitHub issues from the platform;
- persistent GitHub user access tokens;
- making GitHub the source of truth for workflow columns, stages, plan items, priority, or assignees;
- importing pull requests as work items through the issue endpoint.

## External Contracts

GitHub contracts used by this phase:

- GitHub REST Issues endpoints support listing, creating, getting, and updating issues. Reference: https://docs.github.com/en/rest/issues
- GitHub issue comments endpoints support listing and creating comments; Phase 14 uses list/read only for inbound projection. Reference: https://docs.github.com/en/rest/issues/comments
- GitHub `issue_comment` webhooks are the event source for comment changes on issues and pull requests. Reference: https://docs.github.com/en/webhooks/webhook-events-and-payloads

Implementation should keep GitHub API versioning centralized in the existing GitHub client layer. Phase 14 should not scatter hard-coded API version strings across services.

## Data Model

Add shared constants and database enums:

- `githubIssueStates`: `open`, `closed`
- `githubIssueSyncStatuses`: `synced`, `pending_outbound`, `conflict`, `error`, `paused`
- `githubIssueSyncOperationStatuses`: `pending`, `succeeded`, `failed`
- `githubIssueSyncOperationTypes`: `update_issue`
- extend `githubWebhookEventNames` with `issues` and `issue_comment`

Add `github_issues`.

Fields:

- `id`
- `repository_id`
- `provider_issue_id`
- `number`
- `title`
- `body`
- `url`
- `state`
- `author_login`
- `github_created_at`
- `github_updated_at`
- `github_closed_at`
- `last_synced_at`
- `created_at`
- `updated_at`

Indexes and constraints:

- unique `(repository_id, provider_issue_id)`
- unique `(repository_id, number)`
- index `(repository_id, state, github_updated_at)`

Add `work_item_github_issue_links`.

Fields:

- `id`
- `work_item_id`
- `repository_id`
- `github_issue_id`
- `source`
- `sync_status`
- `sync_enabled`
- `sync_title`
- `sync_body`
- `sync_state`
- `last_synced_github_updated_at`
- `last_synced_work_item_updated_at`
- `last_synced_title_hash`
- `last_synced_body_hash`
- `last_synced_state`
- `conflict_fields`
- `error_message`
- `created_at`
- `updated_at`

Indexes and constraints:

- unique `work_item_id`
- unique `github_issue_id`
- index `(repository_id, sync_status)`

Add `github_issue_sync_operations`.

Fields:

- `id`
- `link_id`
- `operation_key`
- `operation_type`
- `status`
- `requested_by`
- `requested_at`
- `completed_at`
- `github_updated_at_before`
- `target_fields`
- `error_message`

Indexes and constraints:

- unique `operation_key`
- index `(link_id, status, requested_at)`

Add `github_issue_comments`.

Fields:

- `id`
- `github_issue_id`
- `provider_comment_id`
- `body`
- `url`
- `author_login`
- `github_created_at`
- `github_updated_at`
- `github_deleted_at`
- `last_synced_at`
- `created_at`
- `updated_at`

Indexes and constraints:

- unique `(github_issue_id, provider_comment_id)`
- index `(github_issue_id, github_created_at)`

This projection is intentionally separate from platform `comments`. GitHub comments must render in the timeline as external entries and must not go through `createCommentForUser`, because that service assumes a product user author, local permissions, and local notification fanout.

## Project Settings

Add project-level GitHub issue sync settings, stored either on `project_github_connections` or a separate `project_github_issue_sync_settings` table. Use a separate table if the implementation needs audit-friendly settings history or nullable defaults; otherwise extending the connection table is acceptable.

Required settings:

- `issue_sync_enabled`: default `false` on existing connections, opt-in during or after Phase 14 rollout.
- `sync_title`: default `true`.
- `sync_body`: default `true`.
- `sync_state`: default `true`.
- `import_closed_issues`: default `false`.
- `closed_workflow_state_id`: optional done-category workflow state.
- `reopened_workflow_state_id`: optional active-category workflow state.

Default state behavior:

- GitHub `closed` sets the work item `status` to `Done`, sets `completedAt`, and moves to `closed_workflow_state_id` only when configured.
- GitHub `open` or `reopened` clears `completedAt`, sets the work item `status` to `Todo` or `Doing` based on the configured workflow state, and moves only when `reopened_workflow_state_id` is configured.
- Without configured workflow mapping, GitHub state never guesses a board column.

## Import Flow

Initial import runs for a connected repository after admin authorization and repository connection already exist.

Flow:

1. Admin starts issue import from the connected project.
2. Server verifies workspace owner/admin role and existing project GitHub connection.
3. Worker/client fetches repository issues using the GitHub App installation token.
4. Import filters out pull requests by rejecting issue payloads that contain a `pull_request` object.
5. Each issue is upserted into `github_issues`.
6. Each issue is linked to an existing work item if a link already exists; otherwise it creates a platform work item with title/body copied from the issue.
7. The link records the initial hashes and timestamps as the last synced baseline.
8. Issue comments are fetched and upserted into `github_issue_comments`.
9. Import summary reports created, updated, skipped PRs, conflicted, and failed counts.

New work items from GitHub issues should use normal project identifiers, but should preserve GitHub issue number and URL in sync metadata. The platform identifier remains the internal execution handle.

## Webhook Flow

Extend webhook support to accept `issues` and `issue_comment`.

Inbound `issues` events:

- verify signature and delivery id using the existing webhook route;
- dedupe through `github_webhook_deliveries`;
- resolve repository by provider repository id;
- ignore pull request issue payloads;
- upsert `github_issues`;
- find or create a linked work item;
- apply title/body/state only when sync is enabled and no conflict exists;
- update sync baseline after a successful projection;
- mark link `conflict` when GitHub-owned fields changed on both sides since the last synced baseline.

Inbound `issue_comment` events:

- verify and dedupe like other webhook deliveries;
- ignore comments on pull requests unless the related issue is linked as a GitHub issue work item;
- upsert the parent issue if the payload provides enough issue data;
- upsert the comment projection on `created` and `edited`;
- set `github_deleted_at` for `deleted`;
- never create a platform local comment in Phase 14.

Webhook loop prevention:

- outbound platform writes create a `github_issue_sync_operations` row before calling GitHub;
- the operation records target fields and GitHub `updated_at` observed before the call;
- when a webhook arrives with matching target field values, the operation is marked `succeeded` and no conflict is raised;
- if GitHub returns an error, the operation is marked `failed`, link status becomes `error`, and the UI can offer retry.

## Outbound Platform Writes

Outbound writeback is explicit and narrow.

Supported writes:

- title edit writes to GitHub issue `title` when `sync_title` is enabled;
- description edit writes to GitHub issue `body` when `sync_body` is enabled;
- explicit complete/reopen action writes to GitHub issue `state` when `sync_state` is enabled.

Unsupported writes:

- moving workflow columns;
- assigning platform members;
- changing platform priority;
- editing stage or plan item;
- creating, editing, or deleting platform comments.

The platform should not write to GitHub just because a system import or projection changed local data. Only user-initiated edits to GitHub-owned fields should write back.

## Conflict Handling

Conflict detection is field-level.

For each GitHub-owned field:

1. compare current GitHub value with last synced GitHub baseline;
2. compare current platform value with last synced platform baseline;
3. if both changed and values differ, mark the link `conflict` and record the field name;
4. do not overwrite either side automatically.

Phase 14 UI should show:

- a sync status pill in the detail panel;
- a conflict banner listing conflicted fields;
- a retry action for `error`;
- a "sync paused" copy when project settings or link settings disable sync.

Phase 14 does not need a full visual merge editor. Resolution can be a small explicit action: keep platform value or keep GitHub value for the conflicted field.

## Timeline UI

Extend timeline entries with an external GitHub comment kind.

Timeline entry shape should distinguish:

- local platform comments;
- activity log entries;
- GitHub issue comments.

GitHub comment rendering:

- label as `GitHub comment`;
- show GitHub author login;
- show GitHub timestamp;
- link to the GitHub comment URL;
- render markdown through the same markdown renderer used by local comments;
- hide deleted GitHub comments by default, or render a compact deleted marker when audit clarity requires it.

Local comment creation, edit, and delete controls must remain scoped to platform comments only.

## Services And Boundaries

Add a focused GitHub issues module rather than expanding PR projection files until they become unclear.

Suggested modules:

- `apps/web/src/server/github/issues/service.ts`
- `apps/web/src/server/github/issues/repository.ts`
- `apps/web/src/server/github/issues/types.ts`
- `apps/worker/src/github-issues-client.ts`
- `apps/worker/src/github-issues-reconcile.ts`

Responsibilities:

- parse GitHub issue and issue comment payloads;
- normalize GitHub REST payloads into internal DTOs;
- upsert issue and comment projections;
- create or link work items;
- detect and persist conflicts;
- enqueue or execute outbound update operations;
- provide view models for detail panel sync status and timeline entries.

Keep PR/check/deployment projection working as-is. Shared helpers for GitHub request headers, pagination, token provider, and timestamp parsing can be extracted only if needed by both PR and issue clients.

## Permissions And Security

Admin-only:

- enable project issue sync;
- start initial import;
- change project issue sync settings.

Member-level:

- edit platform title/description/state according to existing work item permissions;
- outbound GitHub writeback only occurs if sync settings allow the field.

Token boundary:

- background import, reconcile, and outbound writes use GitHub App installation tokens;
- GitHub App user access tokens remain short-lived proof for repository import and are not persisted;
- no personal access token path is added.

Error boundary:

- GitHub API error messages stored in DB should be sanitized and not include token values or response bodies that may contain sensitive data;
- webhook verification must continue to fail closed when the signing secret is blank or invalid.

## Rollout

Use a conservative rollout:

1. Add schema, constants, and projection tests.
2. Add import/reconcile support behind disabled-by-default project settings.
3. Add webhook support for `issues` and `issue_comment`.
4. Add UI for sync status, conflicts, import action, and external comments.
5. Enable issue sync only for projects that explicitly turn it on.

Existing connected projects should not automatically import issues on deploy.

## Verification

Required tests:

- shared constants and schema enum alignment tests;
- repository tests for issue/comment upsert uniqueness;
- service tests for import filtering of pull requests;
- service tests for field-level ownership and conflict detection;
- webhook tests for `issues` and `issue_comment`;
- outbound operation tests for success, failure, and loop prevention;
- worker client tests for pagination, issue filtering, comment fetching, and token use;
- timeline UI tests for GitHub external comments;
- detail panel tests for synced, paused, conflict, and error states.

Full verification before PR completion:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- browser smoke test for connected project issue import, sync status, external GitHub comments, and conflict/error states.

## Product Docs Update

Phase 14 must update:

- `docs/product/idea-brief.md`
- `docs/product/decision-brief.md`
- `docs/product/prd.md`

The docs should identify the current product direction as:

- project planning and execution workspace;
- live engineering state from connected repositories;
- GitHub issue sync as a durable bridge between engineering source-of-record issues and platform execution planning;
- lightweight collaboration through local comments and external GitHub comment visibility.

## Exit Criteria

Phase 14 is complete when:

- a connected repository can import GitHub issues into platform work items;
- pull requests are not imported as issues;
- GitHub issue title/body/state updates sync inbound;
- supported platform title/description/state edits write back to GitHub when enabled;
- conflicts are persisted and visible instead of silently overwritten;
- GitHub issue comments appear in the work item timeline as external entries;
- platform comments are not written to GitHub;
- sync failures are visible and retryable;
- product docs reflect Phase 14;
- full repo verification and browser smoke checks pass.
