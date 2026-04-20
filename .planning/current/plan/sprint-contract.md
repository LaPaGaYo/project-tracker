# Sprint Contract — Phase 5: Detail & Comments

## Scope Commitment

This sprint delivers work item detail panels with inline editing, markdown descriptions with version history, comments, and a unified activity timeline.

## Bounded Deliverables

| Task | Description | Verification |
|------|-------------|--------------|
| 5.1 | Database schema + migration (comments, description_versions) | Migration SQL exists, tables create successfully |
| 5.2 | Shared types (CommentRecord, DescriptionVersionRecord) | Types exported from packages/shared |
| 5.3 | Comments server module (repository, service, RBAC) | CRUD operations work, RBAC enforced |
| 5.4 | Description versioning in work-items service | Updates save previous version, versions retrievable |
| 5.5 | API routes for comments + description | All endpoints return correct responses |
| 5.6 | Detail panel component suite | Panel renders, fields editable, markdown renders |
| 5.7 | Navigation integration (board + list click) | Clicking items opens panel, URL updates |
| 5.8 | Contract tests | All tests pass in CI |

## Out of Scope (DO NOT implement)

- File/image attachments
- Real-time updates or WebSocket connections
- @mention autocomplete or notification dispatch
- Emoji reactions
- Nested comment threads
- Rich WYSIWYG editor (markdown textarea + preview only)
- Any Phase 6-8 features

## Quality Gates

- `turbo build` passes with no errors
- `turbo lint` passes
- `turbo typecheck` passes
- Contract tests pass against real Postgres
- No regressions in Phase 3/4 tests
- RBAC boundaries verified in tests

## Risk Mitigations

- Merge origin/main into worktree before starting (ensures Phase 1-4 code present)
- Use extensionless imports in packages
- Run drizzle-kit generate for migrations (not hand-written SQL)
- Test with real Postgres (same CI pattern as Phase 3/4)

## Dependencies

New npm packages: `react-markdown`, `remark-gfm`, `diff`
