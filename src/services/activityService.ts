import type { ProjectTrackerDB } from '@/db/schema'
import type { ActivityAction, ActivityEntityType, ActivityEvent } from '@/types/activity'

function createEvent(
  entityType: ActivityEntityType,
  entityId: string,
  action: ActivityAction,
  payload: Record<string, unknown> = {}
): Omit<ActivityEvent, 'id'> {
  return {
    ts: new Date().toISOString(),
    entityType,
    entityId,
    action,
    payload,
  }
}

async function log(
  db: ProjectTrackerDB,
  entityType: ActivityEntityType,
  entityId: string,
  action: ActivityAction,
  payload: Record<string, unknown> = {}
): Promise<string> {
  const event = {
    id: crypto.randomUUID(),
    ...createEvent(entityType, entityId, action, payload),
  }
  await db.activity.add(event)
  return event.id
}

// Project events
async function logProjectCreated(
  db: ProjectTrackerDB,
  projectId: string,
  payload: Record<string, unknown>
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_CREATED', payload)
}

async function logProjectUpdated(
  db: ProjectTrackerDB,
  projectId: string,
  changes: Record<string, unknown>
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_UPDATED', changes)
}

async function logProjectStageChanged(
  db: ProjectTrackerDB,
  projectId: string,
  from: string,
  to: string
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_STAGE_CHANGED', { from, to })
}

async function logProjectPinned(
  db: ProjectTrackerDB,
  projectId: string,
  pinnedDate: string | null
): Promise<string> {
  return log(db, 'project', projectId, 'PROJECT_PINNED', { pinnedDate })
}

// Task events
async function logTaskCreated(
  db: ProjectTrackerDB,
  taskId: string,
  payload: Record<string, unknown>
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_CREATED', payload)
}

async function logTaskUpdated(
  db: ProjectTrackerDB,
  taskId: string,
  changes: Record<string, unknown>
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_UPDATED', changes)
}

async function logTaskMoved(
  db: ProjectTrackerDB,
  taskId: string,
  from: string,
  to: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_MOVED', { from, to })
}

async function logTaskPinned(
  db: ProjectTrackerDB,
  taskId: string,
  pinnedDate: string | null
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_PINNED', { pinnedDate })
}

async function logTaskBlocked(
  db: ProjectTrackerDB,
  taskId: string,
  reason: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_BLOCKED', { reason })
}

async function logTaskCompleted(
  db: ProjectTrackerDB,
  taskId: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_COMPLETED', {})
}

async function logTaskReopened(
  db: ProjectTrackerDB,
  taskId: string
): Promise<string> {
  return log(db, 'task', taskId, 'TASK_REOPENED', {})
}

// Checklist events
async function logChecklistItemCreated(
  db: ProjectTrackerDB,
  itemId: string,
  taskId: string
): Promise<string> {
  return log(db, 'checklist', itemId, 'CHECKLIST_ITEM_CREATED', { taskId })
}

async function logChecklistItemToggled(
  db: ProjectTrackerDB,
  itemId: string,
  completed: boolean
): Promise<string> {
  return log(db, 'checklist', itemId, 'CHECKLIST_ITEM_TOGGLED', { completed })
}

// Attachment events
async function logAttachmentAdded(
  db: ProjectTrackerDB,
  attachmentId: string,
  entityType: string,
  entityId: string,
  filename: string
): Promise<string> {
  return log(db, 'attachment', attachmentId, 'ATTACHMENT_ADDED', { entityType, entityId, filename })
}

async function logAttachmentRemoved(
  db: ProjectTrackerDB,
  attachmentId: string
): Promise<string> {
  return log(db, 'attachment', attachmentId, 'ATTACHMENT_REMOVED', {})
}

// Note events
async function logNoteAdded(
  db: ProjectTrackerDB,
  noteId: string,
  projectId: string
): Promise<string> {
  return log(db, 'note', noteId, 'NOTE_ADDED', { projectId })
}

export const activityService = {
  log,
  logProjectCreated,
  logProjectUpdated,
  logProjectStageChanged,
  logProjectPinned,
  logTaskCreated,
  logTaskUpdated,
  logTaskMoved,
  logTaskPinned,
  logTaskBlocked,
  logTaskCompleted,
  logTaskReopened,
  logChecklistItemCreated,
  logChecklistItemToggled,
  logAttachmentAdded,
  logAttachmentRemoved,
  logNoteAdded,
}
