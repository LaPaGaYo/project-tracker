<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
})

const variantClasses = {
  primary: 'bg-planka-accent text-white hover:bg-planka-accent-hover disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'bg-planka-card text-planka-text hover:bg-planka-bg-light disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'bg-planka-error text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost: 'bg-transparent text-planka-text-muted hover:bg-planka-card hover:text-planka-text disabled:opacity-50 disabled:cursor-not-allowed',
}

const sizeClasses = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}
</script>

<template>
  <button
    :class="[
      'rounded-planka font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-planka-accent focus:ring-offset-2 focus:ring-offset-planka-bg',
      variantClasses[props.variant],
      sizeClasses[props.size],
    ]"
    :disabled="props.disabled"
  >
    <slot />
  </button>
</template>
