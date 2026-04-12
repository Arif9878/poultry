<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { useAuth } from '../composables/useAuth'
import { dataVersion, onlineStatus, syncState } from '../lib/appState'
import { listAccessibleFarms } from '../services/farms.service'
import { countAccessibleFlocks } from '../services/flocks.service'
import { getPendingSyncCount, syncPendingLogs } from '../services/sync.service'
import { formatDate } from '../utils/formatDate'
import { formatNumber } from '../utils/formatNumber'

const router = useRouter()
const { profile, logout } = useAuth()

const farms = ref<Array<{ id: string; name: string }>>([])
const flockCount = ref(0)
const pendingCount = ref(0)

const roleLabel = computed(() => profile.value?.role ?? '-')

async function loadPage() {
  farms.value = await listAccessibleFarms()
  flockCount.value = await countAccessibleFlocks()
  pendingCount.value = await getPendingSyncCount()
}

async function handleLogout() {
  await logout()
  await router.replace('/login')
}

async function handleSyncNow() {
  await syncPendingLogs()
  await loadPage()
}

onMounted(() => {
  void loadPage()
})

watch([dataVersion, syncState], () => {
  void loadPage()
})
</script>

<template>
  <AppLayout
    title="Profil Pengguna"
    subtitle="Lihat role, akses farm, dan status offline sync pada akun aktif."
  >
    <section class="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <article class="surface-card">
        <span class="status-pill bg-emerald-100 text-emerald-700">{{ roleLabel }}</span>
        <h2 class="mt-4 text-2xl font-bold text-ink">{{ profile?.full_name }}</h2>
        <p class="mt-1 text-sm text-slate-500">{{ profile?.email }}</p>

        <div class="mt-6 grid gap-3">
          <div class="rounded-3xl bg-slate-50 p-4">
            <p class="text-xs text-slate-500">Phone</p>
            <p class="mt-1 font-semibold text-ink">{{ profile?.phone || '-' }}</p>
          </div>
          <div class="rounded-3xl bg-slate-50 p-4">
            <p class="text-xs text-slate-500">Akses farm</p>
            <p class="mt-1 font-semibold text-ink">{{ formatNumber(farms.length) }} farm</p>
          </div>
          <div class="rounded-3xl bg-slate-50 p-4">
            <p class="text-xs text-slate-500">Akses flock</p>
            <p class="mt-1 font-semibold text-ink">{{ formatNumber(flockCount) }} flock</p>
          </div>
        </div>

        <button class="btn-secondary mt-6 w-full" @click="handleLogout">Logout</button>
      </article>

      <article class="surface-card">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-ink">Sync & akses</p>
            <p class="text-sm text-slate-500">Queue offline akan otomatis disinkronkan saat online.</p>
          </div>
          <button class="btn-primary !py-2.5" @click="handleSyncNow">Sync now</button>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-3xl bg-slate-50 p-4">
            <p class="text-xs text-slate-500">Koneksi</p>
            <p class="mt-1 font-semibold text-ink">{{ onlineStatus ? 'Online' : 'Offline' }}</p>
          </div>
          <div class="rounded-3xl bg-slate-50 p-4">
            <p class="text-xs text-slate-500">Pending sync</p>
            <p class="mt-1 font-semibold text-ink">{{ formatNumber(pendingCount) }}</p>
          </div>
          <div class="rounded-3xl bg-slate-50 p-4">
            <p class="text-xs text-slate-500">Sync terakhir</p>
            <p class="mt-1 font-semibold text-ink">
              {{ syncState.lastSyncedAt ? formatDate(syncState.lastSyncedAt) : '-' }}
            </p>
          </div>
        </div>

        <div class="mt-6 rounded-3xl bg-emerald-50 p-4">
          <p class="text-sm font-semibold text-ink">Farm yang bisa diakses</p>
          <div class="mt-3 space-y-2">
            <div
              v-for="farm in farms"
              :key="farm.id"
              class="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700"
            >
              {{ farm.name }}
            </div>
          </div>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
