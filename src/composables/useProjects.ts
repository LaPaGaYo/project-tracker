import { computed } from 'vue'
import { useLiveQuery } from '@/db/live'
import { db } from '@/db'
import { projectService } from '@/services/projectService'
import type { Project, ProjectStage } from '@/types/project'
import type { WipLimits } from '@/types/policy'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import { policyService } from '@/services/policyService'

export function useProjects(wipLimits: WipLimits = DEFAULT_WIP_LIMITS) {
  const projects = useLiveQuery(
    () => db.projects.orderBy('sortOrder').toArray(),
    { initialValue: [] as Project[] }
  )

  const projectsByStage = computed(() => {
    const stages: Record<ProjectStage, Project[]> = {
      Idea: [],
      Planning: [],
      Active: [],
      Paused: [],
      Completed: [],
      Archived: [],
    }
    for (const project of projects.value) {
      stages[project.stage].push(project)
    }
    return stages
  })

  const activeProjects = computed(() =>
    projects.value.filter(p => p.stage === 'Active')
  )

  const pinnedProjects = computed(() =>
    projects.value.filter(p => p.pinnedDate !== null)
  )

  async function createProject(input: { title: string; description?: string; stage?: ProjectStage }) {
    return projectService.createProject(db, input)
  }

  async function updateProject(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
  ) {
    return projectService.updateProject(db, projectId, updates)
  }

  async function changeStage(projectId: string, newStage: ProjectStage) {
    return projectService.changeProjectStage(db, projectId, newStage, wipLimits)
  }

  async function pinProject(projectId: string, pinnedDate: string | null) {
    return projectService.pinProject(db, projectId, pinnedDate)
  }

  async function deleteProject(projectId: string) {
    return projectService.deleteProject(db, projectId)
  }

  function canMoveToStage(projectId: string, targetStage: ProjectStage) {
    return policyService.canMoveProjectToStage(
      projects.value,
      targetStage,
      wipLimits,
      projectId
    )
  }

  function getValidStages(projectId?: string) {
    return policyService.getValidProjectStages(projects.value, wipLimits, projectId)
  }

  function getProject(projectId: string) {
    return projects.value.find(p => p.id === projectId)
  }

  return {
    projects,
    projectsByStage,
    activeProjects,
    pinnedProjects,
    createProject,
    updateProject,
    changeStage,
    pinProject,
    deleteProject,
    canMoveToStage,
    getValidStages,
    getProject,
  }
}
