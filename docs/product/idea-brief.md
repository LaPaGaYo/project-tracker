# Idea Brief: The Platform

## Overview

Cloud-native project and engineering work management system for modern software teams. GitHub-native Jira/Linear hybrid for engineering teams that have outgrown GitHub Projects but don't want the weight of Jira.

## Goals

### Business Goals
- Credible Jira alternative for software teams
- Reduce tool switching between GitHub, issue trackers, spreadsheets, chat
- Improve project visibility, delivery predictability, team coordination
- SaaS monetization through multi-tenant cloud deployment
- Foundation for future enterprise expansion

### Product Goals
- Full work planning from initiative to subtask
- Real-time GitHub-linked engineering execution tracking
- Role-based collaboration in shared workspaces
- Configurable workflows, automations, and dashboards
- Multi-project portfolio visibility

## Target Users

### Primary
- Product Managers (roadmap, backlog, sprint planning, stakeholder reporting)
- Engineering Managers (workload, health, dependencies, risk, execution)
- Software Engineers (fast board, work items, linked PRs/commits, workflow states)
- QA Engineers (release tracking, test readiness, bug triage, auditability)
- Technical Project Managers

### Secondary
- Designers, DevOps/SRE, leadership, client-facing coordinators, external collaborators

## Core Principles

1. **Hierarchy over flat tasks** — strategy, planning, execution connect through structured work model
2. **Workflow as logic** — state transitions support rules, validation, automation, permissions
3. **GitHub as real-time source of truth** — engineering activity visible inside project tracking
4. **Multiple views over one work model** — board, list, backlog, timeline, dashboard reflect same data
5. **Cloud-first collaboration** — invitations, comments, notifications, shared ownership are native
6. **Scalable governance** — permissions, auditability, configuration control scale with team growth

## V1 Scope

### V1 Thesis
"Can a GitHub-based software team actually run project execution here instead of using GitHub Projects + spreadsheets + Slack + partial Jira?"

### V1 Includes
- Workspaces with team invites
- Projects within workspaces
- Work items: Epic, Task/Story, Subtask, Bug
- Lightweight hierarchy (not full portfolio depth)
- Backlog, board, and list views
- Work item detail page with comments + activity history
- GitHub repo linking via GitHub App + webhooks
- PR/commit/CI status visibility inside work items
- Basic roles (Owner, Admin, Member, Viewer)
- Basic workflow enforcement (configurable statuses + transitions)
- Minimal dashboards (project overview, open PRs, blocked work, failing CI, overdue items)

### V1 Excludes
- Full Initiative > Epic > Story > Task > Subtask portfolio depth
- Enterprise permission schemes
- Full bidirectional GitHub sync / write-back
- JQL-like query language (saved filters first)
- Service desk / customer-facing workflows
- Sprint management (can come in V1.x)

## Tech Stack (Locked)

- **Frontend:** Next.js + React + TypeScript
- **Database:** PostgreSQL
- **Cache / ephemeral state:** Redis
- **Background jobs:** queue-based worker model
- **File storage:** S3-compatible object storage
- **Auth:** Clerk (identity + sessions only; tenancy/roles in our DB)
- **GitHub integration:** GitHub App + webhooks
- **Deployment:** Vercel for app, separate workers for sync/jobs
- **Real-time:** SSE first, WebSockets later when needed
- **Search:** Postgres full-text search + structured filters for V1
- **Monorepo:** single repo, separate deploy targets for app and workers

## Existing Codebase Audit (2026-04-12)

### Key Finding: Framework Mismatch
Existing codebase is **Vue 3 + Vite + Dexie (IndexedDB)**, not React/Next.js.
Vue components cannot be directly reused. This is greenfield with design reference.

### What Exists (~5,000 LOC)
- Vue 3 SPA with TypeScript strict mode
- 6 reusable UI components (Button, Modal, Toast, Badge, Dropdown)
- Kanban board with drag-and-drop (vuedraggable)
- Portfolio view with 6 project stages
- 7 service files with clean CRUD separation
- Dexie/IndexedDB with 7 tables (projects, tasks, checklistItems, notes, attachments, activity, tags)
- Activity logging system
- WIP limit enforcement (policyService)
- Position ordering algorithm for drag-drop
- Planka dark theme (Tailwind config)
- 11 test files (Vitest)
- No backend, no auth, no API, no multi-user support

### What Carries Forward (as patterns, not code)
- Data model shape: projects (6 stages), tasks (4 statuses), checklists, notes, attachments, activity, tags
- Kanban column-based board architecture
- WIP limit enforcement logic
- Activity logging approach
- Position ordering algorithm
- Planka dark theme Tailwind tokens (config file reusable directly)
- Service layer separation pattern
- TypeScript strict mode discipline

