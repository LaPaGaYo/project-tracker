<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Project {{ route.params.id }}</h1>
  </div>
</template>
