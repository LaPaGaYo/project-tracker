<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useToast } from '@/composables/useToast'
import type { ProjectStage } from '@/types/project'
import { DEFAULT_WIP_LIMITS } from '@/types/policy'
import StageColumn from '@/components/portfolio/StageColumn.vue'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'

const router = useRouter()
const toast = useToast()
const {
  projectsByStage,
  createProject,
  changeStage,
  pinProject,
  deleteProject,
  reorderProject,
  getValidStages,
} = useProjects()

// Stages to display in order
const stages: ProjectStage[] = ['Idea', 'Planning', 'Active', 'Paused', 'Completed', 'Archived']

// WIP limits per stage
const wipLimits: Record<ProjectStage, number | undefined> = {
  Idea: undefined,
  Planning: DEFAULT_WIP_LIMITS.projects.Planning,
  Active: DEFAULT_WIP_LIMITS.projects.Active,
  Paused: undefined,
  Completed: undefined,
  Archived: undefined,
}

// Create project modal
const showCreateModal = ref(false)
const newProjectTitle = ref('')
const newProjectDescription = ref('')
const isCreating = ref(false)

async function handleCreateProject() {
  if (!newProjectTitle.value.trim()) return

  isCreating.value = true
  try {
    const project = await createProject({
      title: newProjectTitle.value.trim(),
      description: newProjectDescription.value.trim() || undefined,
    })
    toast.success('Project created')
    showCreateModal.value = false
    newProjectTitle.value = ''
    newProjectDescription.value = ''
    router.push({ name: 'project', params: { id: project.id } })
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    isCreating.value = false
  }
}

async function handleChangeStage(projectId: string, newStage: ProjectStage) {
  try {
    await changeStage(projectId, newStage)
    toast.success(`Moved to ${newStage}`)
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handlePinProject(projectId: string) {
  try {
    // Toggle pin: if pinned, unpin; if not, pin for today
    const projects = Object.values(projectsByStage.value).flat()
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const today = new Date().toISOString().split('T')[0]!
    const newPinnedDate = project.pinnedDate ? null : today
    await pinProject(projectId, newPinnedDate)
    toast.success(newPinnedDate ? 'Pinned for today' : 'Unpinned')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

async function handleDeleteProject(projectId: string) {
  if (!confirm('Are you sure you want to delete this project? This will also delete all tasks.')) {
    return
  }

  try {
    await deleteProject(projectId)
    toast.success('Project deleted')
  } catch (error) {
    toast.error((error as Error).message)
  }
}

function handleOpenProject(projectId: string) {
  router.push({ name: 'project', params: { id: projectId } })
}

async function handleReorderProject(projectId: string, newIndex: number) {
  try {
    await reorderProject(projectId, newIndex)
  } catch (error) {
    toast.error((error as Error).message)
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="px-4 py-3 border-b bg-white flex items-center justify-between">
      <h1 class="text-xl font-semibold text-gray-900">Portfolio</h1>
      <Button @click="showCreateModal = true">
        + New Project
      </Button>
    </header>

    <div class="flex-1 overflow-x-auto p-4">
      <div class="flex gap-4 h-full">
        <StageColumn
          v-for="stage in stages"
          :key="stage"
          :stage="stage"
          :projects="projectsByStage[stage]"
          :wipLimit="wipLimits[stage]"
          :validStages="getValidStages()"
          @changeStage="handleChangeStage"
          @reorder="handleReorderProject"
          @openProject="handleOpenProject"
          @pinProject="handlePinProject"
          @deleteProject="handleDeleteProject"
        />
      </div>
    </div>

    <Modal :open="showCreateModal" title="New Project" @close="showCreateModal = false">
      <form @submit.prevent="handleCreateProject" class="space-y-4">
        <div>
          <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            v-model="newProjectTitle"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Project title"
            autofocus
          />
        </div>
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="description"
            v-model="newProjectDescription"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief description"
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" @click="showCreateModal = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="!newProjectTitle.trim() || isCreating">
            {{ isCreating ? 'Creating...' : 'Create Project' }}
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
