<script setup lang="ts">
import { computed } from 'vue'
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

const stageColors: Record<ProjectStage, string> = {
  Idea: 'bg-gray-50 border-gray-200',
  Planning: 'bg-blue-50 border-blue-200',
  Active: 'bg-green-50 border-green-200',
  Paused: 'bg-yellow-50 border-yellow-200',
  Completed: 'bg-purple-50 border-purple-200',
  Archived: 'bg-gray-100 border-gray-300',
}

const headerColors: Record<ProjectStage, string> = {
  Idea: 'text-gray-700',
  Planning: 'text-blue-700',
  Active: 'text-green-700',
  Paused: 'text-yellow-700',
  Completed: 'text-purple-700',
  Archived: 'text-gray-600',
}
</script>

<template>
  <div
    class="flex-shrink-0 w-72 border rounded-lg flex flex-col max-h-full"
    :class="stageColors[stage]"
  >
    <div class="p-3 border-b flex items-center justify-between" :class="stageColors[stage]">
      <h2 class="font-semibold" :class="headerColors[stage]">
        {{ stage }}
      </h2>
      <div class="flex items-center gap-2">
        <span
          v-if="wipDisplay"
          class="text-sm font-medium px-2 py-0.5 rounded"
          :class="{
            'bg-red-100 text-red-700': isOverLimit,
            'bg-yellow-100 text-yellow-700': isAtLimit && !isOverLimit,
            'bg-gray-100 text-gray-600': !isAtLimit,
          }"
        >
          {{ wipDisplay }}
        </span>
        <span class="text-sm text-gray-500">
          {{ projects.length }}
        </span>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :validStages="validStages"
        @changeStage="emit('changeStage', project.id, $event)"
        @click="emit('openProject', project.id)"
        @pin="emit('pinProject', project.id)"
        @delete="emit('deleteProject', project.id)"
      />

      <div
        v-if="projects.length === 0"
        class="text-center py-8 text-gray-400 text-sm"
      >
        No projects
      </div>
    </div>
  </div>
</template>
