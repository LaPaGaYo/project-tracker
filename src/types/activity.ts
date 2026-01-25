export type ActivityEntityType = 'project' | 'task' | 'checklist' | 'note' | 'attachment'

export type ActivityAction =
  | 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'PROJECT_STAGE_CHANGED' | 'PROJECT_PINNED'
  | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_MOVED' | 'TASK_PINNED' | 'TASK_BLOCKED' | 'TASK_COMPLETED' | 'TASK_REOPENED'
  | 'CHECKLIST_ITEM_CREATED' | 'CHECKLIST_ITEM_TOGGLED'
  | 'ATTACHMENT_ADDED' | 'ATTACHMENT_REMOVED'
  | 'NOTE_ADDED'

export interface ActivityEvent {
  id: string
  ts: string
  entityType: ActivityEntityType
  entityId: string
  action: ActivityAction
  payload: Record<string, unknown>
}
