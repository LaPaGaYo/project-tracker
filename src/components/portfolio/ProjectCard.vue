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

const actionItems = computed(() => [
  {
    label: isPinned.value ? 'Unpin' : 'Pin for Today',
    value: 'pin',
  },
  {
    label: 'Delete Project',
    value: 'delete',
  },
])

function handleAction(action: string) {
  if (action === 'pin') {
    emit('pin')
  } else if (action === 'delete') {
    emit('delete')
  }
}

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
    class="bg-planka-card rounded-planka p-3 hover:bg-planka-card/80 transition-colors cursor-pointer"
    @click="emit('click')"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-planka-text truncate">{{ project.title }}</h3>
        <p v-if="project.description" class="text-sm text-planka-text-muted mt-1 line-clamp-2">
          {{ project.description }}
        </p>
      </div>
      <button
        v-if="isPinned"
        class="text-planka-warning hover:text-yellow-400 flex-shrink-0"
        title="Pinned"
        @click.stop="emit('pin')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div class="flex items-center justify-between mt-3 pt-2 border-t border-planka-bg-light">
      <div @click.stop>
        <Dropdown
          :items="stageItems"
          @select="handleStageChange"
        >
          <template #trigger>
            <button class="text-sm text-planka-text-muted hover:text-planka-text flex items-center gap-1">
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

        <div @click.stop>
          <Dropdown
            :items="actionItems"
            @select="handleAction"
          >
            <template #trigger>
              <button
                class="text-planka-text-muted hover:text-planka-text transition-colors p-1 -m-1 rounded-planka hover:bg-planka-bg-light"
                title="More options"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                </svg>
              </button>
            </template>
          </Dropdown>
        </div>
      </div>
    </div>
  </div>
</template>
