# Phase 7 Notifications and Collaboration Design

## Goal

Add a durable notification foundation so project changes, comments, mentions, assignments, and GitHub engineering updates become visible to the right teammates without relying on users to manually scan every board, issue, or activity feed.

## Current Baseline

- Phase 5 added work item detail, comments, description history, activity timeline, and project workspace views.
- Phase 6 added live GitHub repository state, webhook delivery persistence, reconciliation, and engineering chips across board, list, detail, and engineering views.
- `activity_log` already records project and work item mutations, but it is a chronological audit feed, not a per-user inbox.
- Comments are persisted and permissioned, but `@mentions` are only text and do not create user-facing notifications.
- Workspace membership stores user IDs and roles, but there is no notification preference, unread count, delivery state, or project inbox.
- The worker can run reconciliation jobs, making it a good place for notification repair and digest jobs after the inbox model exists.

## Product Intent

Phase 7 should make collaboration actionable while keeping the product quiet and execution-focused:

- `Jira` still owns the work item and project execution model.
- `GitHub` still owns engineering truth.
- The product now needs a lightweight collaboration layer that tells users what needs attention.

The goal is not to become Slack or email. The first step is an in-app, durable notification layer that future delivery channels can reuse.

## Chosen Approach

Use an `event -> recipient inbox -> read state` architecture.

Why this approach:

- Notification creation becomes deterministic and testable.
- Users can be offline and still return to a correct inbox.
- UI can show unread counts without replaying comments or activity logs on every request.
- Future delivery channels such as email, Slack, or push can subscribe to the same notification events without changing product workflows.
- Near-real-time refresh can be layered on top after persistence is stable.

## Rejected Approaches

### 1. Render notifications directly from `activity_log`

Rejected because activity entries are audit records, not recipient-specific delivery records. They do not track read state, preference filtering, or per-user targeting.

### 2. Start with WebSockets or SSE only

Rejected because real-time transport without a durable inbox loses context when users are offline and creates extra complexity before the event model is stable.

### 3. Send external notifications first

Rejected because email or Slack delivery needs unsubscribe rules, retry state, and channel identity. Phase 7 should first define what deserves attention inside the product.

## Phase 7 Scope

Phase 7 includes:

- shared notification event, priority, recipient reason, and read-state contracts
- durable notification events and per-user recipient rows
- default notification preferences per workspace member
- notification creation from comments, mentions, assignments, work item state changes, and GitHub PR/check/deploy changes
- an in-app notification inbox and unread count in the project workspace shell
- mark one notification read, mark all read, and preference update flows
- worker repair job to backfill missed notification recipients from source events

Phase 7 does not include:

- email, Slack, push, SMS, or mobile notifications
- WebSocket infrastructure
- collaborative document editing
- comment threading beyond existing flat comments
- rich user profile lookup beyond current workspace member user IDs
- cross-workspace global notification center

## User-Facing Outcome

After Phase 7:

- users can see an unread count in the project workspace
- users can open an in-app inbox for notifications relevant to their work
- users receive notifications when they are assigned to a work item
- users receive notifications when they are mentioned in a comment
- users receive notifications for comments on work items they own, are assigned to, or have participated in
- users receive notifications for relevant GitHub PR/check/deploy changes on linked work items
- users can mark notifications read and adjust coarse preferences

## Notification Sources

### Comments

Create notifications for:

- direct `@userId` mentions in comment content
- the assignee of the work item when someone else comments
- prior comment participants when someone else adds a new comment

Do not notify:

- the actor who created the comment
- deleted comments
- users outside the workspace

### Work Item Changes

Create notifications for:

- assignment to a user
- reassignment away from a user
- workflow state change on a work item where the user is assignee, creator, or prior participant
- priority change to `urgent` for assignee and prior participants

Do not notify:

- viewers who have no direct relationship to the item
- the actor who made the change

### Mentions

Phase 7 supports deterministic mention parsing with the current identity model:

- a mention token is `@` followed by a workspace member user ID
- mention lookup is case-sensitive and workspace-scoped
- unknown mention tokens do not create notifications

This avoids adding a username/profile system before the repository has one.

### GitHub Engineering Changes

Create notifications for linked work items when:

- a pull request opens, moves to review-requested, merges, or closes
- checks move from passing or unknown to failing
- checks recover from failing to passing
- deployment reaches staging or production
- webhook processing fails for a repository connected to a project

Recipients are:

- work item assignee
- work item creator when known from activity history
- users who commented on the work item

