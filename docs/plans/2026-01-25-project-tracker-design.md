# Personal Project Tracker Design

**Date**: 2026-01-25
**Status**: Approved
**Goal**: Manage multiple personal projects in a kanban workflow so you can always see "where each project is, what the next step is, and what to work on today."

## Core Value

- Reduce context switching across many projects
- Enforce Next Action + WIP limits to ensure real progress (not just planning)
- Provide Portfolio Dashboard and Today views for daily execution

## Tech Stack

- **Framework**: Vue 3 (Composition API + `<script setup>`)
- **Styling**: Tailwind CSS + Radix Vue (headless components)
- **Drag-drop**: VueDraggable (SortableJS)
- **Storage**: Dexie.js (IndexedDB wrapper)
- **Routing**: Vue Router

---

## Data Model (Normalized Stores)

### Projects Store
```typescript
interface Project {
  id: string;
  title: string;
  description: string;
  stage: 'Idea' | 'Planning' | 'Active' | 'Paused' | 'Completed' | 'Archived';
  dueDate: string | null;
  tagIds: string[];
  links: { title: string; url: string }[];
  timeEstimate: number | null; // hours
  pinnedDate: string | null;   // YYYY-MM-DD, date-scoped
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

### Tasks Store
Indexed by: `[projectId+status]`, `dueDate`, `pinnedDate`, `status`, `completedAt`

```typescript
interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'Todo' | 'Doing' | 'Blocked' | 'Done';
  dueDate: string | null;
  pinnedDate: string | null;
  position: number;           // 1000-increment gaps
  blockedReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Checklist Items Store
Indexed by: `taskId`

```typescript
interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  completed: boolean;
  position: number;
}
```

### Notes Store
Indexed by: `projectId`

```typescript
interface Note {
  id: string;
  projectId: string;
  content: string;
  type: 'note' | 'decision' | 'linkdump';
  createdAt: string;
  updatedAt: string;
}
```

### Attachments Store
Indexed by: `[entityType+entityId]`

```typescript
interface Attachment {
  id: string;
  entityType: 'project' | 'task';
  entityId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  blob: Blob;
}
```

### Activity Log Store
```typescript
interface ActivityEvent {
  id: string;
  ts: string;
  entityType: 'project' | 'task' | 'checklist' | 'note' | 'attachment';
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
}
```

**Action taxonomy**:
- `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_STAGE_CHANGED`, `PROJECT_PINNED`
- `TASK_CREATED`, `TASK_UPDATED`, `TASK_MOVED`, `TASK_PINNED`, `TASK_BLOCKED`, `TASK_COMPLETED`, `TASK_REOPENED`
- `CHECKLIST_ITEM_CREATED`, `CHECKLIST_ITEM_TOGGLED`
- `ATTACHMENT_ADDED`, `ATTACHMENT_REMOVED`
- `NOTE_ADDED`

### Tag Registry
```typescript
interface Tag {
  id: string;
  name: string;
  color: string | null;
}
```

### Next Action Derivation

Not stored. Computed as:
1. First task by `position` ascending where `status = Doing`
2. Else first task by `position` ascending where `status = Todo`
3. Tie-breaker: `createdAt` ascending

---

## Views & Navigation

### 1. Portfolio Dashboard (default route: `/`)
- Kanban board of **projects** by lifecycle stage
- Columns: Idea → Planning → Active → Paused → Completed
- Archived hidden by default (toggle to show)
- Column headers show WIP: "Active (2/2)"
- Drag-drop to change stage (blocked if WIP exceeded)
- Project cards show: title, next action preview, due date badge, tag chips
- Stage dropdown on cards for non-drag moves

### 2. Today View (`/today`)
- Flat list of **tasks** needing attention today
- Query: `status = Doing` OR `pinnedDate = today` OR `dueDate <= today`
- Grouped by project, sorted by due date then position
- Quick actions: mark done, unpin, open project
- Parent project name as subtle header

### 3. Project Detail View (`/project/:id`)
- Full project metadata (editable)
- Embedded task board: Todo | Doing | Blocked | Done
- Drag-drop tasks between columns (Doing enforces WIP)
- Status dropdown on task cards for non-drag moves
- Notes timeline (append/edit)
- Attachments list
- Activity log (collapsed by default)

### Navigation
- Sidebar: Portfolio, Today, recent projects list
- Click project card → Project Detail

---

## WIP Enforcement & State Transitions

### Default WIP Limits (user-configurable)
```typescript
interface WipLimits {
  projects: {
    Planning: 3;
    Active: 2;
  };
  tasks: {
    Doing: 1; // per project, strict default
  };
}
```

### State Transition Rules

