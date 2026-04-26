# PRD: Phase 7 - Notifications and Collaboration Foundation

## Overview

Add a durable in-app notification foundation for comments, mentions, assignments, work item changes, and GitHub engineering updates. Phase 7 makes collaboration actionable without adding external delivery channels or real-time transport.

## Scope Sections

### 7.1 Shared Notification Contracts

Notification concepts must be shared across web, DB, worker, and tests.

**Requirements:**
- Define source types for comment, work item, GitHub, and system events.
- Define event types for comments, mentions, assignments, state changes, priority raises, GitHub PR/check/deploy changes, and webhook failures.
- Define priorities and recipient reasons.
- Export shared record types for events, recipients, preferences, and inbox items.

### 7.2 Durable Notification Schema

Persist notifications locally before rendering or repairing them.

**Requirements:**
- Add `notification_events` with workspace, project, work item, source identity, event type, actor, priority, title, body, URL, metadata, and created timestamp.
- Add `notification_recipients` with event id, workspace id, recipient id, reason, read timestamp, dismiss timestamp, and created timestamp.
- Add `notification_preferences` keyed by workspace id and user id.
- Enforce event uniqueness by workspace, source type, source id, and event type.
- Enforce recipient uniqueness by event, recipient, and reason.
- Add indexes for current-user inbox reads.

### 7.3 Notification Service and API

Centralize notification rules and expose current-user operations.

**Requirements:**
- Create notifications from source events with recipient resolution and preference filtering.
- Suppress actor self-notifications.
- Keep recipient insertion idempotent.
- Enforce workspace membership for inbox reads and preference reads/writes.
- Add API routes to list inbox notifications, mark one notification read, mark all read, read preferences, and update preferences.
- Return 404 when a user tries to mark another user's recipient row.

### 7.4 Comment and Mention Notifications

Comments should direct attention to valid teammates.

**Requirements:**
- Parse deterministic `@userId` mentions from comment content.
- Notify valid mentioned workspace members with reason `mention`.
- Notify assignees and prior participants with reason `participant` when not already mentioned.
- Ignore unknown mentions and actor self-notifications.
- Do not emit notifications for comment edits or deletes in Phase 7.

### 7.5 Work Item Change Notifications

Important execution changes should notify affected users.

**Requirements:**
- Notify newly assigned users on assignment changes.
- Notify assignees and participants on workflow state changes.
- Notify assignees and participants when priority is raised to urgent.
- Resolve participants from assignee, creator activity, and prior commenters.
- Preserve existing activity log behavior.

### 7.6 GitHub Engineering Notifications

Engineering changes should reach users attached to linked work items.

**Requirements:**
- Notify linked item followers when PRs open, request review, merge, or close.
- Notify linked item followers when check rollups fail or recover.
- Notify linked item followers when deployments reach staging or production.
- Notify project owners/admins when a connected repository webhook delivery fails processing.
- Rely on notification event uniqueness to keep webhook replay duplicate-safe.

### 7.7 In-App Notification UI

The project shell should expose a lightweight inbox.

**Requirements:**
- Extend the project page loader with recent inbox rows, unread count, and current preferences.
- Add a compact notification bell to the project shell header.
- Show unread count as a badge.
- Open an inbox panel with recent notifications.
- Render source label, title, context/body, work item identifier, timestamp, unread state, and link.
- Add mark-read and mark-all-read controls using the notification API.
- Add preference checkboxes for comments, mentions, assignments, GitHub, and state changes.

### 7.8 Worker Notification Repair

The worker should repair notification gaps safely.

**Requirements:**
- Add a `repair-notifications` worker mode.
- Find notification events missing recipient rows.
- Rebuild recipients using the same membership, preference, self-notification, and participant semantics as the web notification service.
- Add an explicitly enabled recent-activity backfill path.
- Keep repair idempotent through event and recipient uniqueness.
- Emit summary logs with repaired events and inserted recipient counts.

### 7.9 Verification

Automated coverage must prove notification contracts, domain behavior, UI behavior, and worker repair.

**Requirements:**
- Shared contract tests pass.
- DB schema tests pass.
- Notification service tests cover idempotency, preference filtering, self-notification suppression, and cross-workspace isolation.
- Comment, work item, GitHub, and API integration tests pass.
- UI tests cover unread badge, inbox rows, mark-read, mark-all-read, and preference toggles.
- Worker tests cover missing recipients, preference filtering, duplicate-safe re-run, and recent activity backfill.
- Full repo lint, typecheck, test, and build pass.

## Data Model

```
notification_events:
  id: uuid PK
  workspace_id: uuid FK
  project_id: uuid FK nullable
  work_item_id: uuid FK nullable
  source_type: enum
  source_id: text
  event_type: enum
  actor_id: text nullable
  priority: enum
  title: text
  body: text nullable
  url: text
  metadata: jsonb nullable
  created_at: timestamp

notification_recipients:
  id: uuid PK
  event_id: uuid FK
  workspace_id: uuid FK
  recipient_id: text
  reason: enum
  read_at: timestamp nullable
  dismissed_at: timestamp nullable
  created_at: timestamp

notification_preferences:
  workspace_id: uuid FK
  user_id: text
  comments_enabled: boolean
  mentions_enabled: boolean
  assignments_enabled: boolean
  github_enabled: boolean
  state_changes_enabled: boolean
```

## Exit Criteria

- All 10 success criteria from the decision brief are met.
- Phase 7 tests pass without external delivery services.
- Full repo verification passes: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Product docs identify Phase 8 as reporting, search, and polish.
