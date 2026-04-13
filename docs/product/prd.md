# PRD: The Platform V1

## Product Statement

A GitHub-native project execution platform for software teams that have outgrown GitHub Projects but don't want the weight of Jira. V1 proves that a small engineering team can run daily project execution here instead of across GitHub Projects + spreadsheets + Slack + partial Jira.

---

## Scope

### S1. Workspace and Tenancy

**S1.1** Users can create a workspace. A workspace is the top-level tenant boundary.
**S1.2** Workspace owners can invite members by email.
**S1.3** Each workspace has isolated data. No cross-workspace data leakage.
**S1.4** Users can belong to multiple workspaces.
**S1.5** Workspace settings: name, slug, default project settings.

### S2. Authentication and Roles

**S2.1** Sign up / sign in via Clerk (email + OAuth providers).
**S2.2** Session management via Clerk. Auth abstraction layer wraps Clerk so provider is swappable.
**S2.3** Four workspace roles: Owner, Admin, Member, Viewer.
**S2.4** Three project-level access levels: Project Owner, Collaborator, Repository Link Admin.
**S2.5** Role checks enforced at API layer on every request. No client-side-only auth.
**S2.6** Viewers have read-only access. Members can create/edit work items. Admins manage projects and members. Owners manage workspace settings and billing.

### S3. Projects

**S3.1** Workspaces contain multiple projects.
**S3.2** Each project has a name, description, key (short prefix for work item IDs), and status.
**S3.3** Project statuses: Active, Paused, Archived.
**S3.4** Projects can be linked to one or more GitHub repositories (see S7).
**S3.5** Projects have configurable workflow definitions (see S5).

### S4. Work Items

**S4.1** Four work item types: Epic, Task, Subtask, Bug.
**S4.2** Work item fields: title, description (rich text), type, status, assignee, priority, labels, due date, parent (for hierarchy), position (for ordering).
**S4.3** Hierarchy: Epics contain Tasks/Bugs. Tasks contain Subtasks. Subtasks have no children. Bugs can exist at Epic level or standalone.
**S4.4** Each work item gets a human-readable ID: `{project-key}-{sequence}` (e.g., PLAT-42).
**S4.5** Priority levels: Critical, High, Medium, Low, None.
**S4.6** Labels are project-scoped, user-created, color-coded.
**S4.7** Work items support single assignee (V1). Multi-assignee deferred.

### S5. Workflow Engine

**S5.1** Each project defines a set of statuses grouped into three categories: To Do, In Progress, Done.
**S5.2** Default workflow: Backlog > To Do > In Progress > In Review > Done.
**S5.3** Project admins can add, rename, reorder, and remove custom statuses within the three categories.
**S5.4** Transitions: any status can move to any other status in V1 (no transition restrictions yet).
**S5.5** When a work item moves to a Done-category status, record completedAt timestamp.
**S5.6** Status changes are logged in the activity history.

### S6. Views

**S6.1 Board View:** Kanban columns grouped by status. Drag-and-drop to change status and reorder. Swimlanes optional (by assignee, priority, or epic).
**S6.2 Backlog View:** Flat or grouped list of all work items not in a Done status. Drag-to-reorder. Inline editing of key fields.
**S6.3 List View:** Tabular view of all work items with sortable/filterable columns. Bulk actions (assign, change status, change priority).
**S6.4** All three views reflect the same underlying data. A status change on the board is immediately visible in list and backlog.
**S6.5** Saved filters: users can save filter combinations (status, assignee, label, type, priority) and share them within the project.

### S7. GitHub Integration

**S7.1** Workspace-level GitHub App installation. One installation per workspace.
**S7.2** Project-level repository linking. A project can link to multiple repos. A repo can link to multiple projects.
**S7.3** Webhook ingestion for: pull_request (opened, closed, merged, review_requested, review_submitted), push (commits), check_suite / check_run (CI status).
**S7.4** Automatic work item linking via:
  - Branch name pattern: `{project-key}-{number}` (e.g., `PLAT-42-fix-login`)
  - PR title/body references: `PLAT-42` or `[PLAT-42]`
  - Commit message references: `PLAT-42`
  - Manual linking from work item detail
