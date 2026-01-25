import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { ProjectTrackerDB } from '@/db/schema'
import { useLiveQuery } from '@/db/live'

describe('useLiveQuery', () => {
  let db: ProjectTrackerDB

  beforeEach(async () => {
    db = new ProjectTrackerDB()
    await db.delete()
    db = new ProjectTrackerDB()
  })

  it('should return reactive data from query', async () => {
    const project = {
      id: 'proj-1',
      title: 'Test Project',
      description: '',
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

    const result = useLiveQuery(() => db.projects.toArray(), { initialValue: [] })

    // Wait for query to resolve
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(result.value).toHaveLength(1)
    expect(result.value[0]!.title).toBe('Test Project')
  })
})
