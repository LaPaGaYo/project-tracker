<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useTasks } from '@/composables/useTasks'
import { useNotes } from '@/composables/useNotes'
import { useAttachments } from '@/composables/useAttachments'
import { useToast } from '@/composables/useToast'
import type { TaskStatus } from '@/types/task'
import type { NoteType } from '@/types/note'
import TaskBoard from '@/components/project/TaskBoard.vue'
import NotesList from '@/components/notes/NotesList.vue'
import AttachmentsList from '@/components/attachments/AttachmentsList.vue'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const projectId = computed(() => route.params.id as string)

const { getProject } = useProjects()
const {
  tasksByStatus,
  createTask,
  moveTask,
  pinTask,
  deleteTask,
  reorderTask,
  getValidStatuses,
} = useTasks(projectId)

const {
  sortedNotes,
  createNote,
  updateNote,
  deleteNote,
} = useNotes(projectId)

const {
  attachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
} = useAttachments('project', projectId)

const project = computed(() => getProject(projectId.value))

// Sidebar state
const showSidebar = ref(false)
const activeTab = ref<'notes' | 'attachments'>('notes')

// Create task modal
const showCreateModal = ref(false)
const newTaskTitle = ref('')
const newTaskDescription = ref('')
const isCreating = ref(false)

// Blocked reason modal
const showBlockedModal = ref(false)
const blockedTaskId = ref<string | null>(null)
const blockedReason = ref('')

async function handleCreateTask() {
  if (!newTaskTitle.value.trim()) return

  isCreating.value = true
  try {
    await createTask({
      title: newTaskTitle.value.trim(),
      description: newTaskDescription.value.trim() || undefined,
    })
    toast.success('Task created')
    showCreateModal.value = false
    newTaskTitle.value = ''
    newTaskDescription.value = ''
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    isCreating.value = false
  }
}

