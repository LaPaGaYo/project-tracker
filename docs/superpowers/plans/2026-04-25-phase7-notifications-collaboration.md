# Phase 7 Notifications and Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable in-app notification foundation for comments, mentions, assignments, work item changes, and GitHub engineering updates.

**Architecture:** Use notification source events plus per-user recipient rows. Domain services emit notification events after successful mutations, the notification service resolves recipients and applies preferences, and the worker repairs missing recipients or recent missed source events. UI reads local Postgres notification state and does not depend on real-time transport in this phase.

**Tech Stack:** Next.js App Router, server route handlers, Drizzle ORM, Postgres, worker runtime in `apps/worker`, Vitest for UI tests, Node contract tests, shared TypeScript contracts.

---

### Task 1: Add Shared Notification Contracts

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/types.test.ts`

- [x] Add `notificationSourceTypes = ["comment", "work_item", "github", "system"]`.
- [x] Add `notificationEventTypes = ["comment_created", "mention_created", "assignment_changed", "state_changed", "priority_raised", "github_pr_changed", "github_check_changed", "github_deploy_changed", "github_webhook_failed"]`.
- [x] Add `notificationPriorities = ["low", "normal", "high"]`.
- [x] Add `notificationRecipientReasons = ["mention", "assigned", "participant", "owner", "github", "system"]`.
- [x] Export matching TypeScript union types.
- [x] Add shared interfaces:
  - `NotificationEventRecord`
  - `NotificationRecipientRecord`
  - `NotificationPreferenceRecord`
  - `NotificationInboxItem`
- [x] Extend `packages/shared/src/types.test.ts` to assert the notification enum values and record shape stay aligned.
- [x] Run: `npm run typecheck --workspace @the-platform/shared`
- [x] Run: `npm run test --workspace @the-platform/shared`
- [x] Expected: PASS with notification contracts available to web, db, and worker.
- [x] Commit: `feat: add shared notification contracts`

### Task 2: Add Durable Notification Schema

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/seed.ts`
- Create: `packages/db/src/notification-schema.test.ts`
- Create: new Drizzle migration under `packages/db/drizzle/`

- [x] Add `pgEnum` definitions for notification source type, event type, priority, and recipient reason.
- [x] Add `notification_events` with workspace/project/work item references, source identity, title/body/url, metadata, priority, actor, and created timestamp.
- [x] Add `notification_recipients` with event id, workspace id, recipient id, reason, read/dismiss timestamps, and created timestamp.
- [x] Add `notification_preferences` keyed by workspace id and user id.
- [x] Add uniqueness constraints:
  - `notification_events_workspace_source_event_unique` on workspace id, source type, source id, event type
  - `notification_recipients_event_recipient_reason_unique` on event id, recipient id, reason
  - `notification_preferences_workspace_user_unique` on workspace id and user id
- [x] Add indexes for user inbox reads: workspace id, recipient id, read at, created at.
- [x] Add seed rows that create at least one unread notification for the seeded project owner.
- [x] Add schema tests that assert tables, enums, uniqueness, and inbox indexes exist.
- [x] Run: `npm run db:generate --workspace @the-platform/db`
- [x] Run: `npm run db:migrate --workspace @the-platform/db`
- [x] Run: `npm run test --workspace @the-platform/db`
- [x] Expected: PASS with migration generated and schema tests green.
- [x] Commit: `feat: add notification schema`

### Task 3: Add Notification Repository and Service

**Files:**
- Create: `apps/web/src/server/notifications/types.ts`
- Create: `apps/web/src/server/notifications/repository.ts`
- Create: `apps/web/src/server/notifications/service.ts`
- Create: `tests/phase7-notifications-service.test.mjs`

- [x] Define repository methods for:
  - `upsertNotificationEvent`
  - `insertNotificationRecipients`
  - `getNotificationPreferences`
  - `upsertNotificationPreferences`
  - `listInboxForUser`
  - `markNotificationReadForUser`
  - `markAllNotificationsReadForUser`
  - `listWorkspaceMembers`
  - `getWorkItemParticipants`
- [x] Implement serialization helpers that return shared notification record types.
- [x] Implement service methods:
  - `createNotificationForSource`
  - `listNotificationsForUser`
  - `markNotificationReadForUser`
  - `markAllNotificationsReadForUser`
  - `getNotificationPreferencesForUser`
  - `updateNotificationPreferencesForUser`
