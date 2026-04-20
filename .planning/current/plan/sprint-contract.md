# Sprint Contract: Phase 4 - Views

## Scope Boundary

Phase 4 only. No other phase work.

## Commitments

| Task | Description | Acceptance |
|------|-------------|------------|
| 4.1 | Install @dnd-kit dependencies | Build passes with new deps |
| 4.2 | Position management API (move + state change) | Atomic update, activity logged, FOR UPDATE lock |
| 4.3 | Filter and sort API extensions | Query param filtering and sorting on items endpoint |
| 4.4 | Board/Kanban view with DnD | Columns per state, draggable cards, optimistic updates |
| 4.5 | List view with sortable table | Column header sort, subtask indentation |
| 4.6 | Filter bar component | Type/priority/assignee/state filters via URL params |
| 4.7 | View toggle + page integration | Board/List switch, localStorage persistence |
| 4.8 | Contract tests (10 cases) | All pass against real Postgres |

## Exit Criteria

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (36 total: 26 existing + 10 new)
- [ ] Dev server starts without errors
- [ ] Board view renders with DnD functional
- [ ] List view renders with sorting functional
- [ ] Filters work in both views

## Non-Goals (explicitly excluded)

- Timeline/Gantt view
- Saved/named views
- Swimlanes
- Bulk operations
- Card hover preview
- Custom card fields
- Virtualization

## Dependencies

- Phase 2+3 code on main (merged via PR #5)
- Docker Compose Postgres + Redis for tests
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

## Lessons Applied

- Extensionless imports in server files (CI typecheck compatibility)
- Contract tests use `--import tsx` loader and real Postgres
- Execution readiness packet scoped to Phase 4 only
- Worktree branches from main (has all prior phase code)
