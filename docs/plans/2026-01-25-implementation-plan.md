# Personal Project Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first kanban app for managing personal projects with WIP limits, task boards, and a Today view.

**Architecture:** Vue 3 SPA with Dexie.js for IndexedDB persistence. Services layer handles policy enforcement and transactional mutations. Composables provide reactive queries via liveQuery wrapper.

**Tech Stack:** Vue 3 (Composition API), TypeScript, Tailwind CSS, Radix Vue, VueDraggable, Dexie.js, Vitest, Vue Router

---

## Phase 1: Foundation

### Task 1: Scaffold Vite + Vue 3 + TypeScript Project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `index.html`

**Step 1: Initialize project with Vite**

Run:
```bash
cd /Users/henry/Documents/project-tracker/.worktrees/implement
npm create vite@latest . -- --template vue-ts
```

Select: Vue, TypeScript

**Step 2: Install dependencies**

Run:
```bash
npm install
```

**Step 3: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Server starts at localhost:5173, shows Vue welcome page

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + Vue 3 + TypeScript project"
```

---

### Task 2: Add Tailwind CSS

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Modify: `src/style.css`

**Step 1: Install Tailwind and dependencies**

Run:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 2: Configure tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 3: Replace src/style.css with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Verify Tailwind works**

Modify `src/App.vue` template to include:
```html
<div class="p-4 bg-blue-500 text-white">Tailwind works!</div>
```

Run: `npm run dev`
Expected: Blue box with white text appears

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Tailwind CSS"
```

---

### Task 3: Add Vitest for Testing

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/__tests__/example.test.ts`

**Step 1: Install Vitest**

Run:
```bash
npm install -D vitest @vue/test-utils happy-dom
```

**Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

**Step 3: Add test script to package.json**

Add to "scripts":
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 4: Write example test**

Create `src/__tests__/example.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('Example', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2)
  })
})
```

**Step 5: Run test to verify setup**

Run: `npm run test:run`
Expected: 1 test passes

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: add Vitest testing framework"
```

---

### Task 4: Add Vue Router

**Files:**
- Modify: `package.json`
- Create: `src/router/index.ts`
- Modify: `src/main.ts`
- Modify: `src/App.vue`
- Create: `src/views/PortfolioView.vue`
- Create: `src/views/TodayView.vue`
- Create: `src/views/ProjectDetailView.vue`

**Step 1: Install Vue Router**

Run:
```bash
npm install vue-router@4
```

**Step 2: Create router/index.ts**

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import PortfolioView from '@/views/PortfolioView.vue'
import TodayView from '@/views/TodayView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'

