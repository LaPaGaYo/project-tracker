<script setup lang="ts">
import { computed } from 'vue'
import type { Task, TaskStatus } from '@/types/task'
import Badge from '@/components/ui/Badge.vue'
import Dropdown from '@/components/ui/Dropdown.vue'

const props = defineProps<{
  task: Task
  validStatuses: TaskStatus[]
}>()

const emit = defineEmits<{
  changeStatus: [status: TaskStatus]
  click: []
  pin: []
  delete: []
}>()

const statusItems = computed(() =>
  props.validStatuses.map(status => ({
    label: status,
    value: status,
  }))
)

const isPinned = computed(() => props.task.pinnedDate !== null)
const isBlocked = computed(() => props.task.status === 'Blocked')
const isDone = computed(() => props.task.status === 'Done')

function handleStatusChange(status: string) {
  emit('changeStatus', status as TaskStatus)
}

const statusColors: Record<TaskStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  Todo: 'default',
  Doing: 'info',
  Blocked: 'danger',
  Done: 'success',
}
</script>

<template>
  <div
    class="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    :class="{
      'border-red-300 bg-red-50': isBlocked,
      'border-green-300': isDone,
      'border-gray-200': !isBlocked && !isDone,
    }"
    @click="emit('click')"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <h4 class="font-medium text-gray-900 text-sm" :class="{ 'line-through text-gray-500': isDone }">
          {{ task.title }}
        </h4>
        <p v-if="task.description" class="text-xs text-gray-500 mt-1 line-clamp-2">
          {{ task.description }}
        </p>
        <p v-if="isBlocked && task.blockedReason" class="text-xs text-red-600 mt-1">
          Blocked: {{ task.blockedReason }}
        </p>
      </div>
      <button
        v-if="isPinned"
        class="text-yellow-500 hover:text-yellow-600 flex-shrink-0"
        title="Pinned"
        @click.stop="emit('pin')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
          <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
      <div @click.stop>
        <Dropdown
          :items="statusItems"
          @select="handleStatusChange"
        >
          <template #trigger>
            <button class="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1">
              Move to
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </button>
          </template>
        </Dropdown>
      </div>

      <Badge :variant="statusColors[task.status]">
        {{ task.status }}
      </Badge>
    </div>
  </div>
</template>
