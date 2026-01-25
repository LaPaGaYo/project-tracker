import { type Ref } from 'vue'
import { useLiveQuery } from '@/db/live'
import { db } from '@/db'
import { attachmentService } from '@/services/attachmentService'
import type { Attachment, AttachmentEntityType } from '@/types/attachment'

export function useAttachments(entityType: AttachmentEntityType, entityId: Ref<string>) {
  const attachments = useLiveQuery(
    () => db.attachments
      .where('[entityType+entityId]')
      .equals([entityType, entityId.value])
      .toArray(),
    { initialValue: [] as Attachment[] }
  )

  async function uploadAttachment(file: File) {
    return attachmentService.createAttachment(db, {
      entityType,
      entityId: entityId.value,
      file,
    })
  }

  async function deleteAttachment(attachmentId: string) {
    return attachmentService.deleteAttachment(db, attachmentId)
  }

  function downloadAttachment(attachment: Attachment) {
    return attachmentService.downloadAttachment(attachment)
  }

  function formatFileSize(bytes: number) {
    return attachmentService.formatFileSize(bytes)
  }

  return {
    attachments,
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    formatFileSize,
  }
}
