<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment } from '@/types/attachment'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  attachments: Attachment[]
}>()

const emit = defineEmits<{
  upload: [file: File]
  delete: [attachmentId: string]
  download: [attachment: Attachment]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    emit('upload', files[0]!)
    target.value = ''
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    emit('upload', files[0]!)
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDelete(attachmentId: string) {
  if (confirm('Are you sure you want to delete this attachment?')) {
    emit('delete', attachmentId)
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document'
  return 'file'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-medium text-gray-900">Attachments</h3>
      <Button size="sm" @click="openFilePicker">
        + Add File
      </Button>
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <!-- Drop zone / Empty state -->
    <div
      v-if="attachments.length === 0"
      class="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border-2 border-dashed transition-colors"
      :class="isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200'"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-8 h-8 mx-auto mb-2"
        :class="isDragging ? 'text-blue-400' : 'text-gray-300'"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p v-if="isDragging" class="text-blue-600">Drop file here</p>
      <p v-else>Drag and drop a file here, or click to select</p>
    </div>

    <!-- Attachments list -->
    <div
      v-else
      class="space-y-2"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <!-- File icon -->
        <div class="w-10 h-10 flex items-center justify-center bg-gray-100 rounded flex-shrink-0">
          <svg
            v-if="getFileIcon(attachment.mimeType) === 'image'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="w-5 h-5 text-gray-500"
          >
            <path fill-rule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-2.97 2.97zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clip-rule="evenodd" />
          </svg>
          <svg
            v-else-if="getFileIcon(attachment.mimeType) === 'pdf'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="w-5 h-5 text-red-500"
          >
            <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clip-rule="evenodd" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="w-5 h-5 text-gray-500"
          >
            <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clip-rule="evenodd" />
          </svg>
        </div>

        <!-- File info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">{{ attachment.filename }}</p>
          <p class="text-xs text-gray-500">
            {{ formatFileSize(attachment.size) }} · {{ formatDate(attachment.createdAt) }}
          </p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 flex-shrink-0">
          <button
            class="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
            title="Download"
            @click="emit('download', attachment)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
          </button>
          <button
            class="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
            title="Delete"
            @click="handleDelete(attachment.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Drop zone hint when has items -->
      <div
        v-if="isDragging"
        class="text-center py-4 text-blue-600 text-sm bg-blue-50 rounded-lg border-2 border-dashed border-blue-400"
      >
        Drop file here to add
      </div>
    </div>
  </div>
</template>
