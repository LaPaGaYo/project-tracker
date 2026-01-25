import type { ProjectTrackerDB } from '@/db/schema'
import type { Project, ProjectStage } from '@/types/project'
import type { WipLimits } from '@/types/policy'
import { policyService } from './policyService'
import { activityService } from './activityService'

interface CreateProjectInput {
  title: string
  description?: string
  stage?: ProjectStage
  dueDate?: string | null
  tagIds?: string[]
  links?: { title: string; url: string }[]
  timeEstimate?: number | null
}

async function createProject(
  db: ProjectTrackerDB,
  input: CreateProjectInput
): Promise<Project> {
  const now = new Date().toISOString()
  const maxSortOrder = await db.projects.orderBy('sortOrder').last()

  const project: Project = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description ?? '',
    stage: input.stage ?? 'Idea',
    dueDate: input.dueDate ?? null,
    tagIds: input.tagIds ?? [],
    links: input.links ?? [],
    timeEstimate: input.timeEstimate ?? null,
    pinnedDate: null,
    sortOrder: (maxSortOrder?.sortOrder ?? 0) + 1000,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.add(project)
    await activityService.logProjectCreated(db, project.id, { title: project.title })
  })

  return project
}

async function updateProject(
  db: ProjectTrackerDB,
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Project> {
  const project = await db.projects.get(projectId)
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const updated: Project = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.put(updated)
    await activityService.logProjectUpdated(db, projectId, updates)
  })

  return updated
}

async function changeProjectStage(
  db: ProjectTrackerDB,
  projectId: string,
  newStage: ProjectStage,
  limits: WipLimits
): Promise<Project> {
  const project = await db.projects.get(projectId)
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const allProjects = await db.projects.toArray()
  const policyResult = policyService.canMoveProjectToStage(allProjects, newStage, limits, projectId)

  if (!policyResult.allowed) {
    throw new Error(policyResult.reason)
  }

  const oldStage = project.stage
  const updated: Project = {
    ...project,
    stage: newStage,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.put(updated)
    await activityService.logProjectStageChanged(db, projectId, oldStage, newStage)
  })

  return updated
}

async function pinProject(
  db: ProjectTrackerDB,
  projectId: string,
  pinnedDate: string | null
): Promise<Project> {
  const project = await db.projects.get(projectId)
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const updated: Project = {
    ...project,
    pinnedDate,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.projects, db.activity], async () => {
    await db.projects.put(updated)
    await activityService.logProjectPinned(db, projectId, pinnedDate)
  })

  return updated
}

async function deleteProject(
  db: ProjectTrackerDB,
  projectId: string
): Promise<void> {
  await db.transaction('rw', [db.projects, db.tasks, db.checklistItems, db.notes, db.attachments], async () => {
    // Get all tasks for this project
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    const taskIds = tasks.map(t => t.id)

    // Delete checklist items for all tasks
    for (const taskId of taskIds) {
      await db.checklistItems.where('taskId').equals(taskId).delete()
    }

    // Delete tasks
    await db.tasks.where('projectId').equals(projectId).delete()

    // Delete notes
    await db.notes.where('projectId').equals(projectId).delete()

    // Delete attachments for project
    await db.attachments
      .where('[entityType+entityId]')
      .equals(['project', projectId])
      .delete()

    // Delete attachments for tasks
    for (const taskId of taskIds) {
      await db.attachments
        .where('[entityType+entityId]')
        .equals(['task', taskId])
        .delete()
    }

    // Delete project
    await db.projects.delete(projectId)
  })
}

async function getProject(db: ProjectTrackerDB, projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId)
}

async function getAllProjects(db: ProjectTrackerDB): Promise<Project[]> {
  return db.projects.orderBy('sortOrder').toArray()
}

async function getProjectsByStage(db: ProjectTrackerDB, stage: ProjectStage): Promise<Project[]> {
  return db.projects.where('stage').equals(stage).sortBy('sortOrder')
}

export const projectService = {
  createProject,
  updateProject,
  changeProjectStage,
  pinProject,
  deleteProject,
  getProject,
  getAllProjects,
  getProjectsByStage,
}
