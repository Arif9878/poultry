<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import { useHistory } from '../composables/useHistory'
import { dataVersion } from '../lib/appState'
import { formatDate } from '../utils/formatDate'
import { formatDecimal, formatNumber } from '../utils/formatNumber'

const {
  farms,
  flocks,
  farmId,
  flockId,
  startDate,
  endDate,
  logs,
  loading,
  error,
  loadHistory,
  loadFilters,
} = useHistory()

onMounted(async () => {
  await loadFilters()
  await loadHistory()
})

watch(dataVersion, () => {
  void loadHistory()
})
</script>

<template>
  <AppLayout
    title="History Log"
    subtitle="Filter log per farm, flock, dan tanggal untuk audit operasional."
  >
    <section class="surface-card">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label class="app-label">Farm</label>
          <select v-model="farmId" class="app-input">
            <option value="">Semua farm</option>
            <option v-for="farm in farms" :key="farm.id" :value="farm.id">{{ farm.name }}</option>
          </select>
        </div>
        <div>
          <label class="app-label">Flock</label>
          <select v-model="flockId" class="app-input">
            <option value="">Semua flock</option>
            <option v-for="flock in flocks" :key="flock.id" :value="flock.id">{{ flock.name }}</option>
          </select>
        </div>
        <div>
          <label class="app-label">Mulai</label>
          <input v-model="startDate" class="app-input" type="date" />
        </div>
        <div>
          <label class="app-label">Sampai</label>
          <input v-model="endDate" class="app-input" type="date" />
        </div>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat history...
    </section>

    <section v-else-if="logs.length" class="space-y-4">
      <article
        v-for="log in logs"
        :key="log.id"
        class="surface-card"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-ink">{{ formatDate(log.log_date) }}</p>
            <p class="mt-1 text-sm text-slate-500">
              {{ log.flock?.code }} • {{ log.flock?.name }}
            </p>
          </div>
          <span
            class="status-pill"
            :class="log.sync_status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'"
          >
            {{ log.sync_status }}
          </span>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Feed</p>
            <p class="font-semibold text-ink">{{ formatDecimal(log.feed_used_kg) }} kg</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Mortalitas</p>
            <p class="font-semibold text-ink">{{ formatNumber(log.mortality_count) }} ekor</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Populasi</p>
            <p class="font-semibold text-ink">{{ formatNumber(log.live_population) }} ekor</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Telur</p>
            <p class="font-semibold text-ink">{{ formatNumber(log.egg_count) }} butir</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Bobot</p>
            <p class="font-semibold text-ink">{{ formatDecimal(log.avg_weight_gram) }} g</p>
          </div>
        </div>

        <p class="mt-4 text-sm text-slate-600">{{ log.notes || 'Tanpa catatan' }}</p>
      </article>
    </section>

    <EmptyState
      v-else
      title="Belum ada data history"
      description="Ubah filter atau isi log baru untuk melihat riwayat operasional."
    />
  </AppLayout>
</template>
