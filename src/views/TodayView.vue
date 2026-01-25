<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTodayTasks } from '@/composables/useTasks'
import { useProjects } from '@/composables/useProjects'
import { useToast } from '@/composables/useToast'
import type { Task, TaskStatus } from '@/types/task'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const toast = useToast()

const { todayTasks, tasksByProject, moveTask, pinTask } = useTodayTasks()
const { projects } = useProjects()

// Get project name by ID
function getProjectName(projectId: string): string {
  const project = projects.value.find(p => p.id === projectId)
  return project?.title ?? 'Unknown Project'
}

// Sorted project IDs for consistent ordering
const sortedProjectIds = computed(() => {
  return Object.keys(tasksByProject.value).sort((a, b) => {
    const nameA = getProjectName(a)
    const nameB = getProjectName(b)
    return nameA.localeCompare(nameB)
  })
})

// Quick action: Mark task as Done
async function handleMarkDone(task: Task) {
  try {
    await moveTask(task.id, 'Done')
    toast.success('Task completed!')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

// Quick action: Unpin task
async function handleUnpin(task: Task) {
  try {
    await pinTask(task.id, null)
    toast.success('Unpinned')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

// Navigate to project
function openProject(projectId: string) {
  router.push({ name: 'project', params: { id: projectId } })
}

// Status badge colors
const statusColors: Record<TaskStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  Todo: 'default',
  Doing: 'info',
  Blocked: 'danger',
  Done: 'success',
}

// Check why a task is shown in Today view
function getTaskReasons(task: Task): string[] {
  const today = new Date().toISOString().split('T')[0]!
  const reasons: string[] = []
  if (task.status === 'Doing') reasons.push('In Progress')
  if (task.dueDate && task.dueDate <= today) reasons.push('Due')
  if (task.pinnedDate === today) reasons.push('Pinned')
  return reasons
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="px-4 py-3 border-b bg-white">
      <h1 class="text-xl font-semibold text-gray-900">Today</h1>
      <p class="text-sm text-gray-500 mt-0.5">
        {{ todayTasks.length }} {{ todayTasks.length === 1 ? 'task' : 'tasks' }} for today
      </p>
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Empty state -->
      <div
        v-if="todayTasks.length === 0"
        class="text-center py-12 text-gray-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-12 h-12 mx-auto text-gray-300 mb-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p class="text-lg font-medium">All clear!</p>
        <p class="text-sm mt-1">No tasks due, in progress, or pinned for today.</p>
      </div>

      <!-- Tasks grouped by project -->
      <div v-else class="space-y-6">
        <div
          v-for="projectId in sortedProjectIds"
          :key="projectId"
          class="bg-white rounded-lg border border-gray-200 overflow-hidden"
        >
          <!-- Project header -->
          <div
            class="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100"
            @click="openProject(projectId)"
          >
            <h2 class="font-medium text-gray-900">
              {{ getProjectName(projectId) }}
            </h2>
            <span class="text-sm text-gray-500">
              {{ tasksByProject[projectId]?.length ?? 0 }} {{ (tasksByProject[projectId]?.length ?? 0) === 1 ? 'task' : 'tasks' }}
            </span>
          </div>

          <!-- Tasks list -->
          <div class="divide-y divide-gray-100">
            <div
              v-for="task in tasksByProject[projectId]"
              :key="task.id"
              class="px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
            >
              <!-- Quick complete button -->
              <button
                v-if="task.status !== 'Done'"
                class="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors"
                title="Mark as Done"
                @click="handleMarkDone(task)"
              />
              <div
                v-else
                class="flex-shrink-0 w-5 h-5 rounded bg-green-500 flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  class="w-3 h-3 text-white"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>

              <!-- Task content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="font-medium text-gray-900 text-sm truncate"
                    :class="{ 'line-through text-gray-500': task.status === 'Done' }"
                  >
                    {{ task.title }}
                  </span>
                  <Badge :variant="statusColors[task.status]" class="flex-shrink-0">
                    {{ task.status }}
                  </Badge>
                </div>
                <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  <span
                    v-for="reason in getTaskReasons(task)"
                    :key="reason"
                    class="inline-flex items-center"
                  >
                    <span
                      v-if="reason === 'Due'"
                      class="text-red-600"
                    >
                      Due {{ task.dueDate }}
                    </span>
                    <span
                      v-else-if="reason === 'Pinned'"
                      class="text-yellow-600 flex items-center gap-0.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
                        <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clip-rule="evenodd" />
                      </svg>
                      Pinned
                    </span>
                    <span v-else class="text-blue-600">
                      {{ reason }}
                    </span>
                  </span>
                </div>
              </div>

              <!-- Quick actions -->
              <div class="flex items-center gap-1 flex-shrink-0">
                <!-- Unpin button -->
                <button
                  v-if="task.pinnedDate"
                  class="p-1.5 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                  title="Unpin"
                  @click="handleUnpin(task)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                    <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clip-rule="evenodd" />
                  </svg>
                </button>
                <!-- Open project button -->
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-xs"
                  @click="openProject(projectId)"
                >
                  Open
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