### What Gets Rebuilt
- All UI components (Vue -> React)
- All composables (Vue reactivity -> React hooks/server components)
- All data access (IndexedDB -> Postgres via API)
- Routing (Vue Router -> Next.js App Router)
- State management (Vue refs -> React patterns)
- Everything missing: auth, API, multi-tenancy, real-time, permissions

### Revised Approach
**Greenfield with design reference.** The existing codebase serves as a working prototype that documents UX decisions, data model shape, and interaction patterns. The production system is a new Next.js/React/Postgres build that uses these patterns as a spec, not as reusable code.

## Multi-Tenancy

- Shared database, shared schema, tenant isolation by workspace/project scoping
- Every tenant-bound table carries workspace_id
- Project-scoped records also carry project_id
- All service-layer queries enforce tenant scoping
- Indexes designed around (workspace_id, ...) access patterns
- Application-enforced isolation first, DB-level isolation later if needed

## Auth and Roles

### Provider: Clerk
- Identity and session management only
- Workspace membership, project roles, and authorization live in our database
- Auth abstraction from day one (swap to Auth0 later if enterprise SSO needed)

### V1 Roles
- Workspace Owner
- Workspace Admin
- Member
- Viewer

### Project-Level Access
- Project owner
- Project collaborator
- Repository link admin

### Rule
Simple role model, strong defaults, permission checks at workspace and project level. No enterprise-grade scheme system yet.

## GitHub Integration (V1)

### Depth: Medium
- GitHub App installation per workspace
- Repository linking to projects
- Webhook-driven ingestion (PR opened/updated/merged, commits, reviews, CI/checks)
- Activity timeline inside work items
- Optional status updates triggered by GitHub events

### Linking Methods
- Explicit manual linking
- Branch naming convention
- PR title/description references
- Commit message references

### Not in V1
- Full bidirectional sync
- Automatic GitHub issue creation for all work item types
- Deep write-back / mutation of GitHub state
- Complex conflict resolution between systems

### Model
GitHub = engineering source of truth. Platform = planning and coordination source of truth. One-way dominant sync from GitHub into product, plus limited deliberate linking.

## Deployment Architecture

- **Web app:** Vercel (Next.js)
- **Workers:** separate runtime for GitHub webhooks, queue consumers, background jobs
- **Queue:** durable queue between webhook ingest and processing
- **Webhook receiver:** can be thin (Vercel Function), real processing in workers
- **Infrastructure:** managed Postgres + managed Redis

### Why Not All-Vercel
Webhook processing must be durable, retryable, observable, and decoupled from UI request lifecycles. Vercel Functions are not the right long-term home for the core GitHub sync pipeline.

## Real-Time Strategy

- **V1:** SSE (server-sent events) for server -> client updates
- Board refreshes, GitHub event updates, notifications, timeline inserts
- Optimistic UI for user actions
- Polling as fallback for non-critical screens
- **Later:** WebSockets when live presence, collaborative editing, or fine-grained multi-user board sync are needed

## Search Strategy

- **V1:** Postgres full-text search + structured filters + indexed key/title lookup
- Trigram/fuzzy support where needed
- Saved filters over search-heavy complexity
- **Later:** Dedicated search engine (Typesense/Meilisearch) when scale and UX justify it

## Competitive Positioning

**Positioning:** GitHub-native Jira/Linear hybrid for modern engineering teams.

### V1 Wins On
- Better GitHub visibility than Jira
- More structure than GitHub Projects
- More flexible workflow than Linear-style minimalism
- Faster, cleaner UX than traditional Jira setups

### V1 Does Not Compete On
- Enterprise breadth
- Service desk
- Complex admin schemes
- Portfolio governance at scale

## Constraints

- Existing codebase is Vue 3 / client-only — serves as design reference, not reusable code
- V1 hierarchy stays light (Epic > Task/Story > Subtask > Bug)
- Workflow configurability limited to statuses + transitions, not full enterprise schemes
- Monorepo with separable worker processes
- Saved filters first, JQL-like grammar later
- Clerk for auth, but tenancy/roles owned by our DB
- SSE before WebSockets
- Postgres search before dedicated search

## Open Questions (Resolved)

All five pre-frame questions have been answered:

1. ~~How much of the existing repo survives?~~ **Resolved:** greenfield with design reference. Vue codebase provides patterns and UX spec, not reusable code.
2. ~~Which managed auth provider?~~ **Resolved:** Clerk for V1. Auth abstraction from day one.
3. ~~Deployment target for V1?~~ **Resolved:** Vercel for app, separate workers for sync/jobs.
4. ~~Real-time strategy?~~ **Resolved:** SSE first, WebSockets later.
5. ~~Search infrastructure?~~ **Resolved:** Postgres full-text search for V1.

## Discovery Status

**COMPLETE.** All goals captured, constraints identified, open questions resolved. Ready to advance to `/frame`.
