<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import { useHistory } from '../composables/useHistory'
import { dataVersion } from '../lib/appState'
import { downloadCsv } from '../utils/exportCsv'
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

function exportHistory() {
  downloadCsv(
    'riwayat-harian.csv',
    ['Tanggal', 'Kandang', 'Kode', 'Feed kg', 'Ayam mati', 'Populasi', 'Telur', 'Bobot gram', 'Catatan'],
    logs.value.map((log) => [
      log.log_date,
      log.flock?.name ?? '-',
      log.flock?.code ?? '-',
      log.feed_used_kg,
      log.mortality_count,
      log.live_population,
      log.egg_count,
      log.avg_weight_gram ?? '',
      log.notes ?? '',
    ]),
  )
}

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
    title="Riwayat"
    subtitle="Lihat catatan harian berdasarkan peternakan, kandang, dan tanggal."
  >
    <section class="surface-card">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div>
          <label class="app-label">Peternakan</label>
          <select v-model="farmId" class="app-input">
            <option value="">Semua peternakan</option>
            <option v-for="farm in farms" :key="farm.id" :value="farm.id">{{ farm.name }}</option>
          </select>
        </div>
        <div>
          <label class="app-label">Kandang</label>
          <select v-model="flockId" class="app-input">
            <option value="">Semua kandang</option>
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
        <div class="flex items-end">
          <button class="btn-secondary" type="button" @click="exportHistory">Export CSV</button>
        </div>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat riwayat...
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
            <p class="text-xs text-slate-500">Ayam mati</p>
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
        title="Belum ada riwayat"
        description="Ubah filter atau isi catatan harian baru untuk melihat riwayat."
      />
  </AppLayout>
</template>
