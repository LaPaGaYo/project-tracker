<script setup lang="ts">
import type { Toast } from '@/composables/useToast'

interface Props {
  toast: Toast
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const typeClasses = {
  success: 'bg-planka-card border-planka-success text-planka-text',
  error: 'bg-planka-card border-planka-error text-planka-text',
  warning: 'bg-planka-card border-planka-warning text-planka-text',
  info: 'bg-planka-card border-planka-accent text-planka-text',
}
</script>

<template>
  <div
    :class="[
      'flex items-center justify-between p-4 rounded-planka border-l-4 shadow-lg',
      typeClasses[toast.type],
    ]"
  >
    <span>{{ toast.message }}</span>
    <button
      class="ml-4 text-planka-text-muted hover:text-planka-text transition-colors"
      @click="emit('close')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
