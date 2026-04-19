# Idea Brief: Phase 3 - Projects & Work Items

## Problem

After Phase 2 (Auth & Workspace), users can sign up, create workspaces, and invite teammates. But there is no way to create projects within a workspace or track work items. The existing `projects` and `tasks` tables from Phase 1 are global (no workspace scoping) and lack basic PM tool features: hierarchy, human-readable IDs, assignees, and activity logging.

## Goals

1. **Workspace-scoped projects** - Every project belongs to a workspace. Cross-tenant isolation enforced at the data layer.
2. **Work item model** - Replace flat tasks with hierarchical work items (epic > task > subtask). Support human-readable IDs like PROJ-42.
3. **Workflow engine** - Configurable status columns per project, not a global enum. Default: Backlog, Todo, In Progress, Done.
4. **Assignees** - Work items can be assigned to workspace members.
5. **Activity log** - Record who did what, when. Required for audit trail and future comment/notification features.

## Constraints

- Must work with existing Clerk auth and workspace RBAC from Phase 2
- Must not break Phase 1 contract tests (can extend, not remove schema)
- Projects table already exists, needs `workspaceId` FK added via migration
- Tasks table already exists, needs to evolve into work items
- All data access must enforce workspace membership check

## Open Questions

- Should workflow states be per-project or per-workspace? (Leaning per-project for flexibility)
- Should human-readable IDs be workspace-scoped (PROJ-42 unique within workspace) or globally unique?
- Should we support custom work item types beyond epic/task/subtask in this phase?

## Nexus Execution Context

- Run ID: run-2026-04-17T00-21-05-864Z
- Command: discover
- Stage: discover -> frame
- Continuation mode: project_reset
- Execution mode: governed_ccb
- Primary provider: codex
- Provider topology: multi_session