const routes = [
  { path: '/', name: 'portfolio', component: PortfolioView },
  { path: '/today', name: 'today', component: TodayView },
  { path: '/project/:id', name: 'project', component: ProjectDetailView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
```

**Step 3: Create placeholder views**

Create `src/views/PortfolioView.vue`:
```vue
<script setup lang="ts">
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Portfolio</h1>
  </div>
</template>
```

Create `src/views/TodayView.vue`:
```vue
<script setup lang="ts">
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Today</h1>
  </div>
</template>
```

Create `src/views/ProjectDetailView.vue`:
```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Project {{ route.params.id }}</h1>
  </div>
</template>
```

**Step 4: Update main.ts to use router**

```typescript
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
```

**Step 5: Update App.vue to use RouterView**

```vue
<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <nav class="bg-white shadow p-4 flex gap-4">
      <RouterLink to="/" class="text-blue-600 hover:underline">Portfolio</RouterLink>
      <RouterLink to="/today" class="text-blue-600 hover:underline">Today</RouterLink>
    </nav>
    <RouterView />
  </div>
</template>
```

**Step 6: Add path alias to vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 7: Add path alias to tsconfig.json**

Add to compilerOptions:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["src/*"]
}
```

**Step 8: Verify routes work**

Run: `npm run dev`
- Navigate to `/` - shows "Portfolio"
- Navigate to `/today` - shows "Today"
- Navigate to `/project/123` - shows "Project 123"

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Vue Router with Portfolio, Today, and Project routes"
```

---

### Task 5: Set Up Dexie.js with Schema

**Files:**
- Modify: `package.json`
- Create: `src/types/project.ts`
- Create: `src/types/task.ts`
- Create: `src/types/checklist.ts`
- Create: `src/types/note.ts`
- Create: `src/types/attachment.ts`
- Create: `src/types/activity.ts`
- Create: `src/types/tag.ts`
- Create: `src/db/index.ts`
- Create: `src/db/schema.ts`
- Create: `src/__tests__/db/schema.test.ts`

**Step 1: Install Dexie**

Run:
```bash
npm install dexie
```

**Step 2: Create type definitions**

Create `src/types/project.ts`:
```typescript
export type ProjectStage = 'Idea' | 'Planning' | 'Active' | 'Paused' | 'Completed' | 'Archived'

export interface Project {
  id: string
  title: string
  description: string
  stage: ProjectStage
  dueDate: string | null
  tagIds: string[]
  links: { title: string; url: string }[]
  timeEstimate: number | null
  pinnedDate: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

Create `src/types/task.ts`:
```typescript
export type TaskStatus = 'Todo' | 'Doing' | 'Blocked' | 'Done'

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  dueDate: string | null
  pinnedDate: string | null
  position: number
  blockedReason: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
```

Create `src/types/checklist.ts`:
```typescript
export interface ChecklistItem {
  id: string
  taskId: string
  text: string
  completed: boolean
  position: number
}
```

Create `src/types/note.ts`:
```typescript
export type NoteType = 'note' | 'decision' | 'linkdump'

export interface Note {
  id: string
  projectId: string
  content: string
  type: NoteType
  createdAt: string
  updatedAt: string
}
```

Create `src/types/attachment.ts`:
```typescript
export type AttachmentEntityType = 'project' | 'task'

export interface Attachment {
  id: string
  entityType: AttachmentEntityType
  entityId: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
  blob: Blob
}
```

Create `src/types/activity.ts`:
```typescript
export type ActivityEntityType = 'project' | 'task' | 'checklist' | 'note' | 'attachment'

export type ActivityAction =
  | 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'PROJECT_STAGE_CHANGED' | 'PROJECT_PINNED'
  | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_MOVED' | 'TASK_PINNED' | 'TASK_BLOCKED' | 'TASK_COMPLETED' | 'TASK_REOPENED'
  | 'CHECKLIST_ITEM_CREATED' | 'CHECKLIST_ITEM_TOGGLED'
  | 'ATTACHMENT_ADDED' | 'ATTACHMENT_REMOVED'
  | 'NOTE_ADDED'

export interface ActivityEvent {
  id: string
  ts: string
  entityType: ActivityEntityType
  entityId: string
  action: ActivityAction
  payload: Record<string, unknown>
}
```

Create `src/types/tag.ts`:
```typescript
export interface Tag {
  id: string
  name: string
  color: string | null
}
```

**Step 3: Create Dexie database schema**

Create `src/db/schema.ts`:
```typescript
import Dexie, { type Table } from 'dexie'
import type { Project } from '@/types/project'
import type { Task } from '@/types/task'
import type { ChecklistItem } from '@/types/checklist'
import type { Note } from '@/types/note'
import type { Attachment } from '@/types/attachment'
import type { ActivityEvent } from '@/types/activity'
import type { Tag } from '@/types/tag'

export class ProjectTrackerDB extends Dexie {
  projects!: Table<Project>
  tasks!: Table<Task>
  checklistItems!: Table<ChecklistItem>
  notes!: Table<Note>
  attachments!: Table<Attachment>
  activity!: Table<ActivityEvent>
  tags!: Table<Tag>

  constructor() {
    super('ProjectTrackerDB')
    this.version(1).stores({
      projects: 'id, stage, sortOrder, pinnedDate, dueDate',
      tasks: 'id, projectId, [projectId+status], status, dueDate, pinnedDate, completedAt',
      checklistItems: 'id, taskId',
      notes: 'id, projectId',
      attachments: 'id, [entityType+entityId]',
      activity: 'id, ts, entityType, entityId',
      tags: 'id, name',
    })
  }
}
```

Create `src/db/index.ts`:
```typescript
import { ProjectTrackerDB } from './schema'

export const db = new ProjectTrackerDB()
```

**Step 4: Write test for database schema**

Create `src/__tests__/db/schema.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ProjectTrackerDB } from '@/db/schema'

describe('ProjectTrackerDB', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  it('should create all tables', async () => {
    expect(db.projects).toBeDefined()
    expect(db.tasks).toBeDefined()
    expect(db.checklistItems).toBeDefined()
    expect(db.notes).toBeDefined()
    expect(db.attachments).toBeDefined()
    expect(db.activity).toBeDefined()
    expect(db.tags).toBeDefined()
  })

  it('should store and retrieve a project', async () => {
    const project = {
      id: 'proj-1',
      title: 'Test Project',
      description: 'A test project',
      stage: 'Idea' as const,
      dueDate: null,
      tagIds: [],
      links: [],
      timeEstimate: null,
      pinnedDate: null,
      sortOrder: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await db.projects.add(project)
    const retrieved = await db.projects.get('proj-1')

    expect(retrieved).toEqual(project)
  })

  it('should query tasks by projectId and status', async () => {
    const task1 = {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Task 1',
      description: '',
      status: 'Todo' as const,
      dueDate: null,
      pinnedDate: null,
      position: 1000,
      blockedReason: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const task2 = {
      ...task1,
      id: 'task-2',
      title: 'Task 2',
      status: 'Doing' as const,
      position: 2000,
    }

    await db.tasks.bulkAdd([task1, task2])

    const doingTasks = await db.tasks
      .where('[projectId+status]')
      .equals(['proj-1', 'Doing'])
      .toArray()

    expect(doingTasks).toHaveLength(1)
    expect(doingTasks[0].title).toBe('Task 2')
  })
})
```

**Step 5: Run tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Dexie database schema with all stores and indexes"
```

---

### Task 6: Create useLiveQuery Helper

**Files:**
- Create: `src/db/live.ts`
- Create: `src/__tests__/db/live.test.ts`

**Step 1: Install fake-indexeddb for testing**

Run:
```bash
npm install -D fake-indexeddb
```

**Step 2: Write failing test for useLiveQuery**

Create `src/__tests__/db/live.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { ProjectTrackerDB } from '@/db/schema'
import { useLiveQuery } from '@/db/live'
import 'fake-indexeddb/auto'

describe('useLiveQuery', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  it('should return reactive data from query', async () => {
    const project = {
      id: 'proj-1',
      title: 'Test Project',
      description: '',
      stage: 'Idea' as const,
      dueDate: null,
      tagIds: [],
      links: [],
      timeEstimate: null,
      pinnedDate: null,
      sortOrder: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await db.projects.add(project)

    const result = useLiveQuery(() => db.projects.toArray(), { initialValue: [] })

    // Wait for query to resolve
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(result.value).toHaveLength(1)
    expect(result.value[0].title).toBe('Test Project')
  })
})
```

**Step 3: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - useLiveQuery not found

**Step 4: Implement useLiveQuery**

Create `src/db/live.ts`:
```typescript
import { ref, onUnmounted, type Ref } from 'vue'
import { liveQuery, type Subscription } from 'dexie'

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  options: { initialValue: T }
): Ref<T> {
  const result = ref<T>(options.initialValue) as Ref<T>
  let subscription: Subscription | null = null

  const observable = liveQuery(querier)

  subscription = observable.subscribe({
    next: (value) => {
      result.value = value
    },
    error: (error) => {
      console.error('useLiveQuery error:', error)
    },
  })

  onUnmounted(() => {
    subscription?.unsubscribe()
  })

  return result
}
```

**Step 5: Run test to verify it passes**

Run: `npm run test:run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add useLiveQuery helper for reactive Dexie queries"
```

---

### Task 7: Create Base UI Components

**Files:**
- Create: `src/components/ui/Button.vue`
- Create: `src/components/ui/Badge.vue`
- Create: `src/components/ui/Modal.vue`
- Create: `src/components/ui/Dropdown.vue`
- Create: `src/components/ui/Toast.vue`
- Create: `src/components/ui/ToastHost.vue`
- Create: `src/composables/useToast.ts`
- Create: `src/__tests__/components/ui/Button.test.ts`

**Step 1: Install Radix Vue**

Run:
```bash
npm install radix-vue
```

**Step 2: Create Button component**

Create `src/components/ui/Button.vue`:
```vue
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
})

