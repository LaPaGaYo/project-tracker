<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'radix-vue'

interface MenuItem {
  label: string
  value: string
  disabled?: boolean
}

interface Props {
  items: MenuItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  select: [value: string]
}>()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="bg-planka-card rounded-planka shadow-lg border border-planka-bg-light py-1 min-w-[160px] z-50"
        :side-offset="5"
      >
        <DropdownMenuItem
          v-for="item in items"
          :key="item.value"
          :disabled="item.disabled"
          class="px-3 py-2 text-sm text-planka-text cursor-pointer hover:bg-planka-bg-light focus:bg-planka-bg-light focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          @select="emit('select', item.value)"
        >
          {{ item.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
