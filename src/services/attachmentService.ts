import type { ProjectTrackerDB } from '@/db/schema'
import type { Attachment, AttachmentEntityType } from '@/types/attachment'
import { activityService } from './activityService'

interface CreateAttachmentInput {
  entityType: AttachmentEntityType
  entityId: string
  file: File
}

async function createAttachment(
  db: ProjectTrackerDB,
  input: CreateAttachmentInput
): Promise<Attachment> {
  const attachment: Attachment = {
    id: crypto.randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    filename: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
    createdAt: new Date().toISOString(),
    blob: input.file,
  }

  await db.transaction('rw', [db.attachments, db.activity], async () => {
    await db.attachments.add(attachment)
    await activityService.logAttachmentAdded(
      db,
      attachment.id,
      attachment.entityType,
      attachment.entityId,
      attachment.filename
    )
  })

  return attachment
}

async function deleteAttachment(
  db: ProjectTrackerDB,
  attachmentId: string
): Promise<void> {
  await db.transaction('rw', [db.attachments, db.activity], async () => {
    await db.attachments.delete(attachmentId)
    await activityService.logAttachmentRemoved(db, attachmentId)
  })
}

async function getAttachmentsForEntity(
  db: ProjectTrackerDB,
  entityType: AttachmentEntityType,
  entityId: string
): Promise<Attachment[]> {
  return db.attachments
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .toArray()
}

async function getAttachment(
  db: ProjectTrackerDB,
  attachmentId: string
): Promise<Attachment | undefined> {
  return db.attachments.get(attachmentId)
}

function downloadAttachment(attachment: Attachment): void {
  const url = URL.createObjectURL(attachment.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = attachment.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const attachmentService = {
  createAttachment,
  deleteAttachment,
  getAttachmentsForEntity,
  getAttachment,
  downloadAttachment,
  formatFileSize,
}
