# Idea Brief: Phase 7 - Notifications and Collaboration Foundation

## Problem

The project workspace now has Jira-like execution, plan alignment, comments, and live GitHub engineering status. The remaining collaboration gap is attention: teammates still need to scan boards, comments, assignments, and engineering views to know what changed for them.

Without a durable notification layer, the product can show project truth but cannot reliably direct each teammate to the work that needs their response.

## Goals

1. **Durable notification model** - Store notification source events separately from per-user recipient rows.

2. **Source-driven notification creation** - Emit notifications from comments, mentions, assignments, work item state or priority changes, GitHub PR/check/deploy changes, and webhook failures.

3. **In-app inbox** - Add a compact notification bell, unread count, inbox panel, mark-read, and mark-all-read controls to the project workspace shell.

4. **Coarse preferences** - Let users tune comments, mentions, assignments, GitHub, and state-change notification categories per workspace.

5. **Worker repair path** - Add a safe worker mode that rebuilds missing recipient rows and can explicitly backfill recent missed activity.

6. **Local-first reads** - Keep the UI reading local Postgres notification state instead of relying on real-time transport in this phase.

## Constraints

- Users can only read or mutate notification rows for workspaces where they are members.
- Users can only mark their own recipient rows read.
- Notification creation must not change existing comment, work item, or GitHub response shapes.
- Self-notifications are suppressed.
- Recipient creation must remain idempotent across webhook replay and worker repair.
- Phase 7 does not add email, Slack, push, or global cross-workspace notification delivery.

## Decisions

1. **Event plus recipient tables** - Notification events capture what happened; recipient rows capture who should see it and read state.

2. **Domain services emit events** - Comments, work items, and GitHub services call the notification service after successful mutations. They do not write notification tables directly.

3. **In-app first** - Phase 7 ships a project-workspace inbox before external delivery channels.

4. **Coarse preference model** - Workspace-level category switches are enough for this phase. Per-project and per-issue preferences remain out of scope.

5. **Repair worker** - The worker owns deterministic repair for missing recipients and optional recent activity backfill.

## Non-Goals

- Email, Slack, push, SMS, or mobile notifications
- Real-time websocket delivery
- Global cross-workspace notification center
- Per-project or per-issue notification preferences
- Manual ambiguous GitHub link management
- Portfolio reporting or executive dashboards

## Success Criteria

- Shared notification contracts exist for source type, event type, priority, recipient reason, events, recipients, preferences, and inbox items.
- Postgres has durable notification event, recipient, and preference tables with uniqueness and inbox lookup indexes.
- Comments notify valid mentions, assignees, and prior participants without notifying the actor.
- Work item assignment, state change, and urgent-priority changes notify the right users.
- GitHub PR, check, deploy, and webhook failure events create relevant notifications without duplicate recipients on replay.
- API routes list the current user's inbox, mark one notification read, mark all read, and update preferences with workspace scoping.
- The project shell shows an unread badge and inbox panel with source, title, context, work item identifier, timestamp, read state, link, and preferences.
- Worker notification repair can rebuild missing recipients safely and idempotently.

## Technical Direction

- Shared contracts: `packages/shared/src/constants.ts`, `packages/shared/src/types.ts`
- Durable schema: `notification_events`, `notification_recipients`, `notification_preferences`
- Web notification service: `apps/web/src/server/notifications/`
- API routes: `apps/web/src/app/api/workspaces/[slug]/notifications/*`
- UI components: `apps/web/src/components/notification-bell.tsx`, `notification-inbox.tsx`, `notification-preferences.tsx`
- Worker repair: `apps/worker/src/notification-repair.ts`

## Phase Position

Phase 7 of 8. Builds on:
- Phase 2: Auth and workspace membership
- Phase 3: Projects and work items
- Phase 4: Board/list execution views
- Phase 5: Detail, comments, plan, overview, docs, and project workspace shell
- Phase 6: Live GitHub engineering integration

Next: Phase 8 should shift to reporting, search, and product polish now that execution, engineering status, and in-app notification foundations are in place.
