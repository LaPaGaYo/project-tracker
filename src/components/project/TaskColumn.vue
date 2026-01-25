<script setup lang="ts">
import { computed } from 'vue'
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

const statusColors: Record<TaskStatus, string> = {
  Todo: 'bg-gray-50 border-gray-200',
  Doing: 'bg-blue-50 border-blue-200',
  Blocked: 'bg-red-50 border-red-200',
  Done: 'bg-green-50 border-green-200',
}

const headerColors: Record<TaskStatus, string> = {
  Todo: 'text-gray-700',
  Doing: 'text-blue-700',
  Blocked: 'text-red-700',
  Done: 'text-green-700',
}
</script>

<template>
  <div
    class="flex-shrink-0 w-64 border rounded-lg flex flex-col max-h-full"
    :class="statusColors[status]"
  >
    <div class="p-3 border-b flex items-center justify-between" :class="statusColors[status]">
      <h3 class="font-semibold text-sm" :class="headerColors[status]">
        {{ status }}
      </h3>
      <div class="flex items-center gap-2">
        <span
          v-if="wipDisplay"
          class="text-xs font-medium px-1.5 py-0.5 rounded"
          :class="{
            'bg-red-100 text-red-700': isOverLimit,
            'bg-yellow-100 text-yellow-700': isAtLimit && !isOverLimit,
            'bg-gray-100 text-gray-600': !isAtLimit,
          }"
        >
          {{ wipDisplay }}
        </span>
        <span class="text-xs text-gray-500">
          {{ tasks.length }}
        </span>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :validStatuses="validStatuses"
        @changeStatus="emit('changeStatus', task.id, $event)"
        @click="emit('openTask', task.id)"
        @pin="emit('pinTask', task.id)"
        @delete="emit('deleteTask', task.id)"
      />

      <div
        v-if="tasks.length === 0"
        class="text-center py-6 text-gray-400 text-sm"
      >
        No tasks
      </div>
    </div>

    <div v-if="status === 'Todo'" class="p-2 border-t" :class="statusColors[status]">
      <button
        class="w-full py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
        @click="emit('createTask')"
      >
        + Add task
      </button>
    </div>
  </div>
</template>
