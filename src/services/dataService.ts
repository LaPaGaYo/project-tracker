import type { ProjectTrackerDB } from '@/db/schema'
import type { Project } from '@/types/project'
import type { Task } from '@/types/task'
import type { Note } from '@/types/note'
import type { Attachment } from '@/types/attachment'
import type { ChecklistItem } from '@/types/checklist'
import type { Tag } from '@/types/tag'

interface ExportData {
  version: number
  exportedAt: string
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  checklistItems: ChecklistItem[]
  tags: Tag[]
  // Note: Attachments with blobs are excluded from export for size reasons
  attachmentMeta: Omit<Attachment, 'blob'>[]
}

async function exportAllData(db: ProjectTrackerDB): Promise<ExportData> {
  const [projects, tasks, notes, checklistItems, tags, attachments] = await Promise.all([
    db.projects.toArray(),
    db.tasks.toArray(),
    db.notes.toArray(),
    db.checklistItems.toArray(),
    db.tags.toArray(),
    db.attachments.toArray(),
  ])

  // Strip blob data from attachments for export
  const attachmentMeta = attachments.map(({ blob: _blob, ...meta }) => meta)

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    tasks,
    notes,
    checklistItems,
    tags,
    attachmentMeta,
  }
}

function downloadExport(data: ExportData): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().split('T')[0]
  a.download = `project-tracker-backup-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface ImportResult {
  success: boolean
  imported: {
    projects: number
    tasks: number
    notes: number
    checklistItems: number
    tags: number
  }
  errors: string[]
}

async function importData(db: ProjectTrackerDB, data: ExportData, clearExisting: boolean): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: {
      projects: 0,
      tasks: 0,
      notes: 0,
      checklistItems: 0,
      tags: 0,
    },
    errors: [],
  }

  // Validate data structure
  if (!data.version || !data.projects || !data.tasks) {
    result.errors.push('Invalid export file format')
    return result
  }

  try {
    await db.transaction('rw', [db.projects, db.tasks, db.notes, db.checklistItems, db.tags], async () => {
      if (clearExisting) {
        await db.projects.clear()
        await db.tasks.clear()
        await db.notes.clear()
        await db.checklistItems.clear()
        await db.tags.clear()
      }

      // Import tags first (no dependencies)
      if (data.tags && data.tags.length > 0) {
        await db.tags.bulkPut(data.tags)
        result.imported.tags = data.tags.length
      }

      // Import projects
      if (data.projects && data.projects.length > 0) {
        await db.projects.bulkPut(data.projects)
        result.imported.projects = data.projects.length
      }

      // Import tasks
      if (data.tasks && data.tasks.length > 0) {
        await db.tasks.bulkPut(data.tasks)
        result.imported.tasks = data.tasks.length
      }

      // Import notes
      if (data.notes && data.notes.length > 0) {
        await db.notes.bulkPut(data.notes)
        result.imported.notes = data.notes.length
      }

      // Import checklist items
      if (data.checklistItems && data.checklistItems.length > 0) {
        await db.checklistItems.bulkPut(data.checklistItems)
        result.imported.checklistItems = data.checklistItems.length
      }
    })

    result.success = true
  } catch (error) {
    result.errors.push((error as Error).message)
  }

  return result
}

function parseImportFile(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ExportData
        resolve(data)
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

async function clearAllData(db: ProjectTrackerDB): Promise<void> {
  await db.transaction('rw', [db.projects, db.tasks, db.notes, db.checklistItems, db.tags, db.attachments, db.activity], async () => {
    await db.projects.clear()
    await db.tasks.clear()
    await db.notes.clear()
    await db.checklistItems.clear()
    await db.tags.clear()
    await db.attachments.clear()
    await db.activity.clear()
  })
}

export const dataService = {
  exportAllData,
  downloadExport,
  importData,
  parseImportFile,
  clearAllData,
}
