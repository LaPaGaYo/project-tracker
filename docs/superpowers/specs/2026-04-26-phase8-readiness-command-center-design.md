# Phase 8 Readiness Command Center Design

## Product Intent

Phase 8 turns the project workspace from a set of working surfaces into a decision surface.

The product already has Jira-like execution, implementation planning, GitHub engineering status, lightweight docs/comments, and in-app notifications. The remaining product gap is synthesis: a project lead should be able to open Overview and quickly understand whether the project is ready to move forward, what risk blocks it, and which concrete actions the team should take next.

## Audience

Phase 8 serves two audiences in one surface:

- **Lead / reporting view:** The first screen answers "Is this project ready, risky, or blocked?"
- **Team execution view:** The lower screen answers "What should we do next?"

The lead view gets priority in the Overview first screen. Team actionability follows immediately below it.

## Scope

### 1. Readiness Overview

Replace the current light Overview summary with a readiness command center.

The Overview should show:

- overall readiness status: `Ready`, `Ready with risk`, or `Blocked`
- short readiness narrative in plain language
- scope completion ratio from plan items and work items
- blocked and urgent issue counts
- GitHub health: open/review PRs, failing checks, and deploy state
- notification pressure for the current user
- current stage and next gate signal

The readiness status is derived from local project state. No external analytics service is introduced.

### 2. Decision Cues

Add a compact side panel that explains why the readiness status was chosen.

Decision cues should include:

- ship gate status
- primary blocker
- current engineering risk
- owner attention signal from unread notifications
- current stage gate signal

The goal is not to create a full executive dashboard. The goal is to make the Overview defensible in a standup, stakeholder check-in, or release discussion.

### 3. Team Action List

Add a generated action list below the executive snapshot.

Actions should be deterministic and source-linked. Examples:

- fix a failing check linked to a work item
- resolve a blocked item
- review a PR that is waiting
- move a stale current-stage plan item forward
- respond to unread high-priority notifications

The action list should not invent AI-style recommendations. It should be simple rule-based synthesis from existing project, work item, GitHub, plan, and notification state.

### 4. Scoped Readiness Search

Add a narrow project search surface that supports readiness work.

Search should cover:

- work item identifier, title, description, status, priority, labels
- plan item title, outcome, blocker
- project stage title, goal, gate status
- comment body
- GitHub PR title/branch/status where available
- notification title/body for the current user

Search is project-scoped. Phase 8 does not add a global cross-workspace search center.

### 5. Product Polish Where It Supports Readiness

Polish should be limited to readiness-critical rough edges:

- empty states for Overview, Engineering, Notifications, and Search
- loading and API error states for readiness search and notification-backed action signals
- clearer no-repository and no-GitHub-link states
- responsive behavior for the readiness cards and action list

Manual GitHub link management remains out of scope unless required to make readiness signals explainable.

## Non-Goals

- Global portfolio dashboard across workspaces
- Full analytics warehouse or historical trends
- AI-generated summaries or recommendations
- Full-text search infrastructure such as Elasticsearch
- Global command palette
- Manual ambiguous GitHub link resolution workflow
- Email, Slack, push, or real-time delivery
- New billing, permissions, or workspace administration surfaces

## Information Architecture

Overview becomes the primary Phase 8 surface:

1. **Executive Snapshot**
   - readiness status
   - narrative summary
   - key metrics chips

2. **Decision Cues**
   - gate status
   - primary blocker
   - engineering risk
   - notification pressure

3. **Signal Cards**
   - plan completion
   - blocked / urgent work
   - GitHub health
   - notification pressure

4. **Team Action List**
   - deterministic next actions with source links

5. **Scoped Search**
   - project readiness search
   - grouped result types

Existing Board, Plan, Engineering, Docs, and Notifications surfaces stay in place. Overview links into those surfaces when the user needs detail.

## Readiness Model

The readiness model should be implemented as a server-side projection.

### Inputs

- project record
- project stages and gate statuses
- plan items
- work items
- comments
- task GitHub statuses and engineering records
- current user's notification inbox rows

### Derived Status

`Blocked` when any of these are true:

- the current stage status is `Blocked`
- one or more work items are blocked
- one or more GitHub checks are failing on linked work

`Ready with risk` when none of the blocked rules are true, but any of these are true:

- urgent work exists
- open or review-requested PRs exist
- production deploy is missing while staging exists
- current user has unread high-priority notifications
- current stage has incomplete plan items

`Ready` when:

- no blocked rule is true
- no risk rule is true
- current stage plan items are complete or there are no current-stage plan items

### Readiness Narrative

The narrative should be deterministic and concise.

Examples:

- `Blocked by 1 failing check and 2 blocked work items.`
- `Ready with risk: 3 plan items remain and 1 PR is awaiting review.`
- `Ready: current stage has no blocking work and engineering signals are stable.`

## Search Design

Search should be implemented with simple Postgres-backed matching for Phase 8.

Use case-insensitive substring matching over normalized source fields. Ranking can be lightweight:

1. exact work item identifier match
2. work item title match
3. blocker / urgent / failing GitHub matches
4. comment, plan, stage, and notification text matches

Results should be grouped by type:

- Work items
- Plan
- Comments
- Engineering
- Notifications

Each result should include:

- type label
- title
- short context snippet
- status/risk chip where relevant
- link to the best existing project surface

## UI Direction

Keep the current dark, rounded, high-contrast project workspace language. Do not introduce a new visual system.

The Overview should feel more intentional:

- larger readiness headline
- fewer generic health lines
- stronger hierarchy between executive snapshot and team actions
- compact, scannable metrics
- source-linked actions instead of decorative cards

Search should be lightweight, not a heavy modal or global command center in this phase.

## API and Data Boundaries

Prefer server projections over client-side assembly.

Recommended boundaries:

- `apps/web/src/server/projects/readiness.ts` owns readiness derivation.
- `apps/web/src/server/projects/search.ts` owns project-scoped search.
- `getProjectWorkspaceForUser` includes readiness data in the Overview view model.
- API routes expose search only for authenticated workspace members.

Readiness and search must respect existing workspace membership and project scoping. Users should never see comments, notifications, or work items from another workspace.

## Verification

Automated coverage should prove:

- readiness status derivation for ready, ready-with-risk, and blocked states
- action list ordering and source links
- search returns project-scoped grouped results
- search excludes cross-workspace data
- Overview renders snapshot, decision cues, signal cards, action list, empty states, and search states
- existing Board, Plan, Engineering, Notifications, and Docs tests continue to pass

Full final verification:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Open Tradeoffs Resolved

- **Reporting vs search vs polish:** Reporting/readiness is the backbone. Search and polish are scoped support work.
- **Lead vs team audience:** Lead view owns the first screen; team actions sit directly underneath.
- **Recommendation style:** Rule-based synthesis only. No AI-generated guidance in Phase 8.
