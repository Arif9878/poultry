<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import SyncBadge from "./SyncBadge.vue";
import { onlineStatus, dataVersion, syncState } from "../lib/appState";
import { getPendingSyncCount, syncPendingLogs } from "../services/sync.service";
import { ref } from "vue";

const props = defineProps<{
  title: string;
  subtitle?: string;
}>();

const route = useRoute();
const pendingCount = ref(0);

const navItems = computed(() => [
  {
    label: "Dashboard",
    shortLabel: "Home",
    to: "/dashboard",
    active: route.path.startsWith("/dashboard"),
  },
  {
    label: "Farm",
    shortLabel: "Farm",
    to: "/farms",
    active: route.path.startsWith("/farms"),
  },
  {
    label: "Pakan",
    shortLabel: "Pakan",
    to: "/feed",
    active: route.path.startsWith("/feed"),
  },
  {
    label: "Telur",
    shortLabel: "Telur",
    to: "/egg-report",
    active: route.path.startsWith("/egg-report"),
  },
  {
    label: "History",
    shortLabel: "Riwayat",
    to: "/history",
    active: route.path.startsWith("/history"),
  },
  {
    label: "Profil",
    shortLabel: "Profil",
    to: "/profile",
    active: route.path.startsWith("/profile"),
  },
]);

async function refreshPendingCount() {
  pendingCount.value = await getPendingSyncCount();
}

onMounted(async () => {
  await refreshPendingCount();
  if (onlineStatus.value) {
    void syncPendingLogs().then(refreshPendingCount);
  }
});

watch([dataVersion, onlineStatus], async ([, isOnline]) => {
  if (isOnline) {
    void syncPendingLogs();
  }
  await refreshPendingCount();
});
</script>

<template>
  <div class="mx-auto min-h-screen max-w-3xl px-3 pb-28 pt-3 sm:px-4 md:px-6">
    <header
      class="sticky top-3 z-20 mb-5 rounded-[1.75rem] bg-white/85 px-4 py-4 shadow-soft backdrop-blur sm:px-5"
    >
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div class="min-w-0">
          <p
            class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
          >
            Poultry MVP
          </p>
          <h1 class="mt-2 text-xl font-bold text-ink sm:text-2xl">
            {{ props.title }}
          </h1>
          <p
            v-if="props.subtitle"
            class="mt-1 text-sm leading-6 text-slate-500"
          >
            {{ props.subtitle }}
          </p>
        </div>

        <div class="flex items-center justify-between gap-3 sm:justify-end">
          <SyncBadge
            :online="onlineStatus"
            :syncing="syncState.syncing"
            :pending="pendingCount"
          />
          <button
            class="btn-secondary !h-11 !px-3 !py-2 sm:!px-4"
            @click="syncPendingLogs().then(refreshPendingCount)"
          >
            <span class="sm:hidden">Sync</span>
            <span class="hidden sm:inline">Sync now</span>
          </button>
        </div>
      </div>
    </header>

    <main class="space-y-5">
      <slot />
    </main>

    <nav
      class="fixed bottom-3 left-1/2 z-20 flex w-[calc(100vw-1rem)] max-w-4xl -translate-x-1/2 gap-2 overflow-x-auto rounded-[1.5rem] border border-white/70 bg-white/95 p-2 shadow-soft backdrop-blur"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="min-w-[4.75rem] flex-1 rounded-2xl px-3 py-3 text-center text-[11px] font-semibold leading-tight text-slate-500 transition sm:min-w-0 sm:text-xs"
        :class="item.active ? 'bg-emerald-50 text-moss' : 'hover:bg-slate-50'"
      >
        <span class="sm:hidden">{{ item.shortLabel }}</span>
        <span class="hidden sm:inline">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
