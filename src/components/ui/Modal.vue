<script setup lang="ts">
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'radix-vue'

interface Props {
  open?: boolean
  title?: string
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/50 z-40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-planka-card border border-planka-bg-light rounded-planka-lg shadow-xl p-6 w-full max-w-md z-50 focus:outline-none"
      >
        <DialogTitle v-if="props.title" class="text-lg font-semibold mb-2 text-planka-text">
          {{ props.title }}
        </DialogTitle>
        <DialogDescription v-if="props.description" class="text-planka-text-muted mb-4">
          {{ props.description }}
        </DialogDescription>
        <slot />
        <DialogClose
          class="absolute top-4 right-4 text-planka-text-muted hover:text-planka-text transition-colors"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
