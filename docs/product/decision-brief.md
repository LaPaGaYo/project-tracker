# Decision Brief: Phase 8 - Readiness Command Center

## Context

The product direction remains: Jira for execution structure, GitHub for engineering truth, and Notion-like lightness for collaboration.

By the end of Phase 7, the project workspace has execution views, implementation plans, comments, GitHub engineering state, and in-app notifications. Phase 8 turns those surfaces into a lead-first decision layer so project owners and teammates can understand readiness without manually reconciling every tab.

## Key Decisions

### 1. Overview becomes the Readiness Command Center

Overview now leads with readiness status, narrative, signal metrics, decision cues, team actions, scoped search, and milestone context.

**Why:** Project owners need a fast decision surface before drilling into board, plan, engineering, docs, or notifications.

### 2. Readiness stays deterministic and local-first

Readiness is derived by a server-side projection from project stage, plan items, work items, GitHub-derived engineering state, and notification inbox rows.

**Why:** Phase 8 needs explainable team alignment, not opaque recommendations or external analytics infrastructure.

### 3. Team actions are source-linked

Each action points to the project surface that owns the underlying signal: plan, work item, engineering, or notification context.

**Why:** A readiness surface is only useful if teams can immediately resolve the work that caused the signal.

### 4. Search is scoped to readiness work

Project search covers readiness-relevant work items, plan items, comments, GitHub signals, and notifications for the current project and current workspace member.

**Why:** This improves discovery without committing to a global command palette or full-text search platform.

### 5. Polish is limited to readiness-critical states

Phase 8 hardens empty action states, search short-query/no-result/error states, and the no-GitHub-repository engineering setup state.

**Why:** These are the states that directly affect whether the readiness surface can be trusted during real project use.

## Non-Goals

- Global portfolio dashboard
- Analytics warehouse
- AI-generated recommendations
- Full-text infrastructure
- Global command palette
- External reporting, BI, email, Slack, push, or websocket delivery

## RBAC Rules

| Role | Read Project Readiness | Use Project Search | Open Source-Linked Actions | Mutate Readiness Rules |
|------|------------------------|--------------------|----------------------------|------------------------|
| Viewer | Yes | Yes | Yes, for allowed surfaces | No |
| Member | Yes | Yes | Yes, for allowed surfaces | No |
| Admin | Yes | Yes | Yes, for allowed surfaces | No |
| Owner | Yes | Yes | Yes, for allowed surfaces | No |
| Worker/System | Derived writes only | No UI access | No UI access | No |

## Success Criteria

1. Overview identifies Phase 8 as the Readiness Command Center.
2. Readiness status is deterministic and can represent `Ready`, `Ready with risk`, and `Blocked`.
3. Readiness metrics explain plan, issue, GitHub, and notification signals.
4. Decision cues summarize ship gate and primary blocker state.
5. Team actions are deterministic, source-linked, and empty-state aware.
6. Project-scoped readiness search covers work items, plan items, comments, GitHub signals, and notifications.
7. Search enforces workspace/project membership and handles short-query, empty, stale, malformed, and failed responses.
8. Engineering shows a clear setup state when no GitHub repository is connected.
9. Phase 8 product docs keep non-goals explicit.
10. Full repo lint, typecheck, test, build, targeted tests, and browser smoke validation pass.

## Next Phase

After Phase 8 closes, the next work should be selected from validated product gaps rather than extending this phase by default. Strong candidates are:

- merge and PR hardening
- performance and seed-data reliability
- deeper GitHub setup/linking workflows
- portfolio-level views, only after the single-project readiness loop proves useful
