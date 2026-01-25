import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { projectService } from '@/services/projectService'
import { ProjectTrackerDB } from '@/db/schema'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'

describe('projectService', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  afterEach(async () => {
    await db.close()
  })

  describe('createProject', () => {
    it('creates a project and logs activity', async () => {
      const project = await projectService.createProject(db, {
        title: 'Test Project',
        description: 'A test',
      })

      expect(project.id).toBeDefined()
      expect(project.title).toBe('Test Project')
      expect(project.stage).toBe('Idea')

      const stored = await db.projects.get(project.id)
      expect(stored).toEqual(project)

      const activity = await db.activity.toArray()
      expect(activity).toHaveLength(1)
      expect(activity[0]!.action).toBe('PROJECT_CREATED')
    })
  })

  describe('updateProject', () => {
    it('updates project fields and logs activity', async () => {
      const project = await projectService.createProject(db, { title: 'Original' })

      const updated = await projectService.updateProject(db, project.id, {
        title: 'Updated',
        description: 'New description',
      })

      expect(updated.title).toBe('Updated')
      expect(updated.description).toBe('New description')

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'PROJECT_UPDATED')).toBe(true)
    })
  })

  describe('changeProjectStage', () => {
    it('changes stage when allowed and logs activity', async () => {
      const project = await projectService.createProject(db, { title: 'Test' })

      const updated = await projectService.changeProjectStage(
        db,
        project.id,
        'Active',
        DEFAULT_WIP_LIMITS
      )

      expect(updated.stage).toBe('Active')

      const activity = await db.activity.toArray()
      expect(activity.some(a => a.action === 'PROJECT_STAGE_CHANGED')).toBe(true)
    })

    it('throws when WIP limit exceeded', async () => {
      await projectService.createProject(db, { title: 'Active 1', stage: 'Active' })
      await projectService.createProject(db, { title: 'Active 2', stage: 'Active' })
      const project = await projectService.createProject(db, { title: 'Idea' })

      await expect(
        projectService.changeProjectStage(db, project.id, 'Active', DEFAULT_WIP_LIMITS)
      ).rejects.toThrow(/limit/)
    })
  })

  describe('deleteProject', () => {
    it('deletes project and related tasks', async () => {
      const project = await projectService.createProject(db, { title: 'Test' })
      await db.tasks.add({
        id: 'task-1',
        projectId: project.id,
        title: 'Task',
        description: '',
        status: 'Todo',
        dueDate: null,
        pinnedDate: null,
        position: 1000,
        blockedReason: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await projectService.deleteProject(db, project.id)

      const projects = await db.projects.toArray()
      const tasks = await db.tasks.toArray()

      expect(projects).toHaveLength(0)
      expect(tasks).toHaveLength(0)
    })
  })
})
