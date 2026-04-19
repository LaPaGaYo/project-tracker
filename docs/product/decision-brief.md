# Decision Brief: Phase 3 - Projects & Work Items

## Executive Summary

Phase 3 turns The Platform from an authenticated workspace shell into a functional project management tool. Users will create projects within workspaces, track work items with hierarchy and human-readable IDs, assign work to teammates, and see an activity log of changes.

## Decisions Made

### D1: Workspace-scoped projects via FK migration

Add `workspace_id` FK to the existing `projects` table. Existing rows get a default workspace assignment during migration. All project queries filter by workspace membership.

**Why:** Projects without workspace scoping break multi-tenant isolation. Adding the FK is simpler than creating a new table and migrating.

### D2: Work items replace tasks

Rename the concept from "tasks" to "work items" at the application layer. Add fields: `type` (epic/task/subtask), `parentId` (self-referencing FK for hierarchy), `assigneeId` (workspace member), `identifier` (human-readable ID like PROJ-42), `priority`, and `labels`.

**Why:** "Task" is too flat for a PM tool. Hierarchy enables epics with child tasks. The existing `tasks` table schema gets extended, not replaced.

### D3: Per-project workflow states

Create a `workflow_states` table linked to projects. Each project gets default states (Backlog, Todo, In Progress, Done) on creation. States have a position for column ordering.

**Why:** Per-project gives teams flexibility. Linear does this. A global enum (current approach) is too rigid for different project types.

### D4: Human-readable IDs scoped to projects

Each project gets a `key` (e.g., "PROJ", max 8 chars). Work items get sequential numbers within the project: PROJ-1, PROJ-2. The `identifier` is stored as a varchar, and a sequence counter lives on the project row.

**Why:** Project-scoped sequences are simpler than workspace-scoped. Users think in project context ("PROJ-42"), not workspace context.

### D5: Activity log as append-only table

Create an `activity_log` table with: entity type, entity ID, action, actor, diff/payload, timestamp. No updates or deletes on this table. Used for audit trail and feeds future comment/notification phases.

**Why:** Append-only is simple, correct, and feeds downstream features without schema changes.

### D6: RBAC enforcement per workspace role

- Owner/Admin: full CRUD on projects and work items
- Member: create/edit work items, view projects, limited project settings
- Viewer: read-only on everything

**Why:** Consistent with Phase 2 role hierarchy. Viewers should not create work.

## Non-Goals (Phase 3)

- **Custom work item types** - Only epic/task/subtask. Custom types are Phase 5+ complexity.
- **Comments** - Phase 5 (Detail & Comments).
- **GitHub integration** - Phase 6.
- **Real-time updates** - Phase 7.
- **Views (board, list, timeline)** - Phase 4. Phase 3 delivers API and basic list UI only.
- **Drag-and-drop** - Phase 4.
- **File attachments** - Phase 5.
- **Search** - Phase 8.

## Success Criteria

1. Create a project within a workspace and see it scoped to that workspace only
2. Create work items (epic, task, subtask) with hierarchy and human-readable IDs
3. Assign work items to workspace members
4. Move work items through workflow states
5. Activity log records all create/update/delete/assign/move actions
6. Workspace role enforcement: viewer cannot create, member cannot delete projects
7. Cross-tenant isolation: user in workspace A cannot see workspace B projects
8. Contract tests cover all CRUD operations and permission boundaries
9. Migration from existing schema is non-destructive

## Risk

- **Schema migration complexity** - Adding `workspaceId` to existing projects table requires handling existing rows. Mitigated by migration script with default workspace.
- **Performance on activity log** - Append-only tables grow fast. Mitigated by indexing on entity_id + created_at and pagination.

## Nexus Execution Context

- Run ID: run-2026-04-17T00-21-05-864Z
- Command: frame
- Stage: frame
- Predecessor: docs/product/idea-brief.md
