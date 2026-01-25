import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { taskService } from '@/services/taskService'
import { ProjectTrackerDB } from '@/db/schema'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'

describe('taskService', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  afterEach(async () => {
    await db.close()
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
      // Create a task already in Doing status
      const doingTask = await taskService.createTask(db, {
        projectId: 'proj-1',
        title: 'Doing 1',
      })
      await taskService.moveTask(db, doingTask.id, 'Doing', DEFAULT_WIP_LIMITS)

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
