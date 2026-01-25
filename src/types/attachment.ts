export type AttachmentEntityType = 'project' | 'task'

export interface Attachment {
  id: string
  entityType: AttachmentEntityType
  entityId: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
  blob: Blob
}
