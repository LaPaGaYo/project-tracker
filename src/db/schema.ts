import Dexie, { type Table } from 'dexie'
import type { Project } from '@/types/project'
import type { Task } from '@/types/task'
import type { ChecklistItem } from '@/types/checklist'
import type { Note } from '@/types/note'
import type { Attachment } from '@/types/attachment'
import type { ActivityEvent } from '@/types/activity'
import type { Tag } from '@/types/tag'

export class ProjectTrackerDB extends Dexie {
  projects!: Table<Project>
  tasks!: Table<Task>
  checklistItems!: Table<ChecklistItem>
  notes!: Table<Note>
  attachments!: Table<Attachment>
  activity!: Table<ActivityEvent>
  tags!: Table<Tag>

  constructor(name?: string) {
    super(name ?? 'ProjectTrackerDB')
    this.version(1).stores({
      projects: 'id, stage, sortOrder, pinnedDate, dueDate',
      tasks: 'id, projectId, [projectId+status], status, dueDate, pinnedDate, completedAt',
      checklistItems: 'id, taskId',
      notes: 'id, projectId',
      attachments: 'id, [entityType+entityId]',
      activity: 'id, ts, entityType, entityId',
      tags: 'id, name',
    })
  }
}
