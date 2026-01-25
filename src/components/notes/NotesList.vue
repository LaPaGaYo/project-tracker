<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Note, NoteType } from '@/types/note'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'

const props = defineProps<{
  notes: Note[]
}>()

const emit = defineEmits<{
  create: [content: string, type: NoteType]
  update: [noteId: string, content: string, type: NoteType]
  delete: [noteId: string]
}>()

// Create/Edit modal
const showModal = ref(false)
const editingNote = ref<Note | null>(null)
const noteContent = ref('')
const noteType = ref<NoteType>('note')

const modalTitle = computed(() => editingNote.value ? 'Edit Note' : 'New Note')

function openCreateModal() {
  editingNote.value = null
  noteContent.value = ''
  noteType.value = 'note'
  showModal.value = true
}

function openEditModal(note: Note) {
  editingNote.value = note
  noteContent.value = note.content
  noteType.value = note.type
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingNote.value = null
  noteContent.value = ''
  noteType.value = 'note'
}

function handleSubmit() {
  if (!noteContent.value.trim()) return

  if (editingNote.value) {
    emit('update', editingNote.value.id, noteContent.value.trim(), noteType.value)
  } else {
    emit('create', noteContent.value.trim(), noteType.value)
  }
  closeModal()
}

function handleDelete(noteId: string) {
  if (confirm('Are you sure you want to delete this note?')) {
    emit('delete', noteId)
  }
}

const typeLabels: Record<NoteType, string> = {
  note: 'Note',
  decision: 'Decision',
  linkdump: 'Links',
}

const typeVariants: Record<NoteType, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  note: 'default',
  decision: 'info',
  linkdump: 'warning',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-medium text-planka-text">Notes</h3>
      <Button size="sm" @click="openCreateModal">
        + Add Note
      </Button>
    </div>

    <!-- Empty state -->
    <div
      v-if="notes.length === 0"
      class="text-center py-8 text-planka-text-muted text-sm bg-planka-card rounded-planka border border-dashed border-planka-bg-light"
    >
      No notes yet. Add one to keep track of decisions and context.
    </div>

    <!-- Notes list -->
    <div v-else class="space-y-3">
      <div
        v-for="note in notes"
        :key="note.id"
        class="p-3 bg-planka-card rounded-planka hover:bg-planka-card/80 transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <Badge :variant="typeVariants[note.type]">
                {{ typeLabels[note.type] }}
              </Badge>
              <span class="text-xs text-planka-text-muted">
                {{ formatDate(note.updatedAt) }}
              </span>
            </div>
            <p class="text-sm text-planka-text whitespace-pre-wrap">{{ note.content }}</p>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              class="p-1 text-planka-text-muted hover:text-planka-text rounded-planka transition-colors"
              title="Edit"
              @click="openEditModal(note)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
            </button>
            <button
              class="p-1 text-planka-text-muted hover:text-planka-error rounded-planka transition-colors"
              title="Delete"
              @click="handleDelete(note.id)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Modal :open="showModal" :title="modalTitle" @close="closeModal">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-planka-text mb-1">Type</label>
          <div class="flex gap-2">
            <button
              v-for="type in (['note', 'decision', 'linkdump'] as NoteType[])"
              :key="type"
              type="button"
              class="px-3 py-1.5 text-sm rounded-planka border transition-colors"
              :class="noteType === type
                ? 'bg-planka-accent/20 border-planka-accent text-planka-accent'
                : 'bg-planka-bg-light border-planka-bg-light text-planka-text hover:bg-planka-card'"
              @click="noteType = type"
            >
              {{ typeLabels[type] }}
            </button>
          </div>
        </div>
        <div>
          <label for="note-content" class="block text-sm font-medium text-planka-text mb-1">
            Content
          </label>
          <textarea
            id="note-content"
            v-model="noteContent"
            rows="5"
            class="w-full px-3 py-2 bg-planka-bg-light border border-planka-bg-light text-planka-text rounded-planka focus:outline-none focus:ring-2 focus:ring-planka-accent focus:border-planka-accent"
            placeholder="Write your note..."
            autofocus
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" @click="closeModal">
            Cancel
          </Button>
          <Button type="submit" :disabled="!noteContent.trim()">
            {{ editingNote ? 'Save Changes' : 'Add Note' }}
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
