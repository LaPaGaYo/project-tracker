# Decision Brief: Phase 5 — Detail & Comments

## Context

Phase 4 shipped board and list views. Users can see and organize work items but cannot open them to read descriptions, leave comments, or edit fields. Phase 5 adds the detail experience that makes work items usable.

## Key Decisions

### 1. Slide-over Panel (not full-page navigation)

Work item detail opens as a right-side panel overlaying the current view (board or list). The URL updates for deep linking. Closing the panel returns to the underlying view without a page reload.

**Why:** Linear proved this pattern. Users stay oriented in their board/list context while working on individual items. No back-button confusion.

**Implementation:** Next.js parallel routes or intercepting routes pattern. Panel component renders over current page content.

### 2. Markdown for Descriptions and Comments

Both descriptions and comments support GitHub-flavored markdown. Rendered with react-markdown or similar.

**Why:** Developers expect markdown. Code blocks, links, lists are table stakes for a project management tool targeting engineering teams.

### 3. @mentions Stubbed (visual only)

`@username` text renders with visual styling (highlight color, distinct font weight) but no autocomplete dropdown, no user lookup, no notification dispatch.

**Why:** Full @mentions requires notification infrastructure (Phase 7). Stubbing the visual treatment now means we don't have to redesign comments later.

### 4. Description Edit History with Diffs

Store previous description versions. Show what changed between edits (added/removed lines).

**Why:** Accountability and context. When someone changes a spec, the team needs to see what moved.

**Implementation:** `description_versions` table storing previous content + timestamp + author. Diff computed client-side with a lightweight diff library.

### 5. Comments Table (not activity log entries)

Comments are a first-class entity with their own table, not just a type of activity log entry. Activity log records "comment added/edited/deleted" events separately.

**Why:** Comments need edit/delete, markdown content, and potentially threading later. Mixing them into the activity log makes queries and permissions awkward.

### 6. Unified Timeline

The detail page shows one chronological timeline mixing activity log entries and comments. Comments are visually distinct (full content rendered) vs. activity entries (one-line summaries).

**Why:** Users want one place to see "what happened on this item" without switching tabs.

## Non-Goals (Phase 5)

- File/image attachments
- Real-time collaborative editing or live updates
- @mention autocomplete or notifications
- Emoji reactions on comments
- Nested comment threads (replies to replies)
- Bulk editing from detail view
- Rich text WYSIWYG editor (markdown textarea + preview is sufficient)

## RBAC Rules

| Role | Read Detail | Edit Fields | Add Comments | Edit Own Comments | Delete Own Comments |
|------|-------------|-------------|--------------|-------------------|---------------------|
| Viewer | Yes | No | No | No | No |
| Member | Yes | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes | Yes (+ delete any) |
| Owner | Yes | Yes | Yes | Yes | Yes (+ delete any) |

## Success Criteria

1. Click any work item from board or list -> slide-over panel opens with full detail
2. URL updates to `/workspaces/[slug]/projects/[key]/items/[identifier]` when panel opens
3. Direct URL navigation renders the detail panel over the default view
4. Edit title, description, type, priority, assignee, state inline with optimistic UI
5. Description supports markdown with live preview
6. Description edit history shows diffs between versions
7. Add/edit/delete comments with markdown support
8. Unified timeline shows activity + comments chronologically
9. RBAC enforced on all mutations
10. All changes create activity log entries
11. Contract tests cover comment CRUD, permission boundaries, description versioning
