# Execution Readiness Packet: Phase 4 - Views

## Scope Boundary

**This packet covers Phase 4 ONLY.** Do not implement, validate, or reference any other phase. Phases 1-3 are complete and merged to main. Phase 5+ is out of scope.

## Prerequisites (already in codebase on main)

- Workspace-scoped projects with key-based identifiers
- Hierarchical work items (epic/task/subtask) with human-readable IDs
- Per-project workflow states (Backlog, Todo, In Progress, Done)
- Work item assignees, position field, activity log
- RBAC enforcement (Owner/Admin/Member/Viewer)
- All API routes under `/api/workspaces/[slug]/projects/[key]/...`

## Task Breakdown

### Task 4.1: Install @dnd-kit Dependencies

**Files to modify:**
- `apps/web/package.json` - add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

**Acceptance:** Dependencies installed, `npm run build` passes.

### Task 4.2: Position Management API

**Files to modify:**
- `apps/web/src/server/work-items/service.ts` - add `moveWorkItem()` function
- `apps/web/src/server/work-items/repository.ts` - add position+state update query with FOR UPDATE lock
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/position/route.ts` - PATCH endpoint

**Key behaviors:**
- `moveWorkItem(workspaceId, projectKey, identifier, userId, { position, workflowStateId })` - validates membership (Member+), updates position and optionally workflow state in single transaction, logs activity
- If `workflowStateId` changes: log `state_changed` activity with old/new state in metadata
- If only position changes: log `moved` activity
- Uses FOR UPDATE lock on the work item row during update

**API:**
- `PATCH /api/workspaces/[slug]/projects/[key]/items/[identifier]/position`
- Body: `{ position: number, workflowStateId?: string }`
- Returns: updated work item
- Auth: Member+ required

**Acceptance:** Position and state updates work atomically. Activity logged correctly.

### Task 4.3: Filter and Sort API Extensions

**Files to modify:**
- `apps/web/src/server/work-items/repository.ts` - extend `listWorkItems` to accept filter/sort params
- `apps/web/src/server/work-items/types.ts` - add `WorkItemFilters`, `WorkItemSort` types
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/route.ts` - parse query params for filters/sort

**Filter params:**
- `?type=task,epic` - filter by work item type (comma-separated)
- `?priority=high,urgent` - filter by priority
- `?assignee=user_123` - filter by assignee ID
- `?state=state_uuid` - filter by workflow state ID

**Sort params:**
- `?sort=priority&order=desc` - sort by field, asc or desc
- Sortable fields: `identifier`, `priority`, `created_at`
- Default: `position` asc (manual ordering)

**Acceptance:** Filters and sorts return correct results. Multiple filter values work.

### Task 4.4: Board/Kanban View Component

**Files to create:**
- `apps/web/src/components/board-view.tsx` - main board with DnD context
- `apps/web/src/components/board-column.tsx` - single column (droppable)
- `apps/web/src/components/work-item-card.tsx` - draggable card

**Board layout:**
- Horizontal scrollable container with one column per workflow state
- Columns ordered by workflow state `position`
- Cards show: identifier badge (e.g., "PROJ-42"), title, type icon (epic/task), priority dot, assignee initial circle
- Subtask count badge if item has children
- Empty columns show "No items" placeholder, still accept drops

**DnD behavior (`@dnd-kit`):**
- `DndContext` wraps the board
- Each column is a `useDroppable` container
- Each card is `useSortable` (handles both cross-column and within-column)
- `onDragEnd`: call position API with new position and optionally new workflowStateId
- Optimistic: update local state immediately, revert on API error
- Visual feedback: dragged card shows shadow, drop target highlights

**Acceptance:** Board renders columns, cards are draggable, state changes work.

### Task 4.5: List View Component

**Files to create:**
- `apps/web/src/components/list-view.tsx` - sortable table
- `apps/web/src/components/list-row.tsx` - single work item row

**Table columns:** Identifier, Title, Type (badge), Priority (dot + label), Assignee, State, Created
- Click column header to sort (toggles asc/desc)
- Subtasks shown indented under parent with collapse/expand toggle
- Sort state stored in URL query params via `useSearchParams`

**Acceptance:** Table renders, column headers sort, subtasks indent.

### Task 4.6: Filter Bar Component

**Files to create:**
- `apps/web/src/components/filter-bar.tsx` - filter controls

**Filters:**
- Type dropdown: Epic, Task, Subtask (multi-select)
- Priority dropdown: Urgent, High, Medium, Low, None (multi-select)
- Assignee dropdown: workspace members list (single select)
- State dropdown: workflow states for this project (multi-select)
- "Clear filters" button
- Active filter count badge

**State management:**
- Filters stored as URL query params via `useSearchParams` + `useRouter`
- Changing a filter updates the URL, which triggers a data refetch
- Filter bar renders above both board and list views

**Acceptance:** Filters update URL params and filter the displayed items.

### Task 4.7: View Toggle and Project Detail Page Update

**Files to modify:**
- `apps/web/src/app/workspaces/[slug]/projects/[key]/page.tsx` - integrate board/list/filter/toggle
- `apps/web/src/components/view-toggle.tsx` - Board | List segmented control

**View toggle:**
- Two-option segmented control: Board (default) | List
- Preference stored in `localStorage` key: `view-pref-{projectKey}`
- On load, read preference and render the selected view
- Switching views preserves active filters

**Page integration:**
- Project detail page renders: project header, filter bar, view toggle, then board OR list view
- Data fetching: server component fetches work items with filters from URL params, passes to client view components

**Acceptance:** Toggle switches views, preference persists across page loads.

### Task 4.8: Contract Tests

**File to create:**
- `tests/phase4-views.test.mjs`

**Test cases:**
1. Position update API changes item position
2. Position update with state change updates both fields and logs `state_changed`
3. Within-column reorder logs `moved` activity
4. Filter by type returns only matching items
5. Filter by priority returns only matching items
6. Filter by assignee returns only matching items
7. Filter by multiple types (comma-separated) returns union
8. Sort by priority returns correct order
9. Sort by created date returns correct order
10. Viewer role cannot update position (403)

**Acceptance:** All 10 tests pass against real Drizzle/Postgres.

## Execution Order

1. Task 4.1 (Dependencies) - needed by UI components
2. Task 4.2 (Position API) - backend for DnD
3. Task 4.3 (Filter/Sort API) - backend for filter bar and list sort
4. Task 4.8 (Contract Tests) - write tests alongside API tasks
5. Task 4.4 (Board View) - depends on position API
6. Task 4.5 (List View) - depends on filter/sort API
7. Task 4.6 (Filter Bar) - used by both views
8. Task 4.7 (View Toggle + Page) - integrates everything

## Build Verification

After implementation, verify:
- `npm run build` passes
- `npm run lint` passes
- `npm run test` passes (including 10 new Phase 4 contract tests + existing 26)
- Dev server starts and board view renders
- DnD works in browser (manual QA)

## Important Notes

- Use extensionless imports in all server files (CI compatibility lesson from Phase 3)
- Contract tests must use `--import tsx` loader (added to test:contracts in Phase 3)
- All tests must hit real Drizzle/Postgres, not in-memory fakes (lesson from Phase 3)
- Board view is a client component ("use client"), filter bar is a client component, list view can mix server/client
- The Phase 4 worktree branches from main which now has Phase 2+3 code (merged via PR #5)
