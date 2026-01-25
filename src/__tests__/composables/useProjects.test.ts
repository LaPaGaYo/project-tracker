import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useProjects } from '@/composables/useProjects'
import { ProjectTrackerDB } from '@/db/schema'
import { db } from '@/db'

// Note: We need to mock the db singleton for tests, but for now we'll test
// the composable's structure. Integration tests would require a test db setup.

describe('useProjects', () => {
  // Skip integration tests for now since they require proper db mocking
  // The composable simply wraps projectService which is already tested

  it('should return the expected API', () => {
    const result = useProjects()

    expect(result.projects).toBeDefined()
    expect(result.projectsByStage).toBeDefined()
    expect(result.activeProjects).toBeDefined()
    expect(result.pinnedProjects).toBeDefined()
    expect(typeof result.createProject).toBe('function')
    expect(typeof result.updateProject).toBe('function')
    expect(typeof result.changeStage).toBe('function')
    expect(typeof result.pinProject).toBe('function')
    expect(typeof result.deleteProject).toBe('function')
    expect(typeof result.canMoveToStage).toBe('function')
    expect(typeof result.getValidStages).toBe('function')
    expect(typeof result.getProject).toBe('function')
  })

  it('should initialize projects with empty array', () => {
    const result = useProjects()
    expect(result.projects.value).toEqual([])
  })

  it('should initialize projectsByStage with empty arrays for each stage', () => {
    const result = useProjects()
    expect(result.projectsByStage.value).toEqual({
      Idea: [],
      Planning: [],
      Active: [],
      Paused: [],
      Completed: [],
      Archived: [],
    })
  })
})