const variantClasses = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 disabled:text-gray-300',
}

const sizeClasses = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}
</script>

<template>
  <button
    :class="[
      'rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
      variantClasses[props.variant],
      sizeClasses[props.size],
    ]"
    :disabled="props.disabled"
  >
    <slot />
  </button>
</template>
```

**Step 3: Create Badge component**

Create `src/components/ui/Badge.vue`:
```vue
<script setup lang="ts">
interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const variantClasses = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      variantClasses[props.variant],
    ]"
  >
    <slot />
  </span>
</template>
```

**Step 4: Create Modal component using Radix**

Create `src/components/ui/Modal.vue`:
```vue
<script setup lang="ts">
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'radix-vue'

interface Props {
  open?: boolean
  title?: string
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/50 z-40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-50 focus:outline-none"
      >
        <DialogTitle v-if="props.title" class="text-lg font-semibold mb-2">
          {{ props.title }}
        </DialogTitle>
        <DialogDescription v-if="props.description" class="text-gray-600 mb-4">
          {{ props.description }}
        </DialogDescription>
        <slot />
        <DialogClose
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
```

**Step 5: Create Dropdown component using Radix**

Create `src/components/ui/Dropdown.vue`:
```vue
<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'radix-vue'

interface MenuItem {
  label: string
  value: string
  disabled?: boolean
}

interface Props {
  items: MenuItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  select: [value: string]
}>()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[160px] z-50"
        :side-offset="5"
      >
        <DropdownMenuItem
          v-for="item in items"
          :key="item.value"
          :disabled="item.disabled"
          class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          @select="emit('select', item.value)"
        >
          {{ item.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
```

**Step 6: Create Toast system**

Create `src/composables/useToast.ts`:
```typescript
import { ref } from 'vue'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const toasts = ref<Toast[]>([])

export function useToast() {
  function showToast(message: string, type: Toast['type'] = 'info', duration = 3000) {
    const id = crypto.randomUUID()
    const toast: Toast = { id, message, type, duration }
    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  function removeToast(id: string) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    showToast,
    removeToast,
    success: (msg: string) => showToast(msg, 'success'),
    error: (msg: string) => showToast(msg, 'error'),
    warning: (msg: string) => showToast(msg, 'warning'),
    info: (msg: string) => showToast(msg, 'info'),
  }
}
```

Create `src/components/ui/Toast.vue`:
```vue
<script setup lang="ts">
import type { Toast } from '@/composables/useToast'

interface Props {
  toast: Toast
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const typeClasses = {
  success: 'bg-green-50 border-green-500 text-green-800',
  error: 'bg-red-50 border-red-500 text-red-800',
  warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
  info: 'bg-blue-50 border-blue-500 text-blue-800',
}
</script>

<template>
  <div
    :class="[
      'flex items-center justify-between p-4 rounded-lg border-l-4 shadow-md',
      typeClasses[toast.type],
    ]"
  >
    <span>{{ toast.message }}</span>
    <button
      class="ml-4 text-current opacity-50 hover:opacity-100"
      @click="emit('close')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
```

Create `src/components/ui/ToastHost.vue`:
```vue
<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import Toast from './Toast.vue'

const { toasts, removeToast } = useToast()
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    <TransitionGroup name="toast">
      <Toast
        v-for="toast in toasts"
        :key="toast.id"
        :toast="toast"
        @close="removeToast(toast.id)"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
```

**Step 7: Write Button test**

Create `src/__tests__/components/ui/Button.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '@/components/ui/Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click me',
      },
    })
    expect(wrapper.text()).toBe('Click me')
  })

  it('applies variant classes', () => {
    const wrapper = mount(Button, {
      props: { variant: 'danger' },
      slots: { default: 'Delete' },
    })
    expect(wrapper.classes()).toContain('bg-red-600')
  })

  it('disables when disabled prop is true', () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
      slots: { default: 'Disabled' },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

**Step 8: Run tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 9: Add ToastHost to App.vue**

Update `src/App.vue`:
```vue
<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import ToastHost from '@/components/ui/ToastHost.vue'
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <nav class="bg-white shadow p-4 flex gap-4">
      <RouterLink to="/" class="text-blue-600 hover:underline">Portfolio</RouterLink>
      <RouterLink to="/today" class="text-blue-600 hover:underline">Today</RouterLink>
    </nav>
    <RouterView />
    <ToastHost />
  </div>
</template>
```

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: add base UI components (Button, Badge, Modal, Dropdown, Toast)"
```

---

## Phase 2: Core Loop

### Task 8: Create policyService

**Files:**
- Create: `src/types/policy.ts`
- Create: `src/services/policyService.ts`
- Create: `src/__tests__/services/policyService.test.ts`

**Step 1: Write failing test for policyService**

Create `src/types/policy.ts`:
```typescript
export interface WipLimits {
  projects: {
    Planning: number
    Active: number
  }
  tasks: {
    Doing: number
  }
}

export const DEFAULT_WIP_LIMITS: WipLimits = {
  projects: {
    Planning: 3,
    Active: 2,
  },
  tasks: {
    Doing: 1,
  },
}
```

Create `src/__tests__/services/policyService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { policyService } from '@/services/policyService'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import type { Project } from '@/types/project'
import type { Task } from '@/types/task'

describe('policyService', () => {
  const makeProject = (overrides: Partial<Project> = {}): Project => ({
    id: crypto.randomUUID(),
    title: 'Test Project',
    description: '',
    stage: 'Idea',
    dueDate: null,
    tagIds: [],
    links: [],
    timeEstimate: null,
    pinnedDate: null,
    sortOrder: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: crypto.randomUUID(),
    projectId: 'proj-1',
    title: 'Test Task',
    description: '',
    status: 'Todo',
    dueDate: null,
    pinnedDate: null,
    position: 1000,
    blockedReason: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  describe('canMoveProjectToStage', () => {
    it('allows moving to Idea (no limit)', () => {
      const projects: Project[] = []
      const result = policyService.canMoveProjectToStage(projects, 'Idea', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(true)
    })

    it('blocks moving to Active when at limit', () => {
      const projects = [
        makeProject({ stage: 'Active' }),
        makeProject({ stage: 'Active' }),
      ]
      const result = policyService.canMoveProjectToStage(projects, 'Active', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Active')
    })

    it('allows moving to Active when under limit', () => {
      const projects = [makeProject({ stage: 'Active' })]
      const result = policyService.canMoveProjectToStage(projects, 'Active', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(true)
    })
  })

  describe('canMoveTaskToStatus', () => {
    it('allows moving to Todo (no limit)', () => {
      const tasks: Task[] = []
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Todo', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(true)
    })

    it('blocks moving to Doing when at limit', () => {
      const tasks = [makeTask({ status: 'Doing', projectId: 'proj-1' })]
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Doing', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(false)
    })

    it('requires blockedReason for Blocked status', () => {
      const tasks: Task[] = []
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Blocked', DEFAULT_WIP_LIMITS, null)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('reason')
    })

    it('allows Blocked with reason', () => {
      const tasks: Task[] = []
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Blocked', DEFAULT_WIP_LIMITS, 'Waiting on API')
      expect(result.allowed).toBe(true)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - policyService not found

**Step 3: Implement policyService**

Create `src/services/policyService.ts`:
```typescript
import type { Project, ProjectStage } from '@/types/project'
import type { Task, TaskStatus } from '@/types/task'
import type { WipLimits } from '@/types/policy'

export interface PolicyResult {
  allowed: boolean
  reason?: string
}

function canMoveProjectToStage(
  allProjects: Project[],
  targetStage: ProjectStage,
  limits: WipLimits,
  excludeProjectId?: string
): PolicyResult {
  const limitedStages: (keyof WipLimits['projects'])[] = ['Planning', 'Active']

  if (!limitedStages.includes(targetStage as keyof WipLimits['projects'])) {
    return { allowed: true }
  }

  const limit = limits.projects[targetStage as keyof WipLimits['projects']]
  const currentCount = allProjects.filter(
    p => p.stage === targetStage && p.id !== excludeProjectId
  ).length

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `${targetStage} limit reached (${currentCount}/${limit}). Finish or pause a project first.`,
    }
  }

  return { allowed: true }
}

function canMoveTaskToStatus(
  projectTasks: Task[],
  projectId: string,
  targetStatus: TaskStatus,
  limits: WipLimits,
  blockedReason?: string | null,
  excludeTaskId?: string
): PolicyResult {
  if (targetStatus === 'Blocked') {
    if (!blockedReason || blockedReason.trim() === '') {
      return {
        allowed: false,
        reason: 'A blocked reason is required to move to Blocked status.',
      }
    }
  }

  if (targetStatus === 'Doing') {
    const limit = limits.tasks.Doing
    const currentCount = projectTasks.filter(
      t => t.projectId === projectId && t.status === 'Doing' && t.id !== excludeTaskId
    ).length

    if (currentCount >= limit) {
      return {
        allowed: false,
        reason: `Doing limit reached (${currentCount}/${limit}). Complete a task first.`,
      }
    }
  }

  return { allowed: true }
}

function getValidProjectStages(
  allProjects: Project[],
  limits: WipLimits,
  excludeProjectId?: string
): ProjectStage[] {
  const allStages: ProjectStage[] = ['Idea', 'Planning', 'Active', 'Paused', 'Completed', 'Archived']

  return allStages.filter(stage => {
    const result = canMoveProjectToStage(allProjects, stage, limits, excludeProjectId)
    return result.allowed
  })
}

function getValidTaskStatuses(
  projectTasks: Task[],
  projectId: string,
  limits: WipLimits,
  excludeTaskId?: string
): TaskStatus[] {
  const allStatuses: TaskStatus[] = ['Todo', 'Doing', 'Blocked', 'Done']

  return allStatuses.filter(status => {
    // Blocked always needs a reason, so we exclude it from "valid" until reason is provided
    if (status === 'Blocked') return true // Allow in list, will prompt for reason

    const result = canMoveTaskToStatus(projectTasks, projectId, status, limits, null, excludeTaskId)
    return result.allowed
  })
}

export const policyService = {
  canMoveProjectToStage,
  canMoveTaskToStatus,
  getValidProjectStages,
  getValidTaskStatuses,
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add policyService for WIP enforcement and transition rules"
```

---

### Task 9: Create activityService

**Files:**
- Create: `src/services/activityService.ts`
- Create: `src/__tests__/services/activityService.test.ts`

**Step 1: Write failing test**

Create `src/__tests__/services/activityService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { activityService } from '@/services/activityService'
import { ProjectTrackerDB } from '@/db/schema'
import 'fake-indexeddb/auto'

describe('activityService', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  it('logs a project created event', async () => {
    await activityService.logProjectCreated(db, 'proj-1', { title: 'Test Project' })

    const events = await db.activity.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('PROJECT_CREATED')
    expect(events[0].entityType).toBe('project')
    expect(events[0].entityId).toBe('proj-1')
  })

  it('logs a task moved event', async () => {
    await activityService.logTaskMoved(db, 'task-1', 'Todo', 'Doing')

    const events = await db.activity.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('TASK_MOVED')
    expect(events[0].payload).toEqual({ from: 'Todo', to: 'Doing' })
  })

  it('logs task completed with completedAt', async () => {
    await activityService.logTaskCompleted(db, 'task-1')

    const events = await db.activity.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('TASK_COMPLETED')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - activityService not found

**Step 3: Implement activityService**

Create `src/services/activityService.ts`:
```typescript
import type { ProjectTrackerDB } from '@/db/schema'
import type { ActivityAction, ActivityEntityType, ActivityEvent } from '@/types/activity'

function createEvent(
  entityType: ActivityEntityType,
  entityId: string,
  action: ActivityAction,
  payload: Record<string, unknown> = {}
): Omit<ActivityEvent, 'id'> {
  return {
    ts: new Date().toISOString(),
    entityType,
    entityId,
    action,
    payload,
  }
}

async function log(
  db: ProjectTrackerDB,
  entityType: ActivityEntityType,
  entityId: string,
  action: ActivityAction,
  payload: Record<string, unknown> = {}
): Promise<string> {
  const event = {
    id: crypto.randomUUID(),
    ...createEvent(entityType, entityId, action, payload),
  }
  await db.activity.add(event)
  return event.id
}

// Project events
async function logProjectCreated(
  db: ProjectTrackerDB,
  projectId: string,
  payload: Record<string, unknown>
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_CREATED', payload)
}

async function logProjectUpdated(
  db: ProjectTrackerDB,
  projectId: string,
  changes: Record<string, unknown>
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_UPDATED', changes)
}

async function logProjectStageChanged(
  db: ProjectTrackerDB,
  projectId: string,
  from: string,
  to: string
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_STAGE_CHANGED', { from, to })
}

async function logProjectPinned(
  db: ProjectTrackerDB,
  projectId: string,
  pinnedDate: string | null
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_PINNED', { pinnedDate })
}

// Task events
async function logTaskCreated(
  db: ProjectTrackerDB,
  taskId: string,
  payload: Record<string, unknown>
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_CREATED', payload)
}

async function logTaskUpdated(
  db: ProjectTrackerDB,
  taskId: string,
  changes: Record<string, unknown>
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_UPDATED', changes)
}

async function logTaskMoved(
  db: ProjectTrackerDB,
  taskId: string,
  from: string,
  to: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_MOVED', { from, to })
}

async function logTaskPinned(
  db: ProjectTrackerDB,
  taskId: string,
  pinnedDate: string | null
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_PINNED', { pinnedDate })
}

async function logTaskBlocked(
  db: ProjectTrackerDB,
  taskId: string,
  reason: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_BLOCKED', { reason })
}

async function logTaskCompleted(
  db: ProjectTrackerDB,
  taskId: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_COMPLETED', {})
}

async function logTaskReopened(
  db: ProjectTrackerDB,
  taskId: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_REOPENED', {})
}

// Checklist events
async function logChecklistItemCreated(
  db: ProjectTrackerDB,
  itemId: string,
  taskId: string
): Promise<string> {
  return log(db, 'checklist', itemId, 'CHECKLIST_ITEM_CREATED', { taskId })
}

async function logChecklistItemToggled(
  db: ProjectTrackerDB,
  itemId: string,
  completed: boolean
): Promise<string> {
  return log(db, 'checklist', itemId, 'CHECKLIST_ITEM_TOGGLED', { completed })
}

// Attachment events
async function logAttachmentAdded(
  db: ProjectTrackerDB,
  attachmentId: string,
  entityType: string,
  entityId: string,
  filename: string
): Promise<string> {
  return log(db, 'attachment', attachmentId, 'ATTACHMENT_ADDED', { entityType, entityId, filename })
}

async function logAttachmentRemoved(
  db: ProjectTrackerDB,
  attachmentId: string
): Promise<string> {
  return log(db, 'attachment', attachmentId, 'ATTACHMENT_REMOVED', {})
}

// Note events
async function logNoteAdded(
  db: ProjectTrackerDB,
  noteId: string,
  projectId: string
): Promise<string> {
  return log(db, 'note', noteId, 'NOTE_ADDED', { projectId })
}

export const activityService = {
  log,
  logProjectCreated,
  logProjectUpdated,
  logProjectStageChanged,
  logProjectPinned,
  logTaskCreated,
  logTaskUpdated,
  logTaskMoved,
  logTaskPinned,
  logTaskBlocked,
  logTaskCompleted,
  logTaskReopened,
  logChecklistItemCreated,
  logChecklistItemToggled,
  logAttachmentAdded,
  logAttachmentRemoved,
  logNoteAdded,
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add activityService for transactional event logging"
```

---

### Task 10: Create projectService with CRUD

**Files:**
- Create: `src/services/projectService.ts`
- Create: `src/__tests__/services/projectService.test.ts`

**Step 1: Write failing test**

Create `src/__tests__/services/projectService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { projectService } from '@/services/projectService'
import { ProjectTrackerDB } from '@/db/schema'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import 'fake-indexeddb/auto'

describe('projectService', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  describe('createProject', () => {
    it('creates a project and logs activity', async () => {
      const project = await projectService.createProject(db, {
        title: 'Test Project',
        description: 'A test',
      })

      expect(project.id).toBeDefined()
      expect(project.title).toBe('Test Project')
      expect(project.stage).toBe('Idea')

      const stored = await db.projects.get(project.id)
      expect(stored).toEqual(project)

      const activity = await db.activity.toArray()
      expect(activity).toHaveLength(1)
      expect(activity[0].action).toBe('PROJECT_CREATED')
    })
  })

  describe('updateProject', () => {
    it('updates project fields and logs activity', async () => {
      const project = await projectService.createProject(db, { title: 'Original' })

      const updated = await projectService.updateProject(db, project.id, {
        title: 'Updated',
        description: 'New description',
      })

      expect(updated.title).toBe('Updated')
      expect(updated.description).toBe('New description')

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'PROJECT_UPDATED')).toBe(true)
    })
  })

  describe('changeProjectStage', () => {
    it('changes stage when allowed and logs activity', async () => {
      const project = await projectService.createProject(db, { title: 'Test' })

      const updated = await projectService.changeProjectStage(
        db,
        project.id,
        'Active',
        DEFAULT_WIP_LIMITS
      )

      expect(updated.stage).toBe('Active')

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'PROJECT_STAGE_CHANGED')).toBe(true)
    })

    it('throws when WIP limit exceeded', async () => {
      await projectService.createProject(db, { title: 'Active 1', stage: 'Active' })
      await projectService.createProject(db, { title: 'Active 2', stage: 'Active' })
      const project = await projectService.createProject(db, { title: 'Idea' })

      await expect(
        projectService.changeProjectStage(db, project.id, 'Active', DEFAULT_WIP_LIMITS)
      ).rejects.toThrow(/limit/)
    })
  })

  describe('deleteProject', () => {
    it('deletes project and related tasks', async () => {
      const project = await projectService.createProject(db, { title: 'Test' })
      await db.tasks.add({
        id: 'task-1',
        projectId: project.id,
        title: 'Task',
        description: '',
        status: 'Todo',
        dueDate: null,
        pinnedDate: null,
        position: 1000,
        blockedReason: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await projectService.deleteProject(db, project.id)

      const projects = await db.projects.toArray()
      const tasks = await db.tasks.toArray()

      expect(projects).toHaveLength(0)
      expect(tasks).toHaveLength(0)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - projectService not found

**Step 3: Implement projectService**

Create `src/services/projectService.ts`:
```typescript
import type { ProjectTrackerDB } from '@/db/schema'
import type { Project, ProjectStage } from '@/types/project'
import type { WipLimits } from '@/types/policy'
import { policyService } from './policyService'
import { activityService } from './activityService'

interface CreateProjectInput {
  title: string
  description?: string
  stage?: ProjectStage
  dueDate?: string | null
  tagIds?: string[]
  links?: { title: string; url: string }[]
  timeEstimate?: number | null
}

async function createProject(
  db: ProjectTrackerDB,
  input: CreateProjectInput
): Promise<Project> {
  const now = new Date().toISOString()
  const maxSortOrder = await db.projects.orderBy('sortOrder').last()

  const project: Project = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description ?? '',
    stage: input.stage ?? 'Idea',
    dueDate: input.dueDate ?? null,
    tagIds: input.tagIds ?? [],
    links: input.links ?? [],
    timeEstimate: input.timeEstimate ?? null,
    pinnedDate: null,
    sortOrder: (maxSortOrder?.sortOrder ?? 0) + 1000,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.add(project)
    await activityService.logProjectCreated(db, project.id, { title: project.title })
  })

  return project
}

async function updateProject(
  db: ProjectTrackerDB,
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Project> {
  const project = await db.projects.get(projectId)
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const updated: Project = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.put(updated)
    await activityService.logProjectUpdated(db, projectId, updates)
  })

  return updated
}

async function changeProjectStage(
  db: ProjectTrackerDB,
  projectId: string,
  newStage: ProjectStage,
  limits: WipLimits
): Promise<Project> {
  const project = await db.projects.get(projectId)
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const allProjects = await db.projects.toArray()
  const policyResult = policyService.canMoveProjectToStage(allProjects, newStage, limits, projectId)

  if (!policyResult.allowed) {
    throw new Error(policyResult.reason)
  }

  const oldStage = project.stage
  const updated: Project = {
    ...project,
    stage: newStage,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.put(updated)
    await activityService.logProjectStageChanged(db, projectId, oldStage, newStage)
  })

  return updated
}

async function pinProject(
  db: ProjectTrackerDB,
  projectId: string,
  pinnedDate: string | null
): Promise<Project> {
  const project = await db.projects.get(projectId)
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const updated: Project = {
    ...project,
    pinnedDate,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.put(updated)
    await activityService.logProjectPinned(db, projectId, pinnedDate)
  })

  return updated
}

async function deleteProject(
  db: ProjectTrackerDB,
  projectId: string
): Promise<void> {
  await db.transaction('rw', [db.projects, db.tasks, db.checklistItems, db.notes, db.attachments], async () => {
    // Get all tasks for this project
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    const taskIds = tasks.map(t => t.id)

    // Delete checklist items for all tasks
    for (const taskId of taskIds) {
      await db.checklistItems.where('taskId').equals(taskId).delete()
    }

    // Delete tasks
    await db.tasks.where('projectId').equals(projectId).delete()

    // Delete notes
    await db.notes.where('projectId').equals(projectId).delete()

    // Delete attachments for project
    await db.attachments
      .where('[entityType+entityId]')
      .equals(['project', projectId])
      .delete()

    // Delete attachments for tasks
    for (const taskId of taskIds) {
      await db.attachments
        .where('[entityType+entityId]')
        .equals(['task', taskId])
        .delete()
    }

    // Delete project
    await db.projects.delete(projectId)
  })
}

async function getProject(db: ProjectTrackerDB, projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId)
}

async function getAllProjects(db: ProjectTrackerDB): Promise<Project[]> {
  return db.projects.orderBy('sortOrder').toArray()
}

async function getProjectsByStage(db: ProjectTrackerDB, stage: ProjectStage): Promise<Project[]> {
  return db.projects.where('stage').equals(stage).sortBy('sortOrder')
}

export const projectService = {
  createProject,
  updateProject,
  changeProjectStage,
  pinProject,
  deleteProject,
  getProject,
  getAllProjects,
  getProjectsByStage,
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add projectService with CRUD and transactional logging"
```

---

### Task 11: Create taskService with CRUD

**Files:**
- Create: `src/services/taskService.ts`
- Create: `src/__tests__/services/taskService.test.ts`

**Step 1: Write failing test**

Create `src/__tests__/services/taskService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { taskService } from '@/services/taskService'
import { ProjectTrackerDB } from '@/db/schema'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import 'fake-indexeddb/auto'

describe('taskService', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  describe('createTask', () => {
    it('creates a task and logs activity', async () => {
      const task = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Test Task',
      })

      expect(task.id).toBeDefined()
      expect(task.title).toBe('Test Task')
      expect(task.status).toBe('Todo')
      expect(task.position).toBe(1000)

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'TASK_CREATED')).toBe(true)
    })
  })

  describe('moveTask', () => {
    it('moves task to new status and logs activity', async () => {
      const task = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Test',
      })

      const moved = await taskService.moveTask(
        db,
        task.id,
        'Doing',
        DEFAULT_WIP_LIMITS
      )

      expect(moved.status).toBe('Doing')

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'TASK_MOVED')).toBe(true)
    })

    it('sets completedAt when moving to Done', async () => {
      const task = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Test',
      })

      const done = await taskService.moveTask(db, task.id, 'Done', DEFAULT_WIP_LIMITS)

      expect(done.completedAt).toBeDefined()

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'TASK_COMPLETED')).toBe(true)
    })

    it('clears completedAt when reopening from Done', async () => {
      const task = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Test',
      })
      await taskService.moveTask(db, task.id, 'Done', DEFAULT_WIP_LIMITS)

      const reopened = await taskService.moveTask(db, task.id, 'Todo', DEFAULT_WIP_LIMITS)

      expect(reopened.completedAt).toBeNull()

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'TASK_REOPENED')).toBe(true)
    })

    it('throws when Doing limit exceeded', async () => {
      await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Doing 1',
        status: 'Doing',
      })

      const task = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Todo',
      })

      await expect(
        taskService.moveTask(db, task.id, 'Doing', DEFAULT_WIP_LIMITS)
      ).rejects.toThrow(/limit/)
    })

    it('requires blockedReason for Blocked status', async () => {
      const task = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Test',
      })

      await expect(
        taskService.moveTask(db, task.id, 'Blocked', DEFAULT_WIP_LIMITS)
      ).rejects.toThrow(/reason/)
    })

    it('allows Blocked with reason', async () => {
      const task = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Test',
      })

      const blocked = await taskService.moveTask(
        db,
        task.id,
        'Blocked',
        DEFAULT_WIP_LIMITS,
        undefined,
        'Waiting on API'
      )

      expect(blocked.status).toBe('Blocked')
      expect(blocked.blockedReason).toBe('Waiting on API')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run`
Expected: FAIL - taskService not found

**Step 3: Implement taskService**

Create `src/services/taskService.ts`:
```typescript
import type { ProjectTrackerDB } from '@/db/schema'
import type { Task, TaskStatus } from '@/types/task'
import type { WipLimits } from '@/types/policy'
import { policyService } from './policyService'
import { activityService } from './activityService'

interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  status?: TaskStatus
  dueDate?: string | null
}

async function createTask(
  db: ProjectTrackerDB,
  input: CreateTaskInput
): Promise<Task> {
  const now = new Date().toISOString()

  // Get max position for this project and status
  const existingTasks = await db.tasks
    .where('[projectId+status]')
    .equals([input.projectId, input.status ?? 'Todo'])
    .toArray()

  const maxPosition = existingTasks.reduce((max, t) => Math.max(max, t.position), 0)

  const task: Task = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    title: input.title,
    description: input.description ?? '',
    status: input.status ?? 'Todo',
    dueDate: input.dueDate ?? null,
    pinnedDate: null,
    position: maxPosition + 1000,
    blockedReason: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', [db.tasks, db.activity], async () => {
    await db.tasks.add(task)
    await activityService.logTaskCreated(db, task.id, { title: task.title, projectId: task.projectId })
  })

  return task
}

async function updateTask(
  db: ProjectTrackerDB,
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
): Promise<Task> {
  const task = await db.tasks.get(taskId)
  if (!task) {
    throw new Error(`Task ${taskId} not found`)
  }

  const updated: Task = {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.tasks, db.activity], async () => {
    await db.tasks.put(updated)
    await activityService.logTaskUpdated(db, taskId, updates)
  })

  return updated
}

async function moveTask(
  db: ProjectTrackerDB,
  taskId: string,
  newStatus: TaskStatus,
  limits: WipLimits,
  newPosition?: number,
  blockedReason?: string
): Promise<Task> {
  const task = await db.tasks.get(taskId)
  if (!task) {
    throw new Error(`Task ${taskId} not found`)
  }

  const projectTasks = await db.tasks.where('projectId').equals(task.projectId).toArray()
  const policyResult = policyService.canMoveTaskToStatus(
    projectTasks,
    task.projectId,
    newStatus,
    limits,
    blockedReason,
    taskId
  )

  if (!policyResult.allowed) {
    throw new Error(policyResult.reason)
  }

  const oldStatus = task.status
  const now = new Date().toISOString()

  // Calculate new position if not provided
  let position = newPosition
  if (position === undefined) {
    const targetTasks = await db.tasks
      .where('[projectId+status]')
      .equals([task.projectId, newStatus])
      .toArray()
    const maxPosition = targetTasks.reduce((max, t) => Math.max(max, t.position), 0)
    position = maxPosition + 1000
  }

  // Handle completedAt
  let completedAt = task.completedAt
  if (newStatus === 'Done' && oldStatus !== 'Done') {
    completedAt = now
  } else if (newStatus !== 'Done' && oldStatus === 'Done') {
    completedAt = null
  }

  const updated: Task = {
    ...task,
    status: newStatus,
    position,
    completedAt,
    blockedReason: newStatus === 'Blocked' ? (blockedReason ?? null) : null,
    updatedAt: now,
  }

  await db.transaction('rw', [db.tasks, db.activity], async () => {
    await db.tasks.put(updated)
    await activityService.logTaskMoved(db, taskId, oldStatus, newStatus)

    if (newStatus === 'Done' && oldStatus !== 'Done') {
      await activityService.logTaskCompleted(db, taskId)
    } else if (newStatus !== 'Done' && oldStatus === 'Done') {
      await activityService.logTaskReopened(db, taskId)
    }

    if (newStatus === 'Blocked' && blockedReason) {
      await activityService.logTaskBlocked(db, taskId, blockedReason)
    }
  })

  return updated
}

async function pinTask(
  db: ProjectTrackerDB,
  taskId: string,
  pinnedDate: string | null
): Promise<Task> {
  const task = await db.tasks.get(taskId)
  if (!task) {
    throw new Error(`Task ${taskId} not found`)
  }

  const updated: Task = {
    ...task,
    pinnedDate,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.tasks, db.activity], async () => {
    await db.tasks.put(updated)
    await activityService.logTaskPinned(db, taskId, pinnedDate)
  })

  return updated
}

async function deleteTask(
  db: ProjectTrackerDB,
  taskId: string
): Promise<void> {
  await db.transaction('rw', [db.tasks, db.checklistItems, db.attachments], async () => {
    await db.checklistItems.where('taskId').equals(taskId).delete()
    await db.attachments.where('[entityType+entityId]').equals(['task', taskId]).delete()
    await db.tasks.delete(taskId)
  })
}

async function rebalancePositions(
  db: ProjectTrackerDB,
  projectId: string,
  status: TaskStatus
): Promise<void> {
  const tasks = await db.tasks
    .where('[projectId+status]')
    .equals([projectId, status])
    .sortBy('position')

  await db.transaction('rw', db.tasks, async () => {
    for (let i = 0; i < tasks.length; i++) {
      const newPosition = (i + 1) * 1000
      if (tasks[i].position !== newPosition) {
        await db.tasks.update(tasks[i].id, { position: newPosition })
      }
    }
  })
}

async function getTasksForProject(db: ProjectTrackerDB, projectId: string): Promise<Task[]> {
  return db.tasks.where('projectId').equals(projectId).sortBy('position')
}

async function getTasksByStatus(
  db: ProjectTrackerDB,
  projectId: string,
  status: TaskStatus
): Promise<Task[]> {
  return db.tasks
    .where('[projectId+status]')
    .equals([projectId, status])
    .sortBy('position')
}

export const taskService = {
  createTask,
  updateTask,
  moveTask,
  pinTask,
  deleteTask,
  rebalancePositions,
  getTasksForProject,
  getTasksByStatus,
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add taskService with CRUD, WIP enforcement, and completedAt handling"
```

---

## Remaining Tasks Summary

The plan continues with these tasks (abbreviated for length):

### Task 12: Create useProjects composable
- Wrap projectService with reactive liveQuery
- Expose methods for components

### Task 13: Create useTasks composable
- Wrap taskService with reactive liveQuery
- Compute nextAction

### Task 14: Build Portfolio View with Stage Columns
- StageColumn component with WIP indicator
- ProjectCard component with stage dropdown
- Drag-drop placeholder (dropdown moves first)

### Task 15: Build Project Detail View with Task Board
- TaskBoard, TaskColumn, TaskCard components
- Status dropdown on task cards
- Blocked reason modal

### Task 16: Integrate VueDraggable (Phase 3)
- Add drag-drop to Portfolio and Task boards
- Policy-driven drop zone highlighting
- Position recalculation

### Task 17: Build Today View (Phase 4)
- Query: Doing + due ≤ today + pinnedDate = today
- Group by project
- Quick actions

### Task 18: Add Notes and Attachments
- NotesTimeline component
- AttachmentList with Blob storage

### Task 19: Settings and Export/Import
- Settings composable with localStorage
- Export/Import UI

### Task 20: Theme Support
- Dark mode toggle
- System preference detection