| Transition | Rule | On Violation |
|------------|------|--------------|
| Project → Active | `count(Active) < limit` | Block, toast |
| Project → Planning | `count(Planning) < limit` | Block, toast |
| Task → Doing | `count(Doing in project) < limit` | Block, toast |
| Task → Blocked | `blockedReason` required | Block, open modal focused on blocker field |
| Task → Done | Set `completedAt = now`, log `TASK_COMPLETED` | — |
| Task ← Done | Clear `completedAt`, log `TASK_REOPENED` | — |

### Drag-Drop Behavior

1. `onDragStart` → `policyService.getValidTargets(item)` returns allowed zones
2. Valid zones highlighted, invalid zones muted (opacity + lock icon + `cursor: not-allowed`)
3. `onDrop` → call service mutation
4. If rejected → do nothing; `useLiveQuery` re-renders from persisted state
5. Position rebalance per `(projectId, status)` when gap < 10

### PinnedDate Semantics
- Date-scoped (local timezone)
- Auto-expires at end of day
- Today view shows: `pinnedDate === today` OR `dueDate <= today` OR `status === Doing`

---

## Component Architecture

```
src/
├── App.vue
├── router/
│   └── index.ts
├── views/
│   ├── PortfolioView.vue
│   ├── TodayView.vue
│   └── ProjectDetailView.vue
├── components/
│   ├── ui/
│   │   ├── Button.vue
│   │   ├── Badge.vue
│   │   ├── Modal.vue
│   │   ├── Dropdown.vue
│   │   └── ToastHost.vue
│   ├── layout/
│   │   ├── AppSidebar.vue
│   │   └── AppHeader.vue
│   ├── portfolio/
│   │   ├── StageColumn.vue
│   │   └── ProjectCard.vue
│   ├── project/
│   │   ├── TaskBoard.vue
│   │   ├── TaskColumn.vue
│   │   ├── TaskCard.vue
│   │   ├── NotesTimeline.vue
│   │   └── AttachmentList.vue
│   └── today/
│       ├── TodayTaskList.vue
│       └── TodayTaskItem.vue
├── composables/              (reactive queries only)
│   ├── useProjects.ts
│   ├── useTasks.ts
│   ├── useToday.ts
│   └── useTags.ts
├── services/                 (mutations + policy + transactions)
│   ├── projectService.ts
│   ├── taskService.ts
│   ├── policyService.ts
│   └── activityService.ts
├── db/
│   ├── index.ts
│   ├── schema.ts
│   ├── migrations.ts
│   └── live.ts               (useLiveQuery helper)
└── types/
    ├── project.ts
    ├── task.ts
    ├── checklist.ts
    ├── note.ts
    ├── attachment.ts
    ├── activity.ts
    └── policy.ts
```

### Data Flow
- **Composables**: Wrap Dexie `liveQuery`, expose reactive `Ref<T>`
- **Services**: Authoritative mutations + validation + transactions + activity logging
- **Components**: Call service methods, render from composable state

---

## Settings & Persistence

### Settings (localStorage)
Key: `ppt.settings.v1`

```typescript
interface Settings {
  schemaVersion: number;
  wipLimits: {
    projects: { Planning: number; Active: number };
    tasks: { Doing: number };
  };
  theme: 'light' | 'dark' | 'system';
  defaultProjectStage: 'Idea' | 'Planning';
  archiveCompletedAfterDays: number | null;
}
```

### Export/Import

**Export format**:
```typescript
{
  exportVersion: 1,
  appVersion: string,
  createdAt: string,
  projects: Project[],
  tasks: Task[],
  checklistItems: ChecklistItem[],
  notes: Note[],
  tags: Tag[],
  activity: ActivityEvent[],
  attachments?: { ...Attachment, blob: string }[] // base64, optional
}
```

**Import modes**:
- Replace (MVP): Clear DB, bulkAdd everything
- Merge (future): Upsert by id, resolve conflicts by updatedAt

**Quota handling**:
- Track attachment total size (sum of `size`)
- Warn if exceeds threshold (200MB) or on QuotaExceeded error

---

## Implementation Order

### Phase 1: Foundation
1. Vite + Vue 3 + TypeScript + Tailwind
2. Dexie schema + `useLiveQuery` helper
3. Vue Router (/, /today, /project/:id)
4. Base UI primitives (Button, Badge, Modal, Toast, Dropdown)

### Phase 2: Core Loop (usable without drag-drop)
5. `policyService` (WIP validation, transition rules)
6. `activityService` (event logging helper)
7. Projects store + `projectService` with transactional logging
8. Portfolio view (stage columns + stage dropdown on cards)
9. Tasks store + `taskService` (blockedReason + completedAt logic)
10. Project detail view with task board (status dropdown on cards)

### Phase 3: Interactions
11. VueDraggable integration calling existing services
12. Position strategy + rebalance (gap < 10)
13. Policy-driven drop zone highlighting

### Phase 4: Today & Polish
14. Today view (Doing + due ≤ today + pinnedDate = today)
15. Notes timeline + attachments (with size tracking)
16. Settings view + export/import (Replace mode, optional blob inclusion)
17. Theme support (light/dark/system)
