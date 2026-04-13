# Execution Readiness Packet: The Platform V1

## Framing Inputs Verified

| Input | Location | Status |
|-------|----------|--------|
| Idea Brief | `docs/product/idea-brief.md` | Complete. Goals, constraints, audit, all decisions locked. |
| Decision Brief | `docs/product/decision-brief.md` | Complete. 8 architectural decisions with trade-offs and risk register. |
| PRD | `docs/product/prd.md` | Complete. 13 scope sections, 15 non-goals, 10 launch + 5 quality criteria. |

## Phase Architecture

The V1 build is divided into 8 phases. Each phase produces a deployable increment. Phases are ordered by the dependency chain from the PRD: auth/workspace first, then domain model, then views, then integrations, then real-time.

```
Phase 1: Foundation ──> Phase 2: Auth & Workspace ──> Phase 3: Projects & Work Items
    │                                                          │
    │                                                          ▼
    │                                                   Phase 4: Views (Board, Backlog, List)
    │                                                          │
    │                                                          ▼
    │                                                   Phase 5: Work Item Detail & Comments
    │                                                          │
    │                                                          ▼
    │                                                   Phase 6: GitHub Integration
    │                                                          │
    │                                                          ▼
    │                                                   Phase 7: Real-Time & Notifications
    │                                                          │
    │                                                          ▼
    │                                                   Phase 8: Dashboard, Search & Polish
```

---

## Phase 1: Foundation

**Goal:** Greenfield Next.js project with database, deployment pipeline, and development tooling. No features yet, just a working skeleton that every subsequent phase builds on.

**PRD coverage:** None directly (infrastructure prerequisite).

### Tasks

**1.1 Project scaffolding**
- Initialize Next.js app with TypeScript strict mode, App Router
- Configure Tailwind CSS with Planka dark theme tokens (carried from existing `tailwind.config.js`)
- Configure ESLint, Prettier
- Set up path aliases (`@/` for `src/`)

**1.2 Database setup**
- Postgres schema with initial migration tooling (Drizzle ORM or Prisma, decide during execution)
- Connection pooling configuration
- Migration scripts infrastructure
- Seed script for development data

**1.3 Redis setup**
- Redis client configuration
- Connection management for cache and ephemeral state

**1.4 Monorepo structure**
- `/apps/web` — Next.js app (deploys to Vercel)
- `/apps/worker` — background job processor (deploys separately)
- `/packages/db` — shared database schema, client, and queries
- `/packages/shared` — shared types, constants, utilities
- Turborepo or similar for monorepo orchestration

**1.5 CI/CD pipeline**
- GitHub Actions: lint, typecheck, test on PR
- Vercel deployment for web app (preview on PR, production on main)
- Worker deployment pipeline (target TBD, likely Fly.io or Railway)

**1.6 Development environment**
- Docker Compose for local Postgres + Redis
- `.env.example` with all required variables
- `npm run dev` starts web + worker + databases

### Exit criteria
- `npm run dev` starts the app, shows a blank page at localhost
- `npm run db:migrate` runs without error
- `npm run lint && npm run typecheck` pass
- CI runs on a test PR
- Vercel preview deployment works

---

## Phase 2: Auth & Workspace

**Goal:** Users can sign up, create a workspace, invite members, and see role-based access enforced server-side.

**PRD coverage:** S1 (Workspace and Tenancy), S2 (Authentication and Roles).

### Tasks

**2.1 Clerk integration**
- Install Clerk, configure Next.js middleware for auth
- Sign up / sign in pages
- Auth abstraction layer: wrap Clerk so provider is swappable later
- Session management, redirect logic