## Data Model

### `notification_events`

Stores the source event once.

- `id`
- `workspace_id`
- `project_id`
- `work_item_id` nullable
- `source_type`: comment, work_item, github, system
- `source_id`
- `event_type`
- `actor_id` nullable
- `priority`: low, normal, high
- `title`
- `body` nullable
- `url`
- `metadata` jsonb
- `created_at`

### `notification_recipients`

Stores per-user delivery and read state.

- `id`
- `event_id`
- `workspace_id`
- `recipient_id`
- `reason`: mention, assigned, participant, owner, github, system
- `read_at` nullable
- `dismissed_at` nullable
- `created_at`

### `notification_preferences`

Stores coarse per-workspace user preferences.

- `workspace_id`
- `user_id`
- `comments_enabled`
- `mentions_enabled`
- `assignments_enabled`
- `github_enabled`
- `state_changes_enabled`
- `created_at`
- `updated_at`

## API Surface

Phase 7 should add:

- `GET /api/workspaces/[slug]/notifications`
- `PATCH /api/workspaces/[slug]/notifications/[notificationId]`
- `POST /api/workspaces/[slug]/notifications/mark-all-read`
- `GET /api/workspaces/[slug]/notification-preferences`
- `PATCH /api/workspaces/[slug]/notification-preferences`

Server loaders for project workspace pages can read unread counts directly without requiring client fetches on initial render.

## UX Rules

### Notification Bell

- Put a small notification bell in the existing project/workspace shell header.
- Show unread count as a compact badge.
- The bell opens an inbox panel or popover with recent notifications.
- Keep the UI dense and operational, matching the current Jira-like workspace.

### Inbox Rows

Each row shows:

- source icon or compact label
- title
- short body or context line
- work item identifier when available
- relative time
- unread state
- direct link to the relevant project or work item

### Preferences

Preferences should be coarse checkboxes grouped by source:

- comments
- mentions
- assignments
- GitHub engineering changes
- state changes

No per-project or per-issue preferences in Phase 7.

## Architecture

### Notification Service

Add a server-side notification service responsible for:

- creating a notification event
- resolving recipients
- applying preference filters
- inserting recipient rows idempotently
- reading user inbox rows
- marking notifications read

Product services should call this service after successful domain mutations. They should not write notification tables directly.

### Idempotency

Notification event uniqueness should be based on:

- workspace id
- source type
- source id
- event type

Recipient uniqueness should be based on:

- event id
- recipient id
- reason

This prevents duplicate notifications when webhook replay or worker reconciliation runs.

### Worker Repair

The worker should support a notification repair mode that can:

- find notification events missing recipient rows
- rebuild recipients using the current resolver logic
- backfill notifications for recent activity rows if needed

The repair job must be safe to re-run.

## Security Model

- Users can only read notifications for workspaces where they are members.
- Users can only mark their own notification recipient rows read or dismissed.
- Preference updates are scoped to the current user.
- Notification generation must never disclose work item titles or GitHub context to users outside the workspace.
- System-generated GitHub notifications use a nullable or explicit system actor, not a fake user.

## Failure Handling

- Domain mutations should not fail solely because notification creation fails.
- Notification creation failures should be captured as structured logs or failed repair candidates.
- Worker repair can rebuild missing recipient rows from persisted source events.
- Unknown mentions are ignored, not treated as hard errors.
- Preference filtering happens before recipient rows are created.

## Testing Strategy

Phase 7 requires:

- shared contract tests for notification constants and record types
- DB schema tests for notification uniqueness and indexes
- service tests for recipient resolution, preference filtering, idempotency, and RBAC
- integration tests for comment mentions, assignment changes, state changes, and GitHub engineering notifications
- worker tests for notification repair
- UI tests for unread badge, inbox rows, mark read, and preferences

## Success Criteria

1. Notification contracts exist in `@the-platform/shared`.
2. Durable notification tables and migrations exist in `@the-platform/db`.
3. Comment mentions create recipient-specific in-app notifications.
4. Assignment and important work item changes create notifications for the right users.
5. GitHub PR/check/deploy changes create notifications for users attached to linked work items.
6. Users can read only their own inbox rows.
7. Users can mark one notification read and mark all workspace notifications read.
8. Users can update coarse notification preferences.
9. Worker repair can rebuild missing notification recipients safely.
10. Project workspace UI shows unread count and an in-app inbox without breaking existing Phase 5/6 flows.
11. Full repo verification passes after integration.
