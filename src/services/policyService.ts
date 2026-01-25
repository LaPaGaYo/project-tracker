import type { Project, ProjectStage } from '@/types/project'
import type { Task, TaskStatus } from '@/types/task'
import type { WipLimits } from '@/types/policy'

export interface PolicyResult {
  allowed: boolean
  reason?: string
}

function canMoveProjectToStage(
  allProjects: Project[],
  targetStage: ProjectStage,
  limits: WipLimits,
  excludeProjectId?: string
): PolicyResult {
  const limitedStages: (keyof WipLimits['projects'])[] = ['Planning', 'Active']

  if (!limitedStages.includes(targetStage as keyof WipLimits['projects'])) {
    return { allowed: true }
  }

  const limit = limits.projects[targetStage as keyof WipLimits['projects']]
  const currentCount = allProjects.filter(
    p => p.stage === targetStage && p.id !== excludeProjectId
  ).length

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `${targetStage} limit reached (${currentCount}/${limit}). Finish or pause a project first.`,
    }
  }

  return { allowed: true }
}

function canMoveTaskToStatus(
  projectTasks: Task[],
  projectId: string,
  targetStatus: TaskStatus,
  limits: WipLimits,
  blockedReason?: string | null,
  excludeTaskId?: string
): PolicyResult {
  if (targetStatus === 'Blocked') {
    if (!blockedReason || blockedReason.trim() === '') {
      return {
        allowed: false,
        reason: 'A blocked reason is required to move to Blocked status.',
      }
    }
  }

  if (targetStatus === 'Doing') {
    const limit = limits.tasks.Doing
    const currentCount = projectTasks.filter(
      t => t.projectId === projectId && t.status === 'Doing' && t.id !== excludeTaskId
    ).length

    if (currentCount >= limit) {
      return {
        allowed: false,
        reason: `Doing limit reached (${currentCount}/${limit}). Complete a task first.`,
      }
    }
  }

  return { allowed: true }
}

function getValidProjectStages(
  allProjects: Project[],
  limits: WipLimits,
  excludeProjectId?: string
): ProjectStage[] {
  const allStages: ProjectStage[] = ['Idea', 'Planning', 'Active', 'Paused', 'Completed', 'Archived']

  return allStages.filter(stage => {
    const result = canMoveProjectToStage(allProjects, stage, limits, excludeProjectId)
    return result.allowed
  })
}

function getValidTaskStatuses(
  projectTasks: Task[],
  projectId: string,
  limits: WipLimits,
  excludeTaskId?: string
): TaskStatus[] {
  const allStatuses: TaskStatus[] = ['Todo', 'Doing', 'Blocked', 'Done']

  return allStatuses.filter(status => {
    // Blocked always needs a reason, so we exclude it from "valid" until reason is provided
    if (status === 'Blocked') return true // Allow in list, will prompt for reason

    const result = canMoveTaskToStatus(projectTasks, projectId, status, limits, null, excludeTaskId)
    return result.allowed
  })
}

export const policyService = {
  canMoveProjectToStage,
  canMoveTaskToStatus,
  getValidProjectStages,
  getValidTaskStatuses,
}