**S7.5** Linked GitHub activity appears in the work item's activity timeline: PR opened, commits pushed, reviews submitted, CI passed/failed, PR merged.
**S7.6** Work item detail shows linked PRs with current status (open, merged, closed), review state, and CI status.
**S7.7** Project dashboard shows: open PRs across linked repos, failing CI, PRs awaiting review.

### S8. Work Item Detail Page

**S8.1** Full detail view with all fields editable inline.
**S8.2** Rich text description editor (Markdown-based).
**S8.3** Activity timeline: all field changes, comments, and linked GitHub events in chronological order.
**S8.4** Comments: threaded comments with Markdown support. @mention team members.
**S8.5** Child items list (for Epics showing Tasks, for Tasks showing Subtasks).
**S8.6** Linked GitHub activity panel (PRs, commits, CI status).
**S8.7** Sidebar: assignee, status, priority, labels, due date, parent item, created/updated timestamps.

### S9. Dashboard

**S9.1** Project-level dashboard with: work item counts by status, items completed this week, overdue items, open PRs, failing CI, blocked items.
**S9.2** Dashboard is read-only, computed from live data.
**S9.3** No custom dashboard builder in V1. Fixed layout with the metrics above.

### S10. Activity and Audit

**S10.1** Every create, update, delete, status change, comment, and GitHub event is logged with: actor, timestamp, entity, action, before/after values.
**S10.2** Activity is viewable per work item (S8.3) and per project (activity feed).
**S10.3** Activity records are immutable. No editing or deletion of audit trail.

### S11. Notifications

**S11.1** In-app notification center: unread count badge, notification list, mark as read.
**S11.2** Notify on: assigned to you, mentioned in comment, status change on your items, PR activity on your items.
**S11.3** Email notifications deferred to V1.1. In-app only for V1.

### S12. Real-Time Updates

**S12.1** Board, backlog, and list views update in real-time via SSE when another user changes data.
**S12.2** Work item detail page updates in real-time (new comments, status changes, GitHub events).
**S12.3** Notification count updates in real-time.
**S12.4** Optimistic UI for the acting user's own changes.

### S13. Search and Filtering

**S13.1** Global search across work items within a project: title, description, ID, assignee, labels.
**S13.2** Structured filters: by type, status, assignee, priority, label, due date range, parent.
**S13.3** Filters combinable with AND logic.
**S13.4** Saved filters per project, shareable with team.
**S13.5** Powered by Postgres full-text search + trigram indexes.

---

## Non-Goals (V1)

These are explicitly out of scope. Not deferred decisions, but conscious exclusions.

**NG1. Full portfolio hierarchy.** No Initiative or Portfolio layer above Epic. V1 tests daily execution, not strategic planning.

**NG2. Enterprise permission schemes.** No custom permission matrices, field-level permissions, or per-status transition restrictions. Simple roles, strong defaults.

**NG3. Bidirectional GitHub sync.** No creating GitHub issues from work items, no write-back to GitHub state, no conflict resolution between systems.

**NG4. Sprint management.** No sprint planning, sprint boards, velocity tracking, or burndown charts. Teams use the backlog and board directly.

**NG5. Time tracking.** No time logging, time estimates at the item level, or timesheet reporting.

**NG6. Custom fields.** No user-defined fields on work items. Fixed schema with labels as the extensibility mechanism.

**NG7. Automations.** No rule-based automations (e.g., "when PR merged, move to Done"). Status changes from GitHub events are manual or via explicit linking, not automatic.

**NG8. Email notifications.** In-app only for V1. Email in V1.1.

**NG9. Timeline/Gantt view.** Board, backlog, and list only. Timeline view deferred.

**NG10. Import from Jira/Linear/other.** No data migration tooling in V1.

**NG11. API for external consumers.** The API serves the web app only. No public API, no API keys, no third-party integrations beyond GitHub.

**NG12. Mobile app or responsive mobile views.** Desktop-first. Responsive enough to not break on tablets, but not optimized for phone.

**NG13. Billing and subscription management.** No payment processing, plan tiers, or usage metering in V1. Single free tier or invite-only.

**NG14. JQL-like query language.** Saved filters with structured UI, not a text-based query language.

**NG15. Offline mode.** Requires active connection. No offline-first or sync-on-reconnect.

---

