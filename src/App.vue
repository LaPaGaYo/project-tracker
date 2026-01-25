<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import ToastHost from '@/components/ui/ToastHost.vue'
</script>

<template>
  <div class="min-h-screen bg-planka-bg text-planka-text">
    <nav class="bg-planka-bg-light border-b border-planka-card/50 px-4 py-2 flex items-center justify-between">
      <div class="flex items-center gap-1">
        <RouterLink
          to="/"
          class="px-3 py-1.5 text-sm font-medium text-planka-text hover:bg-planka-card rounded-planka transition-colors"
        >
          Portfolio
        </RouterLink>
        <RouterLink
          to="/today"
          class="px-3 py-1.5 text-sm font-medium text-planka-text hover:bg-planka-card rounded-planka transition-colors"
        >
          Today
        </RouterLink>
      </div>
      <div class="flex items-center gap-2">
        <RouterLink
          to="/settings"
          class="p-1.5 text-planka-text-muted hover:text-planka-text hover:bg-planka-card rounded-planka transition-colors"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
        </RouterLink>
      </div>
    </nav>
    <RouterView />
    <ToastHost />
  </div>
</template>
