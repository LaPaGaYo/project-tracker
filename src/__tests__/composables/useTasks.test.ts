import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useTasks, useTodayTasks } from '@/composables/useTasks'

describe('useTasks', () => {
  it('should return the expected API', () => {
    const projectId = ref('proj-1')
    const result = useTasks(projectId)

    expect(result.tasks).toBeDefined()
    expect(result.tasksByStatus).toBeDefined()
    expect(result.nextAction).toBeDefined()
    expect(result.doingTasks).toBeDefined()
    expect(result.blockedTasks).toBeDefined()
    expect(typeof result.createTask).toBe('function')
    expect(typeof result.updateTask).toBe('function')
    expect(typeof result.moveTask).toBe('function')
    expect(typeof result.pinTask).toBe('function')
    expect(typeof result.deleteTask).toBe('function')
    expect(typeof result.canMoveToStatus).toBe('function')
    expect(typeof result.getValidStatuses).toBe('function')
    expect(typeof result.getTask).toBe('function')
  })

  it('should initialize tasks with empty array', () => {
    const projectId = ref('proj-1')
    const result = useTasks(projectId)
    expect(result.tasks.value).toEqual([])
  })

  it('should initialize tasksByStatus with empty arrays for each status', () => {
    const projectId = ref('proj-1')
    const result = useTasks(projectId)
    expect(result.tasksByStatus.value).toEqual({
      Todo: [],
      Doing: [],
      Blocked: [],
      Done: [],
    })
  })

  it('should initialize nextAction as null when no tasks', () => {
    const projectId = ref('proj-1')
    const result = useTasks(projectId)
    expect(result.nextAction.value).toBeNull()
  })
})

describe('useTodayTasks', () => {
  it('should return the expected API', () => {
    const result = useTodayTasks()

    expect(result.todayTasks).toBeDefined()
    expect(result.tasksByProject).toBeDefined()
    expect(typeof result.moveTask).toBe('function')
    expect(typeof result.pinTask).toBe('function')
  })

  it('should initialize todayTasks with empty array', () => {
    const result = useTodayTasks()
    expect(result.todayTasks.value).toEqual([])
  })

  it('should initialize tasksByProject with empty object', () => {
    const result = useTodayTasks()
    expect(result.tasksByProject.value).toEqual({})
  })
})
