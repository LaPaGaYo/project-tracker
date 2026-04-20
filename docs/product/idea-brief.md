# Idea Brief: Phase 5 — Detail & Comments

## Problem

Users can see work items in board/list views but cannot open them, edit descriptions, leave comments, or collaborate on individual items. The platform has no detail view. Without it, the product is a read-only kanban board with no way to do actual work management.

## Goals

1. **Work item detail page** — Full-page view for any work item showing title, description (rich text/markdown), metadata sidebar (type, priority, assignee, state, parent, labels), and activity history.

2. **Inline editing** — Edit title, description, and metadata fields directly on the detail page without a separate "edit mode."

3. **Comments** — Threaded comment system on work items. Users can add, edit, and delete their own comments. Comments appear in chronological order with author attribution.

4. **Description editor** — Markdown-based description field with a reasonable editing experience (textarea with preview, or a lightweight WYSIWYG like tiptap/milkdown).

5. **Activity timeline** — Show existing activity log entries plus comments in a unified timeline on the detail page.

## Constraints

- Must work within the existing Clerk auth + demo mode fallback
- Must respect RBAC (Viewers can read but not edit/comment, Members+ can edit and comment)
- No file attachments this phase (defer to Phase 6 or later)
- No real-time updates this phase (Phase 7)
- Keep the detail page URL-addressable: `/workspaces/[slug]/projects/[key]/items/[identifier]`
- Comments stored in database, not external service
- Markdown rendering for descriptions (no complex WYSIWYG required, but nice-to-have)

## Decisions

1. **Comments support markdown** — same rendering as descriptions
2. **Slide-over panel** (like Linear) — detail opens as a side panel, not a full page nav. URL still updates for shareability.
3. **Stub @mentions UI** — render `@username` visually but no lookup/autocomplete/notification this phase
4. **Description edit history shows diffs** — store previous versions, show what changed

## Non-Goals (this phase)

- File/image attachments
- Real-time collaborative editing
- @mentions / notifications
- Reaction emoji on comments
- Comment threading (replies to replies)
- Bulk editing from detail view

## Success Criteria

- User can click any work item (from board or list) and see its full detail page
- User can edit title, description, type, priority, assignee, state inline
- User can add/edit/delete comments on a work item
- Activity timeline shows all changes + comments in order
- RBAC enforced: Viewers read-only, Members+ can edit/comment
- All interactions persist to database with activity log entries
- Detail page is URL-addressable and shareable

## Technical Direction

- Next.js dynamic route: `apps/web/src/app/workspaces/[slug]/projects/[key]/items/[identifier]/page.tsx`
- New `comments` table in packages/db schema
- Server actions or API routes for comment CRUD
- Reuse existing work-items service for metadata updates
- Activity log entries for comments (created, edited, deleted)
- Client-side markdown rendering (e.g., react-markdown or similar)

## Phase Position

Phase 5 of 8. Builds on:
- Phase 2: Auth & Workspace (Clerk, RBAC)
- Phase 3: Projects & Work Items (data model, services)
- Phase 4: Views (board/list, navigation to items)

Next: Phase 6 (GitHub Integration), Phase 7 (Real-Time & Notifications), Phase 8 (Dashboard, Search & Polish)
