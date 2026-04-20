# PRD: Phase 5 — Detail & Comments

## Overview

Add work item detail panel with inline editing, markdown descriptions with version history, comments, and a unified activity timeline.

## Scope Sections

### 5.1 Slide-over Detail Panel

A right-side panel that opens when clicking any work item from board or list views.

**Requirements:**
- Panel slides in from the right, overlaying the current view (board or list stays visible underneath with a dimmed backdrop)
- URL updates to `/workspaces/[slug]/projects/[key]/items/[identifier]`
- Direct URL navigation opens the panel over the default project view
- Close button and Escape key dismiss the panel
- Panel width: ~600px on desktop, full-width on mobile
- Panel shows: title, description, metadata sidebar, timeline

**Layout:**
- Top: title (editable inline)
- Left column: description + timeline
- Right sidebar: metadata fields (type, priority, assignee, state, parent, labels, created/updated dates)

### 5.2 Inline Field Editing

All metadata fields and title are editable directly on the detail panel.

**Requirements:**
- Click-to-edit on title (text input)
- Dropdown selectors for: type, priority, assignee, workflow state
- Parent work item selector (search/select from same project)
- Optimistic UI updates with server reconciliation
- Debounced save for title (500ms after last keystroke)
- Immediate save on dropdown selections
- Activity log entry created for each field change
- RBAC: only Member+ can edit

### 5.3 Markdown Description

Full markdown editor for work item descriptions with preview and version history.

**Requirements:**
- Textarea with markdown input
- Toggle between "Write" and "Preview" modes
- Preview renders GitHub-flavored markdown (headings, bold, italic, code blocks, links, lists, tables)
- `@username` text renders with visual highlight in preview (stub, no autocomplete)
- Save button commits description changes
- Each save creates a new version in `description_versions` table
- "History" toggle shows list of previous versions with timestamps and authors
- Clicking a version shows diff against current (added lines in green, removed in red)
- RBAC: only Member+ can edit

**Data model:**
```
description_versions:
  id: uuid PK
  work_item_id: uuid FK -> work_items.id
  content: text
  author_id: text (Clerk user ID)
  created_at: timestamp
```

### 5.4 Comments

First-class comment entities on work items.

**Requirements:**
- Comment input area at bottom of timeline with markdown support
- Submit creates comment with author attribution
- Each comment shows: author, timestamp, rendered markdown content
- Edit own comments (inline edit mode, same markdown input)
- Delete own comments (with confirmation)
- Admin/Owner can delete any comment
- Activity log entry for: comment_created, comment_edited, comment_deleted
- Comments ordered chronologically (oldest first)
- RBAC: only Member+ can add/edit/delete comments

**Data model:**
```
comments:
  id: uuid PK
  work_item_id: uuid FK -> work_items.id
  author_id: text (Clerk user ID)
  content: text (markdown)
  created_at: timestamp
  updated_at: timestamp
  deleted_at: timestamp (soft delete)
```

### 5.5 Unified Activity Timeline

Single chronological feed mixing activity log entries and comments.

**Requirements:**
- Fetch activity log entries + comments for the work item
- Merge and sort by timestamp (ascending, oldest first)
- Activity entries render as compact one-liners: "[User] changed [field] from [old] to [new]"
- Comments render with full markdown content, author avatar placeholder, and timestamp
- Infinite scroll or "load more" for items with many entries
- New entries appear at the bottom

### 5.6 Navigation Integration

Wire the detail panel into existing board and list views.

**Requirements:**
- Board view: clicking a card opens the detail panel
- List view: clicking a row opens the detail panel
- Panel respects existing filter/sort state (underlying view unchanged)
- Browser back button closes panel (URL history management)
- Keyboard: Escape closes panel

### 5.7 Contract Tests

Automated tests covering the new functionality.

**Requirements:**
- Comment CRUD operations (create, read, update, soft-delete)
- Permission boundaries (Viewer cannot comment, Member can, Admin can delete any)
- Description versioning (save creates version, versions are retrievable)
- Field update creates activity log entry
- Timeline merging (activity + comments sorted correctly)

## Technical Notes

- New database tables: `comments`, `description_versions`
- New Drizzle migration for both tables
- New server modules: `apps/web/src/server/comments/` (repository, service, types)
- Extend work-items service with description versioning
- React components: `DetailPanel`, `DescriptionEditor`, `CommentList`, `CommentInput`, `Timeline`, `MetadataSidebar`, `DiffViewer`
- Markdown rendering: `react-markdown` with `remark-gfm` plugin
- Diff rendering: `diff` npm package for computing text diffs
- Panel routing: Next.js intercepting routes or client-side state with URL sync

## Exit Criteria

- All 11 success criteria from the decision brief are met
- Contract tests pass in CI
- No regression in existing board/list functionality
- RBAC boundaries verified in tests
