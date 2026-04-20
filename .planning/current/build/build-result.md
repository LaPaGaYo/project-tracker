# Build Result — Phase 5 Fix Cycle

## Route Provenance

- Requested route: codex-via-ccb
- Actual route: codex-via-ccb
- Receipt: ccb-build-codex-2026-04-20T14-47-05.919Z
- Execution workspace: /Users/henry/Documents/project-tracker/.nexus-worktrees/run-2026-04-20T13-45-58-613Z
- Workspace branch: codex/run-2026-04-20T13-45-58-613Z

## Review Scope

Mode: bounded_fix_cycle (from review)

### Blocking Items Addressed

1. **Panel close navigation (FIXED):** Added `detail-panel-navigation.ts` helper, updated `view-toggle.tsx` to record project-view origin before navigation, updated `detail-panel.tsx` so Escape/backdrop/Close use `history.back()` when opened from project view, falls back to `router.replace(...)` for direct URL navigation.

2. **Build verification evidence (FIXED):** This artifact now contains the quality gate results required by sprint-contract.md:30-37.

## Quality Gate Verification

| Gate | Result |
|------|--------|
| `npm run typecheck` | passed |
| `npm run lint` | passed |
| `npm run build` | passed (non-blocking Next.js workspace-root and Node deprecation warnings only) |
| `npm run test:contracts` | passed (45 tests, 0 failures) |
| `node --import tsx --test tests/phase5-detail-panel-navigation.test.mjs` | passed (2/2) |

### Test Coverage

- Phase 3 contract tests: passing
- Phase 4 contract tests: passing
- Phase 5 contract tests: passing
- Phase 5 navigation regression tests: passing (2/2)
- Total: 45 tests, 0 failures

## Files Changed (fix cycle)

- `apps/web/src/components/detail-panel.tsx` — Close handlers use history-back
- `apps/web/src/components/detail-panel-navigation.ts` — New navigation helper
- `apps/web/src/components/view-toggle.tsx` — Records project-view origin
- `tests/phase5-detail-panel-navigation.test.mjs` — New regression test (2 tests)
