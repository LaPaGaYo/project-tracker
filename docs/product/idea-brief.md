# Idea Brief: Phase 4 - Views

## Problem

After Phase 3, users can create projects and work items with hierarchy, human-readable IDs, and workflow states. But the UI is minimal: a flat list grouped by state. There's no board/kanban view, no drag-and-drop, no filtering, and no way to switch between view modes. Every PM tool lives or dies by its views.

## Goals

1. **Board/Kanban view** - Columns per workflow state, cards for work items, drag-and-drop between columns to change state
2. **List view** - Sortable table with columns for identifier, title, type, priority, assignee, state. Click to expand details inline.
3. **View switching** - Toggle between Board and List views per project. Persist the user's preference.
4. **Drag-and-drop** - Move cards between columns (state change), reorder within columns (position change). Must update both UI and database atomically.
5. **Filtering and sorting** - Filter work items by type, priority, assignee, state. Sort by created date, priority, identifier.

## Constraints

- Must work with Phase 3's existing workflow states, work items, and activity log
- Drag-and-drop state changes must log activity entries
- Board view needs to handle empty states gracefully (no items in a column)
- Must not break existing Phase 3 contract tests (26 passing)
- Mobile-responsive: board should stack columns vertically on small screens

## Open Questions

- Should we support saved/named views (e.g., "My Items", "High Priority")? Leaning no for Phase 4, defer to Phase 8.
- Should the board show subtasks inline under their parent task? Or keep them flat?
- Should we add a timeline/gantt view in this phase? Leaning no, keep it to board + list.

## Nexus Execution Context

- Run ID: run-2026-04-19T08-27-58-235Z
- Command: discover
- Stage: discover -> frame
- Continuation mode: phase (from Phase 3 closeout)
- Execution mode: governed_ccb
- Primary provider: codex
- Provider topology: multi_session
