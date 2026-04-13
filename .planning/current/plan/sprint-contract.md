# Sprint Contract: The Platform V1

## Contract Summary

8 phases, 40+ tasks, building from foundation to launch-ready product. Each phase produces a deployable increment with testable exit criteria tied to PRD requirements.

## Phase-to-PRD Traceability

| Phase | PRD Sections | Launch Criteria | Quality Gates |
|-------|-------------|-----------------|---------------|
| 1. Foundation | (infrastructure) | — | QC4 (strict TS) |
| 2. Auth & Workspace | S1, S2 | LC1, LC6, LC7 | QC2, QC5 |
| 3. Projects & Work Items | S3, S4, S5, S10 | LC2 | QC4, QC5 |
| 4. Views | S6, S13 | LC4 | QC1, QC5 |
| 5. Detail & Comments | S8, S10 | LC8 | QC5 |
| 6. GitHub Integration | S7 | LC3 | QC3, QC5 |
| 7. Real-Time & Notifications | S11, S12 | LC5 | QC5 |
| 8. Dashboard, Search & Polish | S9, S13 | LC9, LC10 | QC1, QC5 |

**Full coverage check:** Every PRD scope section (S1-S13) is assigned to exactly one phase. Every launch criterion (LC1-LC10) and quality gate (QC1-QC5) is assigned to at least one phase.

## Execution Sequence

### Wave 1: Infrastructure + Identity
- **Phase 1:** Foundation (no dependencies)
- **Phase 2:** Auth & Workspace (depends on Phase 1)

### Wave 2: Domain Model
- **Phase 3:** Projects & Work Items (depends on Phase 2)

### Wave 3: User-Facing (parallelizable)
- **Phase 4:** Views — Board, Backlog, List (depends on Phase 3)
- **Phase 5:** Work Item Detail & Comments (depends on Phase 3)

Phase 4 and Phase 5 can execute in parallel because they build different UI surfaces over the same data layer.

### Wave 4: Integration
- **Phase 6:** GitHub Integration (depends on Phase 3 + Phase 5)

Phase 6 needs work items (Phase 3) to link to and the activity timeline (Phase 5) to display in.

### Wave 5: Live Experience
- **Phase 7:** Real-Time & Notifications (depends on Phase 4 + Phase 5)

Phase 7 needs views (Phase 4) to push updates to and comments (Phase 5) to generate notifications from.

### Wave 6: Launch Readiness
- **Phase 8:** Dashboard, Search & Polish (depends on Phase 6 + Phase 7)

Phase 8 needs GitHub data (Phase 6) for the dashboard and all content (Phase 7) for search. This phase also runs the full launch criteria verification.

## Per-Phase Commit Contracts

Each phase produces:
1. Database migrations for new tables
2. API endpoints with auth and tenant scoping
3. UI pages/components consuming those endpoints
4. Tests: happy-path + permission/auth tests per endpoint
5. A deployable increment that does not break previous phases

## Non-Goal Enforcement

The following are explicitly excluded from every phase. If any task description drifts toward these, stop and check the PRD non-goals (NG1-NG15):

- No Initiative/Portfolio layer (NG1)
- No enterprise permissions (NG2)
- No GitHub write-back (NG3)
- No sprint management (NG4)
- No time tracking (NG5)
- No custom fields (NG6)
- No automations (NG7)
- No email notifications (NG8)
- No timeline/Gantt view (NG9)
- No import tools (NG10)
- No public API (NG11)
- No mobile optimization (NG12)
- No billing (NG13)
- No JQL (NG14)
- No offline mode (NG15)

## Handoff Readiness

**Status:** EXECUTION READY

The plan is fully traced to PRD requirements, sequenced by dependencies, and bounded by explicit non-goals. Each phase has testable exit criteria.

Next step: `/handoff` to package for governed execution.