## Success Criteria

### Launch Gate (must pass before V1 ships)

**LC1.** A new user can sign up, create a workspace, invite a teammate, and both see the workspace within 3 minutes.

**LC2.** A user can create a project, add 10+ work items across Epic/Task/Subtask/Bug types, and manage them on the board with drag-and-drop.

**LC3.** A user can link a GitHub repo to a project, and within 60 seconds of a PR being opened with a work item reference in the branch name, the PR appears in the work item's activity timeline.

**LC4.** Board, backlog, and list views all reflect the same data. A status change made on the board is visible in list view without refresh.

**LC5.** Two users in the same workspace can see each other's changes in real-time on the board (via SSE). No manual refresh required.

**LC6.** Viewer role cannot create or edit work items. Member role cannot manage workspace settings. Role enforcement is server-side.

**LC7.** No cross-workspace data leakage. A user in Workspace A cannot access Workspace B's projects, work items, or GitHub data through any API endpoint.

**LC8.** Work item detail page shows full activity history: field changes, comments, and linked GitHub events in chronological order.

**LC9.** Project dashboard shows accurate counts for: items by status, overdue items, open PRs, failing CI.

**LC10.** Global search returns relevant work items by title, description, and ID within 500ms for a project with 1,000 items.

### Quality Gate

**QC1.** Board view renders and becomes interactive within 2 seconds for a project with 200 work items.

**QC2.** All API endpoints validate tenant scoping. Integration tests cover cross-tenant access attempts.

**QC3.** GitHub webhook processing survives receiver downtime: events are queued durably and processed on recovery.

**QC4.** Zero TypeScript `any` types in the domain layer. Strict mode enabled across the codebase.

**QC5.** Test coverage: all API endpoints have at least one happy-path and one auth/permission test.

---

## Technical Boundaries

### Data Model (core entities)
- **Workspace:** id, name, slug, created_at
- **WorkspaceMember:** workspace_id, user_id, role, invited_at, joined_at
- **Project:** id, workspace_id, name, key, description, status, created_at
- **WorkflowStatus:** id, project_id, name, category (todo/in_progress/done), position
- **WorkItem:** id, project_id, workspace_id, type, title, description, status_id, assignee_id, priority, parent_id, position, due_date, completed_at, created_at, updated_at
- **Label:** id, project_id, name, color
- **WorkItemLabel:** work_item_id, label_id
- **Comment:** id, work_item_id, author_id, body, created_at, updated_at
- **Activity:** id, workspace_id, entity_type, entity_id, actor_id, action, before, after, timestamp
- **GitHubInstallation:** id, workspace_id, installation_id, account_login, installed_at
- **GitHubRepoLink:** id, project_id, installation_id, repo_full_name, linked_at
- **GitHubEvent:** id, repo_link_id, work_item_id, event_type, payload, github_created_at, ingested_at
- **Notification:** id, user_id, workspace_id, type, entity_type, entity_id, read, created_at
- **SavedFilter:** id, project_id, created_by, name, filter_config, shared, created_at

### API Shape
- REST API (Next.js API routes / Route Handlers)
- All endpoints scoped by workspace: `/api/workspaces/{id}/projects/...`
- Auth via Clerk middleware, tenant scoping via middleware that injects workspace context
- Pagination via cursor-based pagination for lists
- SSE endpoint per workspace for real-time updates

### Worker Shape
- Queue consumer for GitHub webhook events
- Processes: PR events, commit events, CI events, installation events
- Writes to GitHubEvent table and links to work items
- Publishes SSE notifications on successful processing

---

## Dependency Map

```
Clerk (auth) ──> Workspace/Member ──> Projects ──> Work Items
                                          │              │
                                          ▼              ▼
                                   GitHub Repo Link   Comments
                                          │           Activity
                                          ▼           Notifications
                                   GitHub Events ──> Work Item Timeline
                                          │
                                   Queue/Workers
```

Build order should follow this dependency chain. Auth and workspace first, then projects and work items, then views, then GitHub integration, then real-time and notifications.

---

## Frame Status

**COMPLETE.** Scope defined (S1-S13), non-goals explicit (NG1-NG15), success criteria testable (LC1-LC10, QC1-QC5). Ready to advance to `/plan`.
