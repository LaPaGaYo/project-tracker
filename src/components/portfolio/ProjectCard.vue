<script setup lang="ts">
import { computed } from 'vue'
import type { Project, ProjectStage } from '@/types/project'
import Badge from '@/components/ui/Badge.vue'
import Dropdown from '@/components/ui/Dropdown.vue'

const props = defineProps<{
  project: Project
  validStages: ProjectStage[]
}>()

const emit = defineEmits<{
  changeStage: [stage: ProjectStage]
  click: []
  pin: []
  delete: []
}>()

const stageItems = computed(() =>
  props.validStages.map(stage => ({
    label: stage,
    value: stage,
  }))
)

const isPinned = computed(() => props.project.pinnedDate !== null)

function handleStageChange(stage: string) {
  emit('changeStage', stage as ProjectStage)
}

const stageColors: Record<ProjectStage, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  Idea: 'default',
  Planning: 'info',
  Active: 'success',
  Paused: 'warning',
  Completed: 'info',
  Archived: 'default',
}
</script>

<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    @click="emit('click')"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate">{{ project.title }}</h3>
        <p v-if="project.description" class="text-sm text-gray-500 mt-1 line-clamp-2">
          {{ project.description }}
        </p>
      </div>
      <button
        v-if="isPinned"
        class="text-yellow-500 hover:text-yellow-600 flex-shrink-0"
        title="Pinned"
        @click.stop="emit('pin')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
      <div @click.stop>
        <Dropdown
          :items="stageItems"
          @select="handleStageChange"
        >
          <template #trigger>
            <button class="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
              Move to
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </button>
          </template>
        </Dropdown>
      </div>

      <div class="flex items-center gap-2">
        <Badge :variant="stageColors[project.stage]">
          {{ project.stage }}
        </Badge>

        <button
          class="text-gray-400 hover:text-gray-600"
          title="More options"
          @click.stop
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
