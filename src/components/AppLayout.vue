<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import SyncBadge from './SyncBadge.vue'
import { dataVersion, onlineStatus, syncState } from '../lib/appState'
import { getPendingSyncCount, syncPendingLogs } from '../services/sync.service'

const props = defineProps<{
  title: string
  subtitle?: string
}>()

type NavItem = {
  label: string
  to: string
  icon: 'home' | 'history' | 'barn' | 'user' | 'plus' | 'feed' | 'egg'
  active: boolean
}

const route = useRoute()
const pendingCount = ref(0)

function isRouteActive(prefixes: string[]) {
  return prefixes.some((prefix) => route.path.startsWith(prefix))
}

function getIconPath(icon: NavItem['icon']) {
  switch (icon) {
    case 'home':
      return 'M3 10.25 12 3l9 7.25V21a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z'
    case 'history':
      return 'M12 8v5l3 2m6-3a9 9 0 1 1-2.64-6.36M21 3v5h-5'
    case 'barn':
      return 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm5 10v-5h6v5M10 11h4'
    case 'user':
      return 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0'
    case 'feed':
      return 'M5 6h14M7 10h10M9 14h6M7 18h10'
    case 'egg':
      return 'M12 3c3.2 0 5.5 4.34 5.5 8.42 0 4.1-2.6 8.08-5.5 8.08s-5.5-3.98-5.5-8.08C6.5 7.34 8.8 3 12 3Z'
    case 'plus':
      return 'M12 5v14M5 12h14'
  }
}

const rememberedFlockId = computed(() => {
  if (typeof route.params.flockId === 'string' && route.params.flockId) {
    return route.params.flockId
  }

  if (typeof route.query.flockId === 'string' && route.query.flockId) {
    return route.query.flockId
  }

  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem('lastOpenedFlockId') ?? ''
})

const rememberedFarmId = computed(() => {
  if (typeof route.query.farmId === 'string' && route.query.farmId) {
    return route.query.farmId
  }

  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem('selectedFarmId') ?? ''
})

const quickInputPath = computed(() => {
  const params = new URLSearchParams()

  if (rememberedFarmId.value) {
    params.set('farmId', rememberedFarmId.value)
  }

  if (rememberedFlockId.value) {
    params.set('flockId', rememberedFlockId.value)
  }

  const query = params.toString()
  return query ? `/input?${query}` : '/input'
})

const leftNavItems = computed<NavItem[]>(() => [
  {
    label: 'Beranda',
    to: '/dashboard',
    icon: 'home',
    active: isRouteActive(['/dashboard']),
  },
  {
    label: 'Riwayat',
    to: '/history',
    icon: 'history',
    active: isRouteActive(['/history', '/egg-report']),
  },
])

const rightNavItems = computed<NavItem[]>(() => [
  {
    label: 'Kandang',
    to: '/farms',
    icon: 'barn',
    active: isRouteActive(['/farms', '/flocks', '/feed']),
  },
  {
    label: 'Profil',
    to: '/profile',
    icon: 'user',
    active: isRouteActive(['/profile']),
  },
])

const secondaryNavItems = computed<NavItem[]>(() => {
  if (isRouteActive(['/dashboard'])) {
    return [
      { label: 'Pakan', to: '/feed', icon: 'feed', active: false },
      { label: 'Laporan telur', to: '/egg-report', icon: 'egg', active: false },
      { label: 'Kandang', to: '/farms', icon: 'barn', active: false },
    ]
  }

  if (isRouteActive(['/farms', '/flocks', '/feed'])) {
    return [
      { label: 'Beranda', to: '/dashboard', icon: 'home', active: false },
      { label: 'Pakan', to: '/feed', icon: 'feed', active: isRouteActive(['/feed']) },
      { label: 'Laporan telur', to: '/egg-report', icon: 'egg', active: false },
    ]
  }

  if (isRouteActive(['/history', '/egg-report'])) {
    return [
      { label: 'Beranda', to: '/dashboard', icon: 'home', active: false },
      { label: 'Laporan telur', to: '/egg-report', icon: 'egg', active: isRouteActive(['/egg-report']) },
      { label: 'Kandang', to: '/farms', icon: 'barn', active: false },
    ]
  }

  return [
    { label: 'Beranda', to: '/dashboard', icon: 'home', active: false },
    { label: 'Riwayat', to: '/history', icon: 'history', active: false },
    { label: 'Kandang', to: '/farms', icon: 'barn', active: false },
  ]
})

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
  <div class="mx-auto min-h-screen max-w-3xl px-3 pb-32 pt-3 sm:px-4 md:px-6">
    <header class="sticky top-3 z-20 mb-4 rounded-[1.75rem] bg-white/85 px-4 py-4 shadow-soft backdrop-blur sm:px-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Pencatatan peternakan
          </p>
          <h1 class="mt-2 text-xl font-bold text-ink sm:text-2xl">
            {{ props.title }}
          </h1>
          <p v-if="props.subtitle" class="mt-1 text-sm leading-6 text-slate-500">
            {{ props.subtitle }}
          </p>
        </div>

        <div class="flex items-center justify-between gap-3 sm:justify-end">
          <SyncBadge :online="onlineStatus" :syncing="syncState.syncing" :pending="pendingCount" />
          <button class="btn-secondary !h-11 !px-3 !py-2 sm:!px-4" @click="syncPendingLogs().then(refreshPendingCount)">
            <span class="sm:hidden">Sync</span>
            <span class="hidden sm:inline">Sync now</span>
          </button>
        </div>
      </div>
    </header>

    <div class="mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
      <RouterLink
        v-for="item in secondaryNavItems"
        :key="item.to"
        :to="item.to"
        class="subnav-chip whitespace-nowrap"
        :class="item.active ? 'subnav-chip-active' : ''"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path :d="getIconPath(item.icon)" />
        </svg>
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>

    <main class="space-y-5">
      <slot />
    </main>

    <nav class="bottom-nav">
      <RouterLink
        v-for="item in leftNavItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav-link"
        :class="item.active ? 'bottom-nav-link-active' : ''"
      >
        <span class="bottom-nav-icon" :class="item.active ? 'bg-emerald-100 text-moss' : 'bg-slate-100 text-slate-500'">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="getIconPath(item.icon)" />
          </svg>
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>

      <RouterLink class="bottom-nav-action" :class="route.path.includes('/logs/new') || route.path.startsWith('/input') ? 'text-moss' : 'text-slate-500'" :to="quickInputPath">
        <span class="bottom-nav-action-icon">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path :d="getIconPath('plus')" />
          </svg>
        </span>
        <span>Input</span>
      </RouterLink>

      <RouterLink
        v-for="item in rightNavItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav-link"
        :class="item.active ? 'bottom-nav-link-active' : ''"
      >
        <span class="bottom-nav-icon" :class="item.active ? 'bg-emerald-100 text-moss' : 'bg-slate-100 text-slate-500'">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="getIconPath(item.icon)" />
          </svg>
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
