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
      if (tasks[i]!.position !== newPosition) {
        await db.tasks.update(tasks[i]!.id, { position: newPosition })
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
