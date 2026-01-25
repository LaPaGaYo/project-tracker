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
  success: 'bg-green-50 border-green-500 text-green-800',
  error: 'bg-red-50 border-red-500 text-red-800',
  warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
  info: 'bg-blue-50 border-blue-500 text-blue-800',
}
</script>

<template>
  <div
    :class="[
      'flex items-center justify-between p-4 rounded-lg border-l-4 shadow-md',
      typeClasses[toast.type],
    ]"
  >
    <span>{{ toast.message }}</span>
    <button
      class="ml-4 text-current opacity-50 hover:opacity-100"
      @click="emit('close')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
