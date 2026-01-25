import 'fake-indexeddb/auto'
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
    expect(doingTasks[0]!.title).toBe('Task 2')
  })
})
