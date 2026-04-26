# PRD: Phase 8 - Readiness Command Center

## Overview

Add a lead-first Readiness Command Center to the project workspace Overview. Phase 8 synthesizes plan progress, work item state, GitHub engineering signals, and notification attention into deterministic readiness reporting, source-linked team actions, scoped readiness search, and readiness-critical polish.

## Scope Sections

### 8.1 Readiness Projection

Readiness must be derived from local project state using deterministic server-side rules.

**Requirements:**
- Add a pure readiness projection for project stage, plan items, work items, GitHub signals, engineering state, and inbox rows.
- Return readiness status as `Ready`, `Ready with risk`, or `Blocked`.
- Return a plain-language narrative explaining the status.
- Return metrics for plan, issues, GitHub, and notifications.
- Return decision cues including ship gate and primary blocker state.
- Return source-linked actions for blockers, review needs, urgent work, high-priority notifications, and incomplete current-stage plan work.

### 8.2 Workspace Integration

The project workspace loader must include readiness data in the Overview view model.

**Requirements:**
- Add readiness data to `ProjectWorkspaceView["overview"]`.
- Use project-scoped notification inbox rows for readiness signals.
- Preserve existing board, list, plan, engineering, docs, and notification shell behavior.
- Keep readiness links stable for project-scoped routes.

### 8.3 Overview Readiness UI

Overview should become the primary Phase 8 decision surface.

**Requirements:**
- Render `Readiness command center`.
- Show readiness status, tone, and narrative prominently.
- Show signal cards for plan, issues, GitHub, and notifications.
- Show decision cues.
- Show deterministic team actions with source labels and links.
- Keep milestone roadmap visible as supporting context.
- Avoid duplicate page-level headings inside the project shell.

### 8.4 Project-Scoped Readiness Search

Project search should support readiness work without introducing global search infrastructure.

**Requirements:**
- Search work items, current-stage plan items, comments, GitHub engineering signals, and notification signals.
- Enforce workspace membership and project scoping.
- Ignore queries shorter than two characters at the service/API level.
- Escape SQL wildcard characters for literal matching.
- Return stable result types, titles, snippets, hrefs, chips, and ranks.
- Deduplicate engineering results deterministically per task.

### 8.5 Search API

Expose readiness search through a project-scoped API route.

**Requirements:**
- Add `GET /api/workspaces/[slug]/projects/[key]/search?q=...`.
- Return 401 when no session exists.
- Return 403 for non-members.
- Return 404 when the project is missing or inaccessible.
- Return an empty result set for short queries.
- Return malformed-body and failed-request errors safely to the UI.

### 8.6 Scoped Search UI

Overview should provide a lightweight readiness search box.

**Requirements:**
- Add an accessible `Readiness search` searchbox.
- Fetch from the project-scoped search API.
- Guard stale responses from replacing newer results.
- Clear stale results when a new valid query starts.
- Show short-query guidance: `Search across blockers, PRs, comments, plan items, and notifications.`
- Show no-result copy: `No readiness signals found for "{query}".`
- Show failure copy: `Search failed. Try again from the project overview.`

### 8.7 Readiness-Critical Polish

Polish is limited to states that affect readiness comprehension.

**Requirements:**
- Show explicit empty action copy when no readiness actions exist.
- Show a no-GitHub-repository engineering setup state: `Connect GitHub to populate engineering readiness signals.`
- Keep linked PR, failing checks, deployment, and issue summary sections intact.
- Keep search short-query, pending, no-result, and error states mutually clear.

### 8.8 Verification

Automated and browser coverage must prove readiness behavior and phase stability.

**Requirements:**
- Readiness projection tests pass.
- Project search service tests pass.
- Search API tests pass.
- Overview and Engineering UI tests pass.
- Full repo verification passes: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Browser smoke check verifies the Overview readiness surface, action links, search states, and engineering setup state.

## Data Model

Phase 8 does not add durable readiness tables. Readiness is a server-side projection over existing project, stage, plan, work item, GitHub, engineering, comment, and notification data.

## Non-Goals

- Global portfolio dashboard
- Analytics warehouse
- AI-generated recommendations
- Full-text infrastructure
- Global command palette
- External reporting or BI integrations

## Exit Criteria

- All success criteria from the Phase 8 decision brief are met.
- Product docs identify Phase 8 as the Readiness Command Center with lead-first Overview reporting, deterministic team actions, scoped readiness search, and readiness-critical polish.
- Phase 8 non-goals remain explicit.
- Targeted tests, full repo verification, and browser smoke check pass.
