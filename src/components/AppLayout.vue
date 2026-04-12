<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import SyncBadge from './SyncBadge.vue'
import { onlineStatus, dataVersion, syncState } from '../lib/appState'
import { getPendingSyncCount, syncPendingLogs } from '../services/sync.service'
import { ref } from 'vue'

const props = defineProps<{
  title: string
  subtitle?: string
}>()

const route = useRoute()
const pendingCount = ref(0)

const navItems = computed(() => [
  { label: 'Dashboard', to: '/dashboard', active: route.path.startsWith('/dashboard') },
  { label: 'Farm', to: '/farms', active: route.path.startsWith('/farms') },
  { label: 'Pakan', to: '/feed', active: route.path.startsWith('/feed') },
  { label: 'Telur', to: '/egg-report', active: route.path.startsWith('/egg-report') },
  { label: 'History', to: '/history', active: route.path.startsWith('/history') },
  { label: 'Profil', to: '/profile', active: route.path.startsWith('/profile') },
])

async function refreshPendingCount() {
  pendingCount.value = await getPendingSyncCount()
}

onMounted(async () => {
  await refreshPendingCount()
  if (onlineStatus.value) {
    void syncPendingLogs().then(refreshPendingCount)
  }
})

watch([dataVersion, onlineStatus], async ([, isOnline]) => {
  if (isOnline) {
    void syncPendingLogs()
  }
  await refreshPendingCount()
})
</script>

<template>
  <div class="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5 md:px-6">
    <header class="mb-5 rounded-[2rem] bg-white/70 px-5 py-4 shadow-soft backdrop-blur">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Poultry MVP
          </p>
          <h1 class="mt-2 text-2xl font-bold text-ink">{{ props.title }}</h1>
          <p v-if="props.subtitle" class="mt-1 text-sm text-slate-500">
            {{ props.subtitle }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <SyncBadge
            :online="onlineStatus"
            :syncing="syncState.syncing"
            :pending="pendingCount"
          />
          <button class="btn-secondary !py-2.5" @click="syncPendingLogs().then(refreshPendingCount)">
            Sync now
          </button>
        </div>
      </div>
    </header>

    <main class="space-y-5">
      <slot />
    </main>

    <nav
      class="fixed bottom-3 left-1/2 z-10 grid w-[calc(100vw-1.25rem)] max-w-4xl -translate-x-1/2 grid-cols-6 gap-2 rounded-[1.75rem] border border-white/70 bg-white/90 p-2 shadow-soft backdrop-blur"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="rounded-2xl px-3 py-3 text-center text-xs font-semibold text-slate-500 transition"
        :class="item.active ? 'bg-emerald-50 text-moss' : 'hover:bg-slate-50'"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </div>
</template>
