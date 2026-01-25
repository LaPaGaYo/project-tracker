<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import ToastHost from '@/components/ui/ToastHost.vue'
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <nav class="bg-white shadow p-4 flex gap-4">
      <RouterLink to="/" class="text-blue-600 hover:underline">Portfolio</RouterLink>
      <RouterLink to="/today" class="text-blue-600 hover:underline">Today</RouterLink>
    </nav>
    <RouterView />
    <ToastHost />
  </div>
</template>