async function handleChangeStatus(taskId: string, newStatus: TaskStatus) {
  // If moving to Blocked, show modal for reason
  if (newStatus === 'Blocked') {
    blockedTaskId.value = taskId
    blockedReason.value = ''
    showBlockedModal.value = true
    return
  }

  try {
    await moveTask(taskId, newStatus)
    if (newStatus === 'Done') {
      toast.success('Task completed!')
    } else {
      toast.success(`Moved to ${newStatus}`)
    }
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleBlockTask() {
  if (!blockedTaskId.value || !blockedReason.value.trim()) return

  try {
    await moveTask(blockedTaskId.value, 'Blocked', undefined, blockedReason.value.trim())
    toast.warning('Task blocked')
    showBlockedModal.value = false
    blockedTaskId.value = null
    blockedReason.value = ''
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handlePinTask(taskId: string) {
  try {
    const allTasks = Object.values(tasksByStatus.value).flat()
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    const today = new Date().toISOString().split('T')[0]!
    const newPinnedDate = task.pinnedDate ? null : today
    await pinTask(taskId, newPinnedDate)
    toast.success(newPinnedDate ? 'Pinned for today' : 'Unpinned')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleDeleteTask(taskId: string) {
  if (!confirm('Are you sure you want to delete this task?')) {
    return
  }

  try {
    await deleteTask(taskId)
    toast.success('Task deleted')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

function handleOpenTask(taskId: string) {
  // For now, just log it - could open a task detail modal later
  console.log('Open task:', taskId)
}

async function handleReorder(taskId: string, _status: string, newIndex: number) {
  try {
    await reorderTask(taskId, newIndex)
  } catch (error) {
    toast.error((error as Error).message)
  }
}

// Notes handlers
async function handleCreateNote(content: string, type: NoteType) {
  try {
    await createNote({ content, type })
    toast.success('Note added')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleUpdateNote(noteId: string, content: string, type: NoteType) {
  try {
    await updateNote(noteId, { content, type })
    toast.success('Note updated')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleDeleteNote(noteId: string) {
  try {
    await deleteNote(noteId)
    toast.success('Note deleted')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

// Attachment handlers
async function handleUploadAttachment(file: File) {
  try {
    await uploadAttachment(file)
    toast.success('File uploaded')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleDeleteAttachment(attachmentId: string) {
  try {
    await deleteAttachment(attachmentId)
    toast.success('File deleted')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

function goBack() {
  router.push({ name: 'portfolio' })
}

function toggleSidebar() {
  showSidebar.value = !showSidebar.value
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="px-4 py-3 border-b bg-white flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button
          class="text-gray-500 hover:text-gray-700"
          @click="goBack"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" />
          </svg>
        </button>
        <div v-if="project">
          <h1 class="text-xl font-semibold text-gray-900">{{ project.title }}</h1>
          <p v-if="project.description" class="text-sm text-gray-500 mt-0.5">
            {{ project.description }}
          </p>
        </div>
        <div v-else class="text-gray-500">
          Project not found
        </div>
      </div>
      <Button
        v-if="project"
        variant="ghost"
        @click="toggleSidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
        </svg>
        <span class="ml-2">{{ showSidebar ? 'Hide Details' : 'Show Details' }}</span>
      </Button>
    </header>

    <div v-if="project" class="flex-1 flex overflow-hidden">
      <!-- Task Board -->
      <div class="flex-1 overflow-hidden p-4">
        <TaskBoard
          :tasksByStatus="tasksByStatus"
          :validStatuses="getValidStatuses()"
          @changeStatus="handleChangeStatus"
          @reorder="handleReorder"
          @openTask="handleOpenTask"
          @pinTask="handlePinTask"
          @deleteTask="handleDeleteTask"
          @createTask="showCreateModal = true"
        />
      </div>

      <!-- Sidebar -->
      <div
        v-if="showSidebar"
        class="w-80 border-l bg-gray-50 flex flex-col overflow-hidden"
      >
        <!-- Tabs -->
        <div class="flex border-b bg-white">
          <button
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
            :class="activeTab === 'notes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'notes'"
          >
            Notes ({{ sortedNotes.length }})
          </button>
          <button
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
            :class="activeTab === 'attachments'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'attachments'"
          >
            Files ({{ attachments.length }})
          </button>
        </div>

        <!-- Tab content -->
        <div class="flex-1 overflow-y-auto p-4">
          <NotesList
            v-if="activeTab === 'notes'"
            :notes="sortedNotes"
            @create="handleCreateNote"
            @update="handleUpdateNote"
            @delete="handleDeleteNote"
          />
          <AttachmentsList
            v-else
            :attachments="attachments"
            @upload="handleUploadAttachment"
            @delete="handleDeleteAttachment"
            @download="downloadAttachment"
          />
        </div>
      </div>
    </div>

    <!-- Create Task Modal -->
    <Modal :open="showCreateModal" title="New Task" @close="showCreateModal = false">
      <form @submit.prevent="handleCreateTask" class="space-y-4">
        <div>
          <label for="task-title" class="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="task-title"
            v-model="newTaskTitle"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Task title"
            autofocus
          />
        </div>
        <div>
          <label for="task-description" class="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="task-description"
            v-model="newTaskDescription"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief description"
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" @click="showCreateModal = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="!newTaskTitle.trim() || isCreating">
            {{ isCreating ? 'Creating...' : 'Create Task' }}
          </Button>
        </div>
      </form>
    </Modal>

    <!-- Blocked Reason Modal -->
    <Modal :open="showBlockedModal" title="Block Task" @close="showBlockedModal = false">
      <form @submit.prevent="handleBlockTask" class="space-y-4">
        <div>
          <label for="blocked-reason" class="block text-sm font-medium text-gray-700 mb-1">
            Why is this task blocked?
          </label>
          <textarea
            id="blocked-reason"
            v-model="blockedReason"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Waiting on API response, need clarification, etc."
            autofocus
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" @click="showBlockedModal = false">
            Cancel
          </Button>
          <Button variant="danger" type="submit" :disabled="!blockedReason.trim()">
            Block Task
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
