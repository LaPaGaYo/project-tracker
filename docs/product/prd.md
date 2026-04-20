# PRD: Phase 4 - Views

## Overview

Add board/kanban view, list view, drag-and-drop, filtering, sorting, and view switching to The Platform's project detail page.

## Dependencies

- Phase 3: Projects, work items, workflow states, activity log (complete)
- Phase 2: Auth, workspaces, RBAC (complete)

## Scope

### 4.1 Board/Kanban View

**Component:** `apps/web/src/components/board-view.tsx`

- Render one column per workflow state, ordered by `position`
- Each column shows work item cards (epics and tasks only, not subtasks)
- Cards show: identifier badge, title, type icon, priority indicator, assignee avatar
- Subtask count badge on cards that have children
- Empty columns render with "No items" placeholder and valid drop target
- Column headers show state name and item count

**Drag-and-drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- Cross-column drag: changes `workflow_state_id`, logs `state_changed` activity
- Within-column drag: updates `position`, logs `moved` activity
- Optimistic UI update, revert on API failure
- Keyboard accessible (Enter to pick up, Arrow keys to move, Enter to drop)

### 4.2 List View

**Component:** `apps/web/src/components/list-view.tsx`

- Sortable table with columns: identifier, title, type, priority, assignee, state, created
- Click column header to sort (asc/desc toggle)
- Subtasks shown indented under parent with collapse toggle
- Row click navigates to work item detail (inline panel or future detail page)

### 4.3 View Switching

**Component:** `apps/web/src/components/view-toggle.tsx`

- Toggle between Board and List views
- Preference stored in `localStorage` key: `view-preference-{projectKey}`
- Default: Board view
- Toggle renders as segmented control (Board | List)

### 4.4 Filtering

**Component:** `apps/web/src/components/filter-bar.tsx`

- Filter controls above the view area
- Filters: type (epic/task/subtask), priority (urgent/high/medium/low/none), assignee (dropdown of workspace members), state (workflow states)
- Filters stored as URL query params: `?type=task&priority=high&assignee=user_123`
- Multiple values per filter: `?type=task,epic`
- Clear all filters button
- Active filter count badge

**API support:**
- `GET /api/workspaces/[slug]/projects/[key]/items?type=task&priority=high&assignee=user_123&state=state_id`
- Extend existing work items list endpoint with query param filtering

### 4.5 Sorting (List View)

- Sort params in URL: `?sort=priority&order=desc`
- Sortable columns: identifier, priority, created date
- Default sort: position (manual ordering)
- API support: extend items endpoint with `sort` and `order` params

### 4.6 Position Management API

**New/modified endpoints:**
- `PATCH /api/workspaces/[slug]/projects/[key]/items/[identifier]/position` - update position and optionally workflow state
  - Body: `{ position: number, workflowStateId?: string }`
  - Atomically updates position, optionally changes state
  - Logs activity entry in same transaction
  - Returns updated item

**Server action:**
- `moveWorkItem(workspaceSlug, projectKey, identifier, { position, workflowStateId })` - validates membership (Member+), updates in transaction

### 4.7 Contract Tests

**File:** `tests/phase4-views.test.mjs`

Test cases:
1. Position update API changes item position
2. Position update with state change updates both fields
3. Activity log records state_changed on cross-column move
4. Activity log records moved on within-column reorder
5. Filter by type returns only matching items
6. Filter by priority returns only matching items
7. Filter by assignee returns only matching items
8. Sort by priority returns items in correct order
9. Sort by created date returns items in correct order
10. Viewer role can read items but cannot update position (403)

## Non-Goals

- Timeline/Gantt view
- Saved/named views
- Swimlanes (group by assignee/priority)
- Bulk operations (select multiple, batch move)
- Card hover preview
- Custom card fields
- Virtualization (defer unless >100 items per column)

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| SC1 | Board renders columns per workflow state | Manual QA |
| SC2 | Drag between columns changes state + logs activity | Contract test |
| SC3 | Drag within column reorders position | Contract test |
| SC4 | List view with sortable columns | Manual QA |
| SC5 | Filter by type/priority/assignee/state | Contract test |
| SC6 | Sort by priority/created/identifier | Contract test |
| SC7 | View toggle persists in localStorage | Manual QA |
| SC8 | Subtask badge on board cards, inline in list | Manual QA |
| SC9 | Empty columns as valid drop targets | Manual QA |
| SC10 | Optimistic DnD reverts on failure | Manual QA |
| SC11 | Mobile responsive board | Manual QA |
| SC12 | 10 contract tests pass | Contract test |

## Technical Notes

- `@dnd-kit/core` and `@dnd-kit/sortable` added to `apps/web/package.json`
- Position updates use the same `FOR UPDATE` transaction pattern from Phase 3
- Filter/sort params parsed from `useSearchParams()` in client components
- Board view is a client component (needs DnD interactivity), list view can be server component with client sort headers
- Activity log writes happen in the position update transaction
