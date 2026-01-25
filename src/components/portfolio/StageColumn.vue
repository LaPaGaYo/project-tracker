<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import type { Project, ProjectStage } from '@/types/project'
import ProjectCard from './ProjectCard.vue'

const props = defineProps<{
  stage: ProjectStage
  projects: Project[]
  wipLimit?: number
  validStages: ProjectStage[]
}>()

const emit = defineEmits<{
  changeStage: [projectId: string, newStage: ProjectStage]
  reorder: [projectId: string, newIndex: number]
  openProject: [projectId: string]
  pinProject: [projectId: string]
  deleteProject: [projectId: string]
}>()

const isAtLimit = computed(() => {
  if (!props.wipLimit) return false
  return props.projects.length >= props.wipLimit
})

const isOverLimit = computed(() => {
  if (!props.wipLimit) return false
  return props.projects.length > props.wipLimit
})

const wipDisplay = computed(() => {
  if (!props.wipLimit) return null
  return `${props.projects.length}/${props.wipLimit}`
})

// Planka-style dark columns
const stageColors: Record<ProjectStage, string> = {
  Idea: 'bg-planka-bg-light border-planka-card/50',
  Planning: 'bg-planka-bg-light border-planka-card/50',
  Active: 'bg-planka-bg-light border-planka-card/50',
  Paused: 'bg-planka-bg-light border-planka-card/50',
  Completed: 'bg-planka-bg-light border-planka-card/50',
  Archived: 'bg-planka-bg-light border-planka-card/50',
}

// Accent colors for stage headers
const headerColors: Record<ProjectStage, string> = {
  Idea: 'text-planka-text-muted',
  Planning: 'text-planka-accent',
  Active: 'text-planka-success',
  Paused: 'text-planka-warning',
  Completed: 'text-purple-400',
  Archived: 'text-planka-text-muted',
}

// Handle drag end - emit appropriate event based on what changed
function handleDragChange(event: { added?: { element: Project; newIndex: number }; moved?: { element: Project; newIndex: number } }) {
  if (event.added) {
    // Project was dragged from another column into this one
    emit('changeStage', event.added.element.id, props.stage)
  } else if (event.moved) {
    // Project was reordered within the same column
    emit('reorder', event.moved.element.id, event.moved.newIndex)
  }
}
</script>

<template>
  <div
    class="flex-shrink-0 w-72 border rounded-planka-lg flex flex-col max-h-full"
    :class="stageColors[stage]"
  >
    <div class="p-3 border-b border-planka-card/50 flex items-center justify-between">
      <h2 class="font-semibold text-sm uppercase tracking-wide" :class="headerColors[stage]">
        {{ stage }}
      </h2>
      <div class="flex items-center gap-2">
        <span
          v-if="wipDisplay"
          class="text-xs font-medium px-2 py-0.5 rounded-planka"
          :class="{
            'bg-planka-error/20 text-planka-error': isOverLimit,
            'bg-planka-warning/20 text-planka-warning': isAtLimit && !isOverLimit,
            'bg-planka-card text-planka-text-muted': !isAtLimit,
          }"
        >
          {{ wipDisplay }}
        </span>
        <span class="text-xs text-planka-text-muted">
          {{ projects.length }}
        </span>
      </div>
    </div>

    <draggable
      :list="projects"
      group="projects"
      item-key="id"
      class="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]"
      ghost-class="opacity-50"
      @change="handleDragChange"
    >
      <template #item="{ element: project }">
        <ProjectCard
          :project="project"
          :validStages="validStages"
          @changeStage="emit('changeStage', project.id, $event)"
          @click="emit('openProject', project.id)"
          @pin="emit('pinProject', project.id)"
          @delete="emit('deleteProject', project.id)"
        />
      </template>
    </draggable>

    <div
      v-if="projects.length === 0"
      class="text-center py-8 text-planka-text-muted text-sm"
    >
      No projects
    </div>
  </div>
</template>