- [x] Implement preference filtering before recipient rows are inserted.
- [x] Prevent self-notifications by removing the actor from the resolved recipient list.
- [x] Enforce workspace membership for every read or mutation.
- [x] Add contract tests for idempotency, preference filtering, self-notification suppression, and cross-workspace isolation.
- [x] Run: `node --import tsx --test tests/phase7-notifications-service.test.mjs`
- [x] Expected: PASS with the service usable independently from comments or GitHub.
- [x] Commit: `feat: add notification service`

### Task 4: Emit Notifications From Comments and Mentions

**Files:**
- Modify: `apps/web/src/server/comments/types.ts`
- Modify: `apps/web/src/server/comments/repository.ts`
- Modify: `apps/web/src/server/comments/service.ts`
- Modify: `apps/web/src/server/api/detail-handlers.ts`
- Modify: `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/comments/route.ts`
- Modify: `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/comments/[commentId]/route.ts`
- Modify: `tests/phase5-detail-comments.test.mjs`
- Create: `tests/phase7-comment-notifications.test.mjs`

- [x] Add notification dependencies to comment service calls without changing existing comment CRUD response shapes.
- [x] Add a mention parser that extracts `@userId` tokens from comment content and keeps only workspace members.
- [x] On comment create, notify mentioned users with reason `mention`.
- [x] On comment create, notify the current assignee and prior comment participants with reason `participant` when they are not the actor and are not already notified by mention.
- [x] Do not emit notifications for comment edits or deletes in Phase 7.
- [x] Keep all existing Phase 5 comment permissions intact.
- [x] Add tests for mention notifications, participant notifications, unknown mention suppression, and no self-notification.
- [x] Run: `node --import tsx --test tests/phase5-detail-comments.test.mjs tests/phase7-comment-notifications.test.mjs`
- [x] Expected: PASS with comment CRUD unchanged and notification recipients created only for valid users.
- [x] Commit: `feat: notify users from comments and mentions`

### Task 5: Emit Notifications From Work Item Changes

**Files:**
- Modify: `apps/web/src/server/work-items/types.ts`
- Modify: `apps/web/src/server/work-items/repository.ts`
- Modify: `apps/web/src/server/work-items/service.ts`
- Modify: `apps/web/src/server/api/project-handlers.ts`
- Modify: `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/route.ts`
- Modify: `tests/phase3-projects-work-items.test.mjs`
- Create: `tests/phase7-work-item-notifications.test.mjs`

- [x] Add notification dependencies to work item update flows after the repository mutation succeeds.
- [x] Emit `assignment_changed` when a user is assigned or reassigned.
- [x] Emit `state_changed` for assignees and participants when workflow state changes.
- [x] Emit `priority_raised` when priority moves to `urgent`.
- [x] Resolve participants from assignee, creator activity, and prior commenters.
- [x] Keep existing activity log entries unchanged.
- [x] Add tests for assignment, state change, urgent priority, participant resolution, and no self-notification.
- [x] Run: `node --import tsx --test tests/phase3-projects-work-items.test.mjs tests/phase7-work-item-notifications.test.mjs`
- [x] Expected: PASS with notification generation layered onto current work item mutation behavior.
- [x] Commit: `feat: notify users from work item changes`

### Task 6: Emit Notifications From GitHub Engineering Changes

**Files:**
- Modify: `apps/web/src/server/github/types.ts`
- Modify: `apps/web/src/server/github/repository.ts`
- Modify: `apps/web/src/server/github/service.ts`
- Modify: `apps/web/src/server/github/webhooks.ts`
- Modify: `tests/phase6-github-projection.test.mjs`
- Create: `tests/phase7-github-notifications.test.mjs`

- [x] Add notification dependencies to GitHub projection after normalized PR/check/deploy state is persisted.
- [x] Emit `github_pr_changed` for linked PR open, review requested, merged, and closed transitions.
- [x] Emit `github_check_changed` when linked checks move into failing or recover to passing.
- [x] Emit `github_deploy_changed` when linked deployments reach staging or production.
- [x] Emit `github_webhook_failed` to project admins/owners when a connected repository delivery fails processing.
- [x] Resolve recipients from work item assignee, creator activity, and comment participants.
- [x] Keep webhook replay idempotent by relying on notification event uniqueness.
- [x] Add tests for PR, failing check, recovered check, production deploy, failed webhook, and replay dedupe.
- [x] Run: `node --import tsx --test tests/phase6-github-projection.test.mjs tests/phase7-github-notifications.test.mjs`
- [x] Expected: PASS with engineering notifications derived from persisted GitHub state.
- [x] Commit: `feat: notify users from github engineering changes`

### Task 7: Add Notification API Routes

