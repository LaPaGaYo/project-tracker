<script setup lang="ts">
interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const variantClasses = {
  default: 'bg-planka-card text-planka-text-muted',
  success: 'bg-planka-success/20 text-planka-success',
  warning: 'bg-planka-warning/20 text-planka-warning',
  danger: 'bg-planka-error/20 text-planka-error',
  info: 'bg-planka-accent/20 text-planka-accent',
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-2 py-0.5 rounded-planka text-xs font-medium',
      variantClasses[props.variant],
    ]"
  >
    <slot />
  </span>
</template>
