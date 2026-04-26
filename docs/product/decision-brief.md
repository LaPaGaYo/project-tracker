# Decision Brief: Phase 7 - Notifications and Collaboration Foundation

## Context

Phase 6 made GitHub engineering status durable and visible in the project workspace. Phase 7 adds the attention layer: users should know when comments, mentions, assignments, workflow changes, and GitHub engineering events need their response.

The product direction remains: Jira for execution structure, GitHub for engineering truth, and Notion-like lightness for collaboration.

## Key Decisions

### 1. Durable notification events plus recipient rows

Notification events describe the source change. Recipient rows describe each user's delivery/read state.

**Why:** A single event can fan out to multiple users, and each user needs independent read state, preferences, and repair semantics.

### 2. Domain services emit notifications after successful mutations

Comment, work item, and GitHub services call the notification service after their primary write succeeds.

**Why:** Notification creation should be layered onto existing behavior without changing response shapes or ownership of domain writes.

### 3. Local in-app inbox before external delivery

The project shell contains the first notification surface: bell, unread count, inbox panel, mark-read controls, and preferences.

**Why:** The product needs an internal attention loop before adding email, Slack, push, or digest channels.

### 4. Workspace-level coarse preferences

Users can toggle comments, mentions, assignments, GitHub engineering changes, and state changes.

**Why:** This gives immediate noise control without prematurely designing per-project or per-issue preference complexity.

### 5. Self-notification and preference filtering in one service

The notification service suppresses actor self-notifications, filters invalid workspace members, applies preferences, and inserts recipient rows idempotently.

**Why:** Centralizing these rules avoids drift between comment, work item, GitHub, API, and worker paths.

### 6. Worker-backed notification repair

The worker has a `repair-notifications` mode for missing recipients and an explicitly enabled recent-activity backfill path.

**Why:** Webhooks, request handlers, and deployments can fail. Repair must be safe to re-run and auditable from worker output.

## Non-Goals

- Email, Slack, push, SMS, or mobile delivery
- Real-time websocket transport
- Cross-workspace global notification center
- Per-project or per-issue preferences
- Manual ambiguous GitHub link management
- Reporting/search dashboards

## RBAC Rules

| Role | Read Own Inbox | Mark Own Notifications Read | Update Own Preferences | Receive Notifications | Repair Recipients |
|------|----------------|-----------------------------|------------------------|-----------------------|-------------------|
| Viewer | Yes | Yes | Yes | Yes | No |
| Member | Yes | Yes | Yes | Yes | No |
| Admin | Yes | Yes | Yes | Yes | No |
| Owner | Yes | Yes | Yes | Yes | No |
| Worker/System | No UI access | No | No | Derived writes only | Yes |

## Success Criteria

1. Notification source, event, priority, recipient reason, record, and inbox contracts are shared.
2. Durable notification tables exist with event uniqueness, recipient uniqueness, preferences, and inbox indexes.
3. Comment creation notifies valid mentions and relevant participants without notifying the actor.
4. Work item assignment, state change, and urgent-priority updates notify the right users.
5. GitHub PR/check/deploy changes and webhook failures create relevant notifications and remain replay-safe.
6. Notification API routes enforce workspace membership and current-user recipient scoping.
7. The project shell renders a compact unread badge and inbox panel.
8. Users can mark one notification read, mark all read, and update coarse preferences.
9. Worker repair can rebuild missing notification recipients and explicitly backfill recent activity safely.
10. Full repo lint, typecheck, test, and build pass.

## Next Phase

Phase 8 should focus on product readiness and discovery surfaces:

- reporting and portfolio-level summaries
- search across work items, docs, comments, and engineering signals
- manual polish for GitHub linking and project operations
- UX hardening for empty states, loading states, and navigation edges
- performance and build/deployment readiness
