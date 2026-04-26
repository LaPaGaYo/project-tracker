# Execution Readiness Packet — Phase 5: Detail & Comments

**This packet covers Phase 5 ONLY. Do not implement features from other phases.**

## Run Context

- Run ID: run-2026-04-20T13-45-58-613Z
- Phase: 5 of 8 (Detail & Comments)
- Depends on: Phases 1-4 (already merged to main)
- Worktree: `.nexus-worktrees/run-2026-04-20T13-45-58-613Z`

## CRITICAL: Before starting implementation

1. `git merge origin/main` in the worktree to ensure all Phase 1-4 code is present
2. Use extensionless imports in package source files (e.g., `import { x } from './types'` not `'./types.ts'`)
3. Run `drizzle-kit generate` in `packages/db/` after adding schema changes

## Tech Stack (existing)

- Next.js 15 + React 19, App Router
- Turborepo monorepo: `apps/web`, `apps/worker`, `packages/db`, `packages/shared`
- Drizzle ORM with PostgreSQL
- Clerk auth with demo mode fallback (cookie-based sessions)
- Tailwind CSS with Planka dark theme
- Testing: Node.js test runner with tsx loader, real Postgres

## Task Breakdown

### Task 5.1: Database Schema & Migration

**Files to create/modify:**
- `packages/db/src/schema.ts` — Add `comments` and `description_versions` tables
- Run `drizzle-kit generate` to produce migration SQL

**Schema additions:**

```typescript
// comments table
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// description_versions table
export const descriptionVersions = pgTable('description_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorId: text('author_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Verification:** Migration SQL files exist in `packages/db/drizzle/`. Tables create successfully.

### Task 5.2: Shared Types

**Files to modify:**
- `packages/shared/src/types.ts` — Add `CommentRecord`, `DescriptionVersionRecord`
- `packages/shared/src/index.ts` — Re-export new types

```typescript
export interface CommentRecord {
  id: string;
  workItemId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DescriptionVersionRecord {
  id: string;
  workItemId: string;
  content: string;
  authorId: string;
  createdAt: Date;
}
```

### Task 5.3: Comments Server Module

**Files to create:**
- `apps/web/src/server/comments/repository.ts` — Drizzle queries for comments CRUD
- `apps/web/src/server/comments/service.ts` — Business logic with RBAC enforcement
- `apps/web/src/server/comments/types.ts` — Input/output types

**Operations:**
- `createComment(workItemId, authorId, content)` — Member+ only
- `updateComment(commentId, authorId, content)` — Own comments only (Admin+ can edit any)
- `deleteComment(commentId, authorId)` — Soft delete. Own comments only (Admin+ can delete any)
- `listComments(workItemId)` — Returns non-deleted comments, chronological order
- Each mutation creates an activity log entry

### Task 5.4: Description Versioning

**Files to modify:**
- `apps/web/src/server/work-items/repository.ts` — Add description version queries
- `apps/web/src/server/work-items/service.ts` — Wrap description updates to save previous version

**Operations:**
- `updateDescription(workItemId, newContent, authorId)` — Saves current description to versions table, then updates work item. Member+ only.
- `listDescriptionVersions(workItemId)` — Returns all previous versions, newest first.

### Task 5.5: API Routes

**Files to create:**
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/comments/route.ts` — GET (list), POST (create)
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/comments/[commentId]/route.ts` — PATCH (edit), DELETE (soft delete)
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/description/route.ts` — PATCH (update description)
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/items/[identifier]/description/versions/route.ts` — GET (list versions)

All routes enforce auth + RBAC via existing workspace/project access utilities.

### Task 5.6: Detail Panel Component

**Files to create:**
- `apps/web/src/components/detail-panel.tsx` — Main slide-over panel shell (backdrop, close, escape key)
- `apps/web/src/components/metadata-sidebar.tsx` — Right sidebar with editable fields
- `apps/web/src/components/description-editor.tsx` — Markdown textarea with Write/Preview toggle
- `apps/web/src/components/comment-list.tsx` — Renders comments with markdown
- `apps/web/src/components/comment-input.tsx` — New comment form
- `apps/web/src/components/timeline.tsx` — Merged activity + comments feed
- `apps/web/src/components/diff-viewer.tsx` — Side-by-side or inline diff display

**Behavior:**
- Panel slides from right, ~600px wide, full-height
- Dimmed backdrop, click-outside or Escape to close
- URL updates via `window.history.pushState` (or Next.js router)
- Optimistic updates for field changes
- Debounced title save (500ms)

### Task 5.7: Navigation Integration

**Files to modify:**
- `apps/web/src/components/board-view.tsx` — Add onClick to work item cards
- `apps/web/src/components/list-view.tsx` — Add onClick to list rows
- `apps/web/src/app/workspaces/[slug]/projects/[key]/page.tsx` — Mount DetailPanel conditionally

**URL pattern:** `/workspaces/[slug]/projects/[key]/items/[identifier]`
- When URL has item identifier, render panel open
- When panel closed, pop URL back to project view

### Task 5.8: Contract Tests

**Files to create:**
- `tests/phase5-detail-comments.test.mjs`

**Test coverage:**
- Comment CRUD (create, read, update, soft-delete)
- RBAC: Viewer cannot create comment, Member can, Admin can delete any
- Description versioning: update creates version, versions are retrievable
- Field update creates activity log entry
- Timeline ordering (activity + comments sorted by timestamp)

**Test infrastructure:** Same pattern as Phase 3/4 tests. Real Postgres, tsx loader, per-test fixtures.

## Dependencies (npm packages to add)

- `react-markdown` — Markdown rendering in React
- `remark-gfm` — GitHub-flavored markdown plugin
- `diff` — Text diff computation for description history

## File Tree Summary (new files)

```
apps/web/src/
  server/comments/
    repository.ts
    service.ts
    types.ts
  components/
    detail-panel.tsx
    metadata-sidebar.tsx
    description-editor.tsx
    comment-list.tsx
    comment-input.tsx
    timeline.tsx
    diff-viewer.tsx
  app/api/workspaces/[slug]/projects/[key]/items/[identifier]/
    comments/
      route.ts
      [commentId]/route.ts
    description/
      route.ts
      versions/route.ts
packages/db/src/schema.ts (modify)
packages/shared/src/types.ts (modify)
tests/phase5-detail-comments.test.mjs
```

## Exit Criteria

All 11 success criteria from the decision brief must pass:
1. Click work item -> panel opens
2. URL updates to item path
3. Direct URL nav works
4. Inline editing with optimistic UI
5. Markdown description with preview
6. Description diffs
7. Comment CRUD with markdown
8. Unified timeline
9. RBAC enforced
10. Activity log entries for all changes
11. Contract tests pass
