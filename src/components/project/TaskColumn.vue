<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import type { Task, TaskStatus } from '@/types/task'
import TaskCard from './TaskCard.vue'

const props = defineProps<{
  status: TaskStatus
  tasks: Task[]
  wipLimit?: number
  validStatuses: TaskStatus[]
}>()

const emit = defineEmits<{
  changeStatus: [taskId: string, newStatus: TaskStatus]
  reorder: [taskId: string, newIndex: number]
  openTask: [taskId: string]
  pinTask: [taskId: string]
  deleteTask: [taskId: string]
  createTask: []
}>()

const isAtLimit = computed(() => {
  if (!props.wipLimit) return false
  return props.tasks.length >= props.wipLimit
})

const isOverLimit = computed(() => {
  if (!props.wipLimit) return false
  return props.tasks.length > props.wipLimit
})

const wipDisplay = computed(() => {
  if (!props.wipLimit) return null
  return `${props.tasks.length}/${props.wipLimit}`
})

// Planka-style dark columns
const statusColors: Record<TaskStatus, string> = {
  Todo: 'bg-planka-bg-light border-planka-card/50',
  Doing: 'bg-planka-bg-light border-planka-card/50',
  Blocked: 'bg-planka-bg-light border-planka-card/50',
  Done: 'bg-planka-bg-light border-planka-card/50',
}

// Accent colors for status headers
const headerColors: Record<TaskStatus, string> = {
  Todo: 'text-planka-text-muted',
  Doing: 'text-planka-accent',
  Blocked: 'text-planka-error',
  Done: 'text-planka-success',
}

// Handle drag end - emit appropriate event based on what changed
function handleDragChange(event: { added?: { element: Task; newIndex: number }; moved?: { element: Task; newIndex: number } }) {
  if (event.added) {
    // Task was dragged from another column into this one
    emit('changeStatus', event.added.element.id, props.status)
  } else if (event.moved) {
    // Task was reordered within the same column
    emit('reorder', event.moved.element.id, event.moved.newIndex)
  }
}
</script>

<template>
  <div
    class="flex-shrink-0 w-64 border rounded-planka-lg flex flex-col max-h-full"
    :class="statusColors[status]"
  >
    <div class="p-3 border-b border-planka-card/50 flex items-center justify-between">
      <h3 class="font-semibold text-sm uppercase tracking-wide" :class="headerColors[status]">
        {{ status }}
      </h3>
      <div class="flex items-center gap-2">
        <span
          v-if="wipDisplay"
          class="text-xs font-medium px-1.5 py-0.5 rounded-planka"
          :class="{
            'bg-planka-error/20 text-planka-error': isOverLimit,
            'bg-planka-warning/20 text-planka-warning': isAtLimit && !isOverLimit,
            'bg-planka-card text-planka-text-muted': !isAtLimit,
          }"
        >
          {{ wipDisplay }}
        </span>
        <span class="text-xs text-planka-text-muted">
          {{ tasks.length }}
        </span>
      </div>
    </div>

    <draggable
      :list="tasks"
      group="tasks"
      item-key="id"
      class="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]"
      ghost-class="opacity-50"
      @change="handleDragChange"
    >
      <template #item="{ element: task }">
        <TaskCard
          :task="task"
          :validStatuses="validStatuses"
          @changeStatus="emit('changeStatus', task.id, $event)"
          @click="emit('openTask', task.id)"
          @pin="emit('pinTask', task.id)"
          @delete="emit('deleteTask', task.id)"
        />
      </template>
    </draggable>

    <div
      v-if="tasks.length === 0"
      class="text-center py-6 text-planka-text-muted text-sm"
    >
      No tasks
    </div>

    <div v-if="status === 'Todo'" class="p-2 border-t border-planka-card/50">
      <button
        class="w-full py-1.5 text-sm text-planka-text-muted hover:text-planka-text hover:bg-planka-card rounded-planka transition-colors"
        @click="emit('createTask')"
      >
        + Add task
      </button>
    </div>
  </div>
</template>
