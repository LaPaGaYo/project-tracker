import { computed, type Ref } from 'vue'
import { useLiveQuery } from '@/db/live'
import { db } from '@/db'
import { taskService } from '@/services/taskService'
import type { Task, TaskStatus } from '@/types/task'
import type { WipLimits } from '@/types/policy'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import { policyService } from '@/services/policyService'

export function useTasks(projectId: Ref<string>, wipLimits: WipLimits = DEFAULT_WIP_LIMITS) {
  const tasks = useLiveQuery(
    () => db.tasks.where('projectId').equals(projectId.value).sortBy('position'),
    { initialValue: [] as Task[] }
  )

  const tasksByStatus = computed(() => {
    const statuses: Record<TaskStatus, Task[]> = {
      Todo: [],
      Doing: [],
      Blocked: [],
      Done: [],
    }
    for (const task of tasks.value) {
      statuses[task.status].push(task)
    }
    return statuses
  })

  // Next Action: First Doing task, else first Todo task
  const nextAction = computed<Task | null>(() => {
    const doingTasks = tasksByStatus.value.Doing
    if (doingTasks.length > 0) {
      return doingTasks[0]!
    }
    const todoTasks = tasksByStatus.value.Todo
    if (todoTasks.length > 0) {
      return todoTasks[0]!
    }
    return null
  })

  const doingTasks = computed(() => tasksByStatus.value.Doing)
  const blockedTasks = computed(() => tasksByStatus.value.Blocked)

  async function createTask(input: { title: string; description?: string }) {
    return taskService.createTask(db, {
      projectId: projectId.value,
      ...input,
    })
  }

  async function updateTask(
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
  ) {
    return taskService.updateTask(db, taskId, updates)
  }

  async function moveTask(
    taskId: string,
    newStatus: TaskStatus,
    newPosition?: number,
    blockedReason?: string
  ) {
    return taskService.moveTask(db, taskId, newStatus, wipLimits, newPosition, blockedReason)
  }

  async function pinTask(taskId: string, pinnedDate: string | null) {
    return taskService.pinTask(db, taskId, pinnedDate)
  }

  async function deleteTask(taskId: string) {
    return taskService.deleteTask(db, taskId)
  }

  async function reorderTask(taskId: string, newIndex: number) {
    return taskService.reorderTask(db, taskId, newIndex)
  }

  function canMoveToStatus(taskId: string, targetStatus: TaskStatus, blockedReason?: string) {
    return policyService.canMoveTaskToStatus(
      tasks.value,
      projectId.value,
      targetStatus,
      wipLimits,
      blockedReason,
      taskId
    )
  }

  function getValidStatuses(taskId?: string) {
    return policyService.getValidTaskStatuses(tasks.value, projectId.value, wipLimits, taskId)
  }

  function getTask(taskId: string) {
    return tasks.value.find(t => t.id === taskId)
  }

  return {
    tasks,
    tasksByStatus,
    nextAction,
    doingTasks,
    blockedTasks,
    createTask,
    updateTask,
    moveTask,
    pinTask,
    deleteTask,
    reorderTask,
    canMoveToStatus,
    getValidStatuses,
    getTask,
  }
}

// Composable for Today view - gets tasks across all projects
export function useTodayTasks(wipLimits: WipLimits = DEFAULT_WIP_LIMITS) {
  const today = new Date().toISOString().split('T')[0]!

  // Get all tasks that are: Doing, OR due today or earlier, OR pinned today
  const todayTasks = useLiveQuery(
    async () => {
      const allTasks = await db.tasks.toArray()
      return allTasks.filter(task => {
        // Include all Doing tasks
        if (task.status === 'Doing') return true
        // Include tasks due today or earlier (excluding Done)
        if (task.dueDate && task.dueDate <= today && task.status !== 'Done') return true
        // Include tasks pinned for today
        if (task.pinnedDate === today) return true
        return false
      }).sort((a, b) => {
        // Sort by: Doing first, then by dueDate asc, then by position
        if (a.status === 'Doing' && b.status !== 'Doing') return -1
        if (b.status === 'Doing' && a.status !== 'Doing') return 1
        // Sort by dueDate (null dates go last)
        if (a.dueDate && b.dueDate) {
          if (a.dueDate < b.dueDate) return -1
          if (a.dueDate > b.dueDate) return 1
        } else if (a.dueDate && !b.dueDate) {
          return -1
        } else if (!a.dueDate && b.dueDate) {
          return 1
        }
        return a.position - b.position
      })
    },
    { initialValue: [] as Task[] }
  )

  // Group tasks by project
  const tasksByProject = computed(() => {
    const groups: Record<string, Task[]> = {}
    for (const task of todayTasks.value) {
      if (!groups[task.projectId]) {
        groups[task.projectId] = []
      }
      groups[task.projectId]!.push(task)
    }
    return groups
  })

  async function moveTask(
    taskId: string,
    newStatus: TaskStatus,
    newPosition?: number,
    blockedReason?: string
  ) {
    return taskService.moveTask(db, taskId, newStatus, wipLimits, newPosition, blockedReason)
  }

  async function pinTask(taskId: string, pinnedDate: string | null) {
    return taskService.pinTask(db, taskId, pinnedDate)
  }

  return {
    todayTasks,
    tasksByProject,
    moveTask,
    pinTask,
  }
}