**Files:**
- Create: `apps/web/src/app/api/workspaces/[slug]/notifications/route.ts`
- Create: `apps/web/src/app/api/workspaces/[slug]/notifications/[notificationId]/route.ts`
- Create: `apps/web/src/app/api/workspaces/[slug]/notifications/mark-all-read/route.ts`
- Create: `apps/web/src/app/api/workspaces/[slug]/notification-preferences/route.ts`
- Create: `tests/phase7-notification-api.test.mjs`

- [x] Add `GET /api/workspaces/[slug]/notifications` for the current user's inbox.
- [x] Add `PATCH /api/workspaces/[slug]/notifications/[notificationId]` to mark one notification read.
- [x] Add `POST /api/workspaces/[slug]/notifications/mark-all-read` to mark all current user's workspace notifications read.
- [x] Add `GET /api/workspaces/[slug]/notification-preferences`.
- [x] Add `PATCH /api/workspaces/[slug]/notification-preferences`.
- [x] Return 403 when the current user is not a workspace member.
- [x] Return 404 when trying to mark another user's notification recipient row.
- [x] Add API tests for read, mark-one, mark-all, preferences, and cross-user isolation.
- [x] Run: `node --import tsx --test tests/phase7-notification-api.test.mjs`
- [x] Expected: PASS with all API routes scoped to the current user.
- [x] Commit: `feat: add notification api routes`

### Task 8: Add In-App Notification UI

**Files:**
- Create: `apps/web/src/components/notification-bell.tsx`
- Create: `apps/web/src/components/notification-inbox.tsx`
- Create: `apps/web/src/components/notification-preferences.tsx`
- Modify: `apps/web/src/features/workspace/project-shell.tsx`
- Modify: `apps/web/src/app/workspaces/[slug]/projects/[key]/project-page-data.ts`
- Create: `apps/web/src/features/notifications/__tests__/notification-ui.test.tsx`

- [x] Extend the project workspace loader so it returns unread notification count and recent inbox rows for the current user.
- [x] Add a compact bell button to the project shell header.
- [x] Show unread count as a small badge.
- [x] Open an inbox panel with recent notifications.
- [x] Render notification rows with source label, title, context, work item identifier, timestamp, unread state, and link.
- [x] Add mark-read and mark-all-read controls that call the new API routes.
- [x] Add a compact preferences panel with checkboxes for comments, mentions, assignments, GitHub, and state changes.
- [x] Add UI tests for unread badge, inbox rows, mark read, mark all read, and preference toggles.
- [x] Run: `npm run test --workspace @the-platform/web -- notification-ui project-shell`
- [x] Expected: PASS with notification UI integrated into the existing workspace shell.
- [x] Commit: `feat: add in-app notification inbox`

### Task 9: Add Worker Notification Repair

**Files:**
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/src/notification-repair.ts`
- Create: `apps/worker/src/notification-repair.test.ts`
- Modify: `apps/worker/package.json`
- Modify: `tests/phase1-foundation-contract.test.mjs`

- [x] Add `NOTIFICATION_REPAIR_MODE` or extend the existing worker mode parser with `repair-notifications`.
- [x] Implement a repair job that finds notification events missing recipient rows.
- [x] Rebuild recipients using the same resolver semantics as the web notification service.
- [x] Add an optional recent-activity backfill path for activity rows that have no matching notification event.
- [x] Ensure the repair job is idempotent by relying on event and recipient uniqueness.
- [x] Add worker tests for missing recipients, preference filtering, and duplicate-safe re-run.
- [x] Run: `npm run test --workspace @the-platform/worker`
- [x] Run: `node --import tsx --test tests/phase1-foundation-contract.test.mjs`
- [x] Expected: PASS with worker responsibility updated beyond GitHub reconciliation.
- [x] Commit: `feat: add notification repair worker`

### Task 10: Final Verification and Delivery

**Files:**
- Modify: `docs/product/idea-brief.md`
- Modify: `docs/product/decision-brief.md`
- Modify: `docs/product/prd.md`
- Modify: `docs/superpowers/plans/2026-04-25-phase7-notifications-collaboration.md`

- [x] Update product docs so Phase 7 describes the in-app notification foundation and Phase 8 shifts to reporting/search/polish.
- [x] Run: `npm run lint`
- [x] Run: `npm run typecheck`
- [x] Run: `npm test`
- [x] Run: `npm run build`
- [x] Locally verify with integration coverage because no dev server was active on `localhost:3000` or `localhost:3001` during the final pass:
  - create a comment with a valid workspace member mention
  - see unread count increment for the mentioned user
  - mark the notification read
  - assign a work item and see the assignee notification
  - replay a GitHub event and confirm duplicate notifications are not created
- [x] Commit: `docs: finalize phase 7 notifications plan`
