# Decision Brief: Phase 4 - Views

## Executive Summary

Phase 4 adds the visual layer that makes The Platform feel like a real PM tool. Board/kanban view with drag-and-drop, list view with sorting/filtering, and view switching per project. This is where users stop looking at flat lists and start managing work visually.

## Decisions Made

### D1: Board view as primary, list as secondary

Board view (kanban columns per workflow state) is the default project view. List view (sortable table) is the alternative. Users toggle between them with a persisted preference stored in localStorage.

**Why:** Every PM tool leads with a board. It's the fastest way to see work distribution across states. List view is for power users who want density and sorting.

### D2: @dnd-kit for drag-and-drop

Use `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop. It's React-native, accessible, supports keyboard DnD, and handles both cross-container moves (state changes) and within-container reordering (position changes).

**Why:** `react-beautiful-dnd` is unmaintained. `@dnd-kit` is the active standard for React DnD. Smaller bundle, better a11y, works with React 19.

### D3: Optimistic UI updates with server reconciliation

Drag-and-drop updates the UI immediately (optimistic), then sends the API request. If the request fails, revert to the previous state. Activity log entries are created server-side in the same transaction as the state/position change.

**Why:** DnD feels broken with network latency. Optimistic updates make it feel instant. Server reconciliation catches conflicts.

### D4: Filter and sort as URL query params

Filters (type, priority, assignee, state) and sort order are stored in URL query params. This makes filtered views shareable and bookmarkable.

**Why:** URL-based state is the simplest approach. No need for a saved views table in Phase 4. Saved/named views can be added in Phase 8 by persisting the query params.

### D5: Subtasks shown inline under parent in list view, collapsed in board

In list view, subtasks appear indented under their parent task with a collapse toggle. In board view, only top-level items (epics and tasks) appear as cards. Subtask count is shown as a badge on the card.

**Why:** Board cards need to be scannable. Showing every subtask clutters the board. List view has room for hierarchy.

### D6: Empty state columns shown in board

Board columns for workflow states with zero items are still rendered (with a "No items" placeholder). Users can drag items into empty columns.

**Why:** Hiding empty columns is confusing. Users need to see all available states as drop targets.

## Non-Goals (Phase 4)

- **Timeline/Gantt view** - Phase 8 or later. Requires date range UI complexity.
- **Saved/named views** - Phase 8. URL params are sufficient for now.
- **Swimlanes** - Grouping by assignee/priority within the board. Future work.
- **Bulk operations** - Select multiple items and move/assign. Future work.
- **Card preview/hover** - Showing description on hover. Keep cards simple.
- **Custom card fields** - What shows on the card is fixed: identifier, title, type badge, priority, assignee avatar.

## Success Criteria

1. Board view renders columns per workflow state with work item cards
2. Drag card between columns changes workflow state and logs activity
3. Drag card within column reorders position
4. List view shows sortable table with identifier, title, type, priority, assignee, state
5. Filter by type, priority, assignee, state works in both views
6. Sort by created date, priority, identifier works in list view
7. View toggle (board/list) persists preference in localStorage
8. Subtasks shown inline in list view, badge count in board view
9. Empty state columns rendered as valid drop targets
10. Optimistic DnD with server reconciliation on failure
11. Mobile-responsive: board columns stack vertically on small screens
12. Contract tests cover DnD state change, position update, and filter/sort API

## Risk

- **DnD performance with many items** - Mitigated by virtualizing the card list if >100 items per column. Can defer virtualization to Phase 8 if not needed.
- **Optimistic update conflicts** - Two users drag the same item simultaneously. Mitigated by last-write-wins with server timestamp, same as existing activity log pattern.

## Nexus Execution Context

- Run ID: run-2026-04-19T08-27-58-235Z
- Command: frame
- Stage: frame
- Predecessor: docs/product/idea-brief.md
