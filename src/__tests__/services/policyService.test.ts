import { describe, it, expect } from 'vitest'
import { policyService } from '@/services/policyService'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import type { Project } from '@/types/project'
import type { Task } from '@/types/task'

describe('policyService', () => {
  const makeProject = (overrides: Partial<Project> = {}): Project => ({
    id: crypto.randomUUID(),
    title: 'Test Project',
    description: '',
    stage: 'Idea',
    dueDate: null,
    tagIds: [],
    links: [],
    timeEstimate: null,
    pinnedDate: null,
    sortOrder: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: crypto.randomUUID(),
    projectId: 'proj-1',
    title: 'Test Task',
    description: '',
    status: 'Todo',
    dueDate: null,
    pinnedDate: null,
    position: 1000,
    blockedReason: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  describe('canMoveProjectToStage', () => {
    it('allows moving to Idea (no limit)', () => {
      const projects: Project[] = []
      const result = policyService.canMoveProjectToStage(projects, 'Idea', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(true)
    })

    it('blocks moving to Active when at limit', () => {
      const projects = [
        makeProject({ stage: 'Active' }),
        makeProject({ stage: 'Active' }),
      ]
      const result = policyService.canMoveProjectToStage(projects, 'Active', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Active')
    })

    it('allows moving to Active when under limit', () => {
      const projects = [makeProject({ stage: 'Active' })]
      const result = policyService.canMoveProjectToStage(projects, 'Active', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(true)
    })
  })

  describe('canMoveTaskToStatus', () => {
    it('allows moving to Todo (no limit)', () => {
      const tasks: Task[] = []
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Todo', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(true)
    })

    it('blocks moving to Doing when at limit', () => {
      const tasks = [makeTask({ status: 'Doing', projectId: 'proj-1' })]
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Doing', DEFAULT_WIP_LIMITS)
      expect(result.allowed).toBe(false)
    })

    it('requires blockedReason for Blocked status', () => {
      const tasks: Task[] = []
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Blocked', DEFAULT_WIP_LIMITS, null)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('reason')
    })

    it('allows Blocked with reason', () => {
      const tasks: Task[] = []
      const result = policyService.canMoveTaskToStatus(tasks, 'proj-1', 'Blocked', DEFAULT_WIP_LIMITS, 'Waiting on API')
      expect(result.allowed).toBe(true)
    })
  })
})
