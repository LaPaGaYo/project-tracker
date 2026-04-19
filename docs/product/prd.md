# PRD: Phase 3 - Projects & Work Items

## Overview

Add workspace-scoped projects, hierarchical work items with human-readable IDs, per-project workflow states, assignees, and activity logging to The Platform.

## Dependencies

- Phase 1: Turborepo monorepo, Drizzle ORM, Postgres, Redis, CI/CD (complete)
- Phase 2: Clerk auth, workspaces, workspace members, invitations, RBAC (complete, PR #4 pending merge)

## Scope

### 3.1 Workspace-scoped Projects

**Schema changes:**
- Add `workspace_id` (uuid, NOT NULL, FK to workspaces) to `projects` table
- Add `key` (varchar(8), NOT NULL) to `projects` for human-readable ID prefix
- Add `item_counter` (integer, default 0) to `projects` for sequential ID generation
- Add unique index on `(workspace_id, key)` - no duplicate keys within a workspace
- Migration handles existing rows by assigning a default workspace

**API:**
- `POST /api/workspaces/:slug/projects` - create project (Owner/Admin/Member)
- `GET /api/workspaces/:slug/projects` - list projects (all authenticated members)
- `GET /api/workspaces/:slug/projects/:key` - get project by key
- `PATCH /api/workspaces/:slug/projects/:key` - update project (Owner/Admin)
- `DELETE /api/workspaces/:slug/projects/:key` - delete project (Owner/Admin only)

**Server actions (Next.js):**
- `createProject(workspaceSlug, data)` - validates membership + role, creates with default workflow states
- `listProjects(workspaceSlug)` - filtered by workspace membership
- `updateProject(workspaceSlug, projectKey, data)`
- `deleteProject(workspaceSlug, projectKey)` - cascades work items

### 3.2 Workflow States

**Schema:**
- New `workflow_states` table: `id`, `project_id` (FK), `name`, `category` (backlog/active/done), `position`, `color`
- Category determines board column grouping and completion semantics
- Default states created on project creation: Backlog (backlog), Todo (active), In Progress (active), Done (done)

**API:**
- `GET /api/workspaces/:slug/projects/:key/states` - list workflow states
- `POST /api/workspaces/:slug/projects/:key/states` - add state (Owner/Admin)
- `PATCH /api/workspaces/:slug/projects/:key/states/:id` - update state
- `DELETE /api/workspaces/:slug/projects/:key/states/:id` - remove state (must reassign items first)

### 3.3 Work Items (evolved tasks)

**Schema changes to `tasks` table:**
- Add `type` enum: epic, task, subtask (default: task)
- Add `parent_id` (uuid, nullable, self-referencing FK) for hierarchy
- Add `assignee_id` (varchar, nullable) referencing workspace member userId
- Add `identifier` (varchar, e.g., "PROJ-42") - generated on create
- Add `priority` enum: urgent, high, medium, low, none (default: none)
- Add `labels` (text[], nullable) for lightweight tagging
- Add `workflow_state_id` (uuid, FK to workflow_states) - replaces `status` enum
- Keep `status` enum temporarily for backward compat, deprecate in Phase 4

**Hierarchy rules:**
- Epic can have children (tasks). Tasks can have children (subtasks). Subtasks cannot have children. Max depth = 3.
- Deleting an epic cascades to child tasks/subtasks.
- Moving a work item to a different project reassigns its identifier.

**API:**
- `POST /api/workspaces/:slug/projects/:key/items` - create work item
- `GET /api/workspaces/:slug/projects/:key/items` - list items (filterable by type, state, assignee)
- `GET /api/workspaces/:slug/projects/:key/items/:identifier` - get by human-readable ID
- `PATCH /api/workspaces/:slug/projects/:key/items/:identifier` - update
- `DELETE /api/workspaces/:slug/projects/:key/items/:identifier` - delete (Owner/Admin, or creator)

### 3.4 Activity Log

**Schema:**
- New `activity_log` table: `id` (uuid), `workspace_id` (FK), `entity_type` (project/work_item/workflow_state), `entity_id` (uuid), `action` (created/updated/deleted/assigned/moved/state_changed), `actor_id` (varchar), `metadata` (jsonb, stores old/new values), `created_at`
- Append-only. No UPDATE or DELETE operations.
- Index on `(entity_type, entity_id, created_at)` for entity feeds
- Index on `(workspace_id, created_at)` for workspace-level feed

**API:**
- `GET /api/workspaces/:slug/projects/:key/activity` - project activity feed
- `GET /api/workspaces/:slug/projects/:key/items/:identifier/activity` - item activity

### 3.5 Basic UI

Phase 3 delivers minimal UI. Rich views (board, timeline, etc.) are Phase 4.

- **Project list page** at `/workspaces/:slug/projects` - table with name, key, item count, last updated
- **Project detail page** at `/workspaces/:slug/projects/:key` - shows work items in a flat list grouped by workflow state
- **Create project dialog** - name, key, description
- **Create work item dialog** - title, type, priority, assignee, parent (optional)
- **Work item detail panel** - inline editing of title, description, status, assignee, priority

## Non-Goals

- Board/Kanban view (Phase 4)
- Drag-and-drop reordering (Phase 4)
- Comments on work items (Phase 5)
- File attachments (Phase 5)
- GitHub PR/branch linking (Phase 6)
- Real-time updates via WebSocket (Phase 7)
- Full-text search (Phase 8)
- Custom work item types
- Sprints / time tracking
- Bulk operations

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| SC1 | Create project in workspace, visible only to that workspace | Contract test |
| SC2 | Work items have human-readable IDs (PROJ-1, PROJ-2, ...) | Contract test |
| SC3 | Work item hierarchy: epic > task > subtask, max depth 3 | Contract test |
| SC4 | Assign work item to workspace member | Contract test |
| SC5 | Move work item through workflow states | Contract test |
| SC6 | Activity log records create/update/delete/assign/move | Contract test |
| SC7 | Viewer role cannot create projects or work items | Contract test |
| SC8 | Cross-tenant isolation: no workspace B data visible to workspace A user | Contract test |
| SC9 | Existing schema migration is non-destructive | Migration test |
| SC10 | Basic UI renders project list and work item list | Manual QA |

## Technical Notes

- All new server code follows the repository/service pattern from Phase 2 (`apps/web/src/server/`)
- Workspace membership checks use the `requireWorkspaceMember()` pattern from Phase 2
- Human-readable ID generation uses `FOR UPDATE` lock on project row to atomically increment counter (same pattern as owner safeguard in Phase 2)
- Activity log writes happen in the same transaction as the mutation they record
