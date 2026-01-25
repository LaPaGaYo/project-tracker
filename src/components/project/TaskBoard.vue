<script setup lang="ts">
import type { Task, TaskStatus } from '@/types/task'
import type { WipLimits } from '@/types/policy'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import TaskColumn from './TaskColumn.vue'

const props = defineProps<{
  tasksByStatus: Record<TaskStatus, Task[]>
  validStatuses: TaskStatus[]
  wipLimits?: WipLimits
}>()

const emit = defineEmits<{
  changeStatus: [taskId: string, newStatus: TaskStatus]
  reorder: [taskId: string, status: TaskStatus, newIndex: number]
  openTask: [taskId: string]
  pinTask: [taskId: string]
  deleteTask: [taskId: string]
  createTask: []
}>()

const statuses: TaskStatus[] = ['Todo', 'Doing', 'Blocked', 'Done']

const limits = props.wipLimits ?? DEFAULT_WIP_LIMITS

const statusWipLimits: Record<TaskStatus, number | undefined> = {
  Todo: undefined,
  Doing: limits.tasks.Doing,
  Blocked: undefined,
  Done: undefined,
}
</script>

<template>
  <div class="flex gap-3 h-full overflow-x-auto pb-4">
    <TaskColumn
      v-for="status in statuses"
      :key="status"
      :status="status"
      :tasks="tasksByStatus[status]"
      :wipLimit="statusWipLimits[status]"
      :validStatuses="validStatuses"
      @changeStatus="(taskId, newStatus) => emit('changeStatus', taskId, newStatus)"
      @reorder="(taskId, newIndex) => emit('reorder', taskId, status, newIndex)"
      @openTask="emit('openTask', $event)"
      @pinTask="emit('pinTask', $event)"
      @deleteTask="emit('deleteTask', $event)"
      @createTask="emit('createTask')"
    />
  </div>
</template>
