import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { activityService } from '@/services/activityService'
import { ProjectTrackerDB } from '@/db/schema'

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
    expect(events[0]!.action).toBe('PROJECT_CREATED')
    expect(events[0]!.entityType).toBe('project')
    expect(events[0]!.entityId).toBe('proj-1')
  })

  it('logs a task moved event', async () => {
    await activityService.logTaskMoved(db, 'task-1', 'Todo', 'Doing')

    const events = await db.activity.toArray()
    expect(events).toHaveLength(1)
    expect(events[0]!.action).toBe('TASK_MOVED')
    expect(events[0]!.payload).toEqual({ from: 'Todo', to: 'Doing' })
  })

  it('logs task completed with completedAt', async () => {
    await activityService.logTaskCompleted(db, 'task-1')

    const events = await db.activity.toArray()
    expect(events).toHaveLength(1)
    expect(events[0]!.action).toBe('TASK_COMPLETED')
  })
})