**2.2 Workspace entity**
- Database: `workspaces` table (id, name, slug, created_at, updated_at)
- Database: `workspace_members` table (workspace_id, user_id, role, invited_at, joined_at)
- API: `POST /api/workspaces` (create)
- API: `GET /api/workspaces` (list user's workspaces)
- API: `GET /api/workspaces/:id` (get workspace)
- API: `PATCH /api/workspaces/:id` (update settings)

**2.3 Workspace selection UI**
- Workspace switcher in navigation
- Create workspace flow
- Workspace settings page (name, slug)

**2.4 Invitation system**
- API: `POST /api/workspaces/:id/invitations` (invite by email)
- API: `GET /api/workspaces/:id/members` (list members)
- API: `PATCH /api/workspaces/:id/members/:userId` (change role)
- API: `DELETE /api/workspaces/:id/members/:userId` (remove member)
- Invitation acceptance flow (Clerk webhook on user creation + pending invite matching)

**2.5 Role enforcement**
- Middleware: inject workspace context into every `/api/workspaces/:id/*` request
- Middleware: validate user is a member of the workspace
- Role checks: Owner, Admin, Member, Viewer permissions per endpoint
- Tests: cross-tenant access attempts return 403

### Exit criteria
- **LC1:** New user signs up, creates workspace, invites teammate, both see workspace within 3 minutes
- **LC7:** User in Workspace A cannot access Workspace B data through any API endpoint
- **LC6 (partial):** Viewer cannot create work items via API (403)

---

## Phase 3: Projects & Work Items

**Goal:** Users can create projects, manage work items with hierarchy and workflow, and see human-readable IDs.

**PRD coverage:** S3 (Projects), S4 (Work Items), S5 (Workflow Engine), S10 (Activity and Audit).

### Tasks

**3.1 Project entity**
- Database: `projects` table (id, workspace_id, name, key, description, status, created_at, updated_at)
- API: CRUD endpoints under `/api/workspaces/:id/projects`
- Project key validation (unique within workspace, 2-6 uppercase letters)
- Project statuses: Active, Paused, Archived

**3.2 Workflow engine**
- Database: `workflow_statuses` table (id, project_id, name, category, position)
- Default workflow seeded on project creation: Backlog > To Do > In Progress > In Review > Done
- API: CRUD for workflow statuses within a project
- Category constraint: every project must have at least one status in each category (todo, in_progress, done)

**3.3 Work item entity**
- Database: `work_items` table (id, project_id, workspace_id, type, title, description, status_id, assignee_id, priority, parent_id, position, due_date, completed_at, sequence_number, created_at, updated_at)
- Human-readable ID generation: `{project.key}-{sequence_number}` (auto-incrementing per project)
- API: CRUD endpoints under `/api/workspaces/:wid/projects/:pid/work-items`
- Type validation: Epic > Task/Bug > Subtask hierarchy enforcement
- Position ordering for drag-and-drop (fractional indexing or gap-based)

**3.4 Labels**
- Database: `labels` table (id, project_id, name, color)
- Database: `work_item_labels` join table
- API: CRUD for labels, attach/detach on work items

**3.5 Activity logging**
- Database: `activities` table (id, workspace_id, entity_type, entity_id, actor_id, action, before, after, timestamp)
- Service layer: log every create, update, delete, status change automatically
- Immutable records (no update/delete on activity table)

**3.6 Tenant scoping enforcement**
- All work item queries enforce workspace_id scoping
- All project queries enforce workspace_id scoping
- Integration tests for cross-workspace access on every endpoint

### Exit criteria
- **LC2:** User creates project, adds 10+ work items across types, manages them
- **LC6 (full):** Role enforcement on all project and work item endpoints
- **QC4:** Zero `any` types in domain layer

---

## Phase 4: Views (Board, Backlog, List)

**Goal:** Three views over the same work item data. Status changes in one view are immediately visible in others.

**PRD coverage:** S6 (Views), S13 (Search and Filtering).

### Tasks

**4.1 Board view**
- Kanban columns grouped by workflow status
- Drag-and-drop to change status (updates position and status_id)
- Swimlane options: none, by assignee, by priority, by epic
- Column WIP indicators (count)

**4.2 Backlog view**
- Flat or grouped list of non-done work items
- Drag-to-reorder (updates position)
- Inline editing: title, assignee, priority, status, type
- Bulk actions: assign, change status, change priority

**4.3 List view**
- Tabular layout with sortable columns (title, type, status, assignee, priority, due date)
- Filterable by all fields
- Bulk selection and bulk actions
- Pagination (cursor-based)

**4.4 Filtering system**
- Structured filters: type, status, assignee, priority, label, due date range, parent
- AND-combinable filters
- URL-synchronized filter state (shareable URLs)

**4.5 Saved filters**
- Database: `saved_filters` table (id, project_id, created_by, name, filter_config, shared, created_at)
- API: CRUD for saved filters
- UI: save current filter, load saved filter, share with team

**4.6 Shared view data layer**
- Single data source for all three views
- Optimistic updates on user actions
- Server state management (React Query or SWR)

### Exit criteria
- **LC4:** Status change on board is visible in list view without refresh
- **QC1:** Board renders and becomes interactive within 2 seconds for 200 work items
- All three views show identical data for the same filter state

---

## Phase 5: Work Item Detail & Comments

**Goal:** Full detail page for each work item with activity timeline, comments, and child items.

**PRD coverage:** S8 (Work Item Detail Page), S10 (Activity, continued).

### Tasks

**5.1 Detail page layout**
- Full detail view with inline-editable fields
- Sidebar: assignee, status, priority, labels, due date, parent, timestamps
- Main area: description, activity timeline, child items

**5.2 Rich text description**
- Markdown-based editor (Tiptap, Plate, or similar)
- Preview mode
- Basic formatting: headings, bold, italic, lists, code blocks, links

**5.3 Comments**
- Database: `comments` table (id, work_item_id, author_id, body, created_at, updated_at)
- Threaded comments with Markdown support
- @mention team members (autocomplete from workspace members)
- Edit and delete own comments

**5.4 Activity timeline**
- Chronological feed of: field changes, comments, (later: GitHub events)
- Actor attribution, timestamps, before/after values for field changes
- Infinite scroll or pagination

**5.5 Child items**
- Epic detail shows child Tasks/Bugs
- Task detail shows child Subtasks
- Quick-add child item inline

### Exit criteria
- **LC8:** Work item detail shows full activity history with field changes and comments in chronological order
- Comments render Markdown correctly
- @mentions link to workspace members

---

## Phase 6: GitHub Integration

**Goal:** Connect GitHub repos to projects, ingest PR/commit/CI events, display engineering activity inside work items.

**PRD coverage:** S7 (GitHub Integration).

### Tasks

**6.1 GitHub App setup**
- Create GitHub App configuration
- OAuth flow for installation
- Database: `github_installations` table (id, workspace_id, installation_id, account_login, installed_at)
- Installation webhook handler (app installed/uninstalled)

**6.2 Repository linking**
- Database: `github_repo_links` table (id, project_id, installation_id, repo_full_name, linked_at)
- API: link/unlink repos to projects
- UI: repository linking in project settings

**6.3 Webhook receiver**
- Webhook endpoint for GitHub events (signature verification)
- Durable queue: receive webhook, enqueue for worker processing
- Event types: pull_request, push, check_suite, check_run

**6.4 Worker: event processing**
- Queue consumer in `/apps/worker`
- Parse and normalize GitHub events
- Database: `github_events` table (id, repo_link_id, work_item_id, event_type, payload, github_created_at, ingested_at)
- Dead letter queue for failed processing
- Retry with exponential backoff

**6.5 Work item linking**
- Match GitHub events to work items via:
  - Branch name pattern: `{project-key}-{number}` (e.g., `PLAT-42-fix-login`)
  - PR title/body references: `PLAT-42` or `[PLAT-42]`
  - Commit message references
  - Manual linking from work item detail
- Link GitHub events to matched work items

**6.6 GitHub activity in UI**
- Work item detail: linked PRs panel with status (open/merged/closed), review state, CI status
- Work item activity timeline: PR opened, commits pushed, reviews, CI results
- Project dashboard data: open PRs, failing CI, PRs awaiting review

### Exit criteria
- **LC3:** Within 60 seconds of a PR being opened with a work item reference in the branch name, the PR appears in the work item's activity timeline
- **QC3:** Webhook processing survives receiver downtime (events queued and processed on recovery)
- Manual linking works from the work item detail page

---

## Phase 7: Real-Time & Notifications

**Goal:** Live updates across users via SSE. In-app notification center.

**PRD coverage:** S11 (Notifications), S12 (Real-Time Updates).

### Tasks

**7.1 SSE infrastructure**
- SSE endpoint: `/api/workspaces/:id/events` (authenticated, workspace-scoped)
- Server-side event publishing on: work item changes, comments, GitHub events
- Client-side SSE connection management (reconnect, backoff)
- Redis pub/sub for multi-instance coordination

**7.2 Real-time view updates**
- Board, backlog, and list views subscribe to SSE
- Incoming events update local state without full refetch
- Optimistic updates for own actions, SSE for others' actions
- Conflict handling: server state wins on conflict

**7.3 Notification system**
- Database: `notifications` table (id, user_id, workspace_id, type, entity_type, entity_id, read, created_at)
- Notification triggers: assigned to you, mentioned in comment, status change on your items, PR activity on your items
- API: list notifications, mark as read, mark all as read
- Notification center UI: unread count badge, notification list

**7.4 SSE for notifications**
- New notifications pushed via SSE
- Unread count updates in real-time in the navigation bar

### Exit criteria
- **LC5:** Two users see each other's board changes in real-time without refresh
- Notification count updates live when a new notification arrives
- SSE reconnects gracefully after network interruption

---

## Phase 8: Dashboard, Search & Polish

**Goal:** Project dashboard, global search, and launch-readiness polish.

**PRD coverage:** S9 (Dashboard), S13 (Search, continued), launch criteria polish.

### Tasks

**8.1 Project dashboard**
- Work item counts by status (bar or donut chart)
- Items completed this week
- Overdue items list
- Open PRs across linked repos
- Failing CI
- Blocked items
- Read-only, computed from live data

**8.2 Search**
- Postgres full-text search on work item title, description
- Trigram index for fuzzy matching on work item ID and title
- Global search UI: command palette or search bar
- Results scoped to current project
- **LC10:** Returns results within 500ms for 1,000 items

**8.3 Navigation polish**
- Workspace switcher
- Project sidebar
- Breadcrumbs
- Keyboard shortcuts for common actions (new item, search, navigation)

**8.4 Error handling and edge cases**
- Empty states for all views
- Loading states and skeletons
- Error boundaries
- 404 and permission denied pages

**8.5 Performance audit**
- **QC1:** Board renders in <2s for 200 items
- **QC5:** All API endpoints have happy-path and auth tests
- Lighthouse audit on key pages
- Bundle size check

**8.6 Launch criteria verification**
- Walk through LC1-LC10 and QC1-QC5 manually
- Fix any gaps

### Exit criteria
- **LC9:** Dashboard shows accurate counts
- **LC10:** Search returns results within 500ms
- All 10 launch criteria pass
- All 5 quality gates pass

---

## Phase Dependencies (strict)

```
Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 4 ──┐
                                                ├──> Phase 5
                                                │       │
                                                │       ▼
                                                ├──> Phase 6
                                                │       │
                                                │       ▼
                                                └──> Phase 7
                                                        │
                                                        ▼
                                                    Phase 8
```

- Phase 4 and Phase 5 can run in parallel after Phase 3
- Phase 6 depends on Phase 3 (work items exist to link to) and Phase 5 (activity timeline to display in)
- Phase 7 depends on Phase 4 (views to update) and Phase 5 (comments to notify on)
- Phase 8 depends on Phase 6 and Phase 7 (dashboard needs GitHub data, search needs all content)

## Risk Mitigations Built Into Plan

| Risk | Mitigation |
|------|-----------|
| Scope creep | 15 explicit non-goals in PRD. Each phase has bounded exit criteria mapped to PRD requirements. |
| GitHub webhook reliability | Phase 6 builds durable queue from day one. Dead letter queue and retry built into worker design. |
| Multi-tenancy bugs | Phase 2 establishes tenant scoping middleware. Phase 3 adds cross-tenant integration tests on every endpoint. |
| Performance at scale | Phase 8 includes explicit performance audit against QC1 and LC10 targets. |
| Clerk vendor lock-in | Phase 2 wraps Clerk in auth abstraction layer from the start. |

## Execution Mode

- **Mode:** governed_ccb
- **Primary provider:** codex
- **Topology:** multi_session
- **Routing:** `/handoff` packages each phase for governed execution

## Readiness Declaration

**EXECUTION READY.** Framing inputs verified. 8 phases defined with 40+ tasks, strict dependency ordering, and exit criteria mapped to PRD requirements (LC1-LC10, QC1-QC5). Ready to advance to `/handoff`.
