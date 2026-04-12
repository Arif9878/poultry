<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import MetricCard from '../components/MetricCard.vue'
import { dataVersion } from '../lib/appState'
import { getEggReportRows, getEggReportSummary } from '../services/eggReports.service'
import { listAccessibleFarms } from '../services/farms.service'
import type { EggReportRow, EggReportSummary, Farm } from '../types/models'
import { getTodayDate } from '../utils/formatDate'
import { formatCurrency, formatDecimal, formatNumber } from '../utils/formatNumber'

const route = useRoute()

const farms = ref<Farm[]>([])
const selectedFarmId = ref('')
const startDate = ref(getTodayDate())
const endDate = ref(getTodayDate())
const rows = ref<EggReportRow[]>([])
const summary = ref<EggReportSummary>({
  totalEggs: 0,
  totalEggWeightKg: 0,
  averageHenDay: 0,
  averageFcr: null,
  reportingFlocks: 0,
  totalFeedKg: 0,
  totalProfitRp: 0,
})
const loading = ref(false)
const error = ref('')

async function loadPage() {
  loading.value = true
  error.value = ''

  try {
    farms.value = await listAccessibleFarms()

    const routeFarmId = String(route.query.farmId ?? '')
    if (routeFarmId && farms.value.some((farm) => farm.id === routeFarmId)) {
      selectedFarmId.value = routeFarmId
    } else if (!selectedFarmId.value && farms.value[0]) {
      selectedFarmId.value = farms.value[0].id
    }

    if (!selectedFarmId.value) {
      rows.value = []
      summary.value = {
        totalEggs: 0,
        totalEggWeightKg: 0,
        averageHenDay: 0,
        averageFcr: null,
        reportingFlocks: 0,
        totalFeedKg: 0,
        totalProfitRp: 0,
      }
      return
    }

    const input = {
      farmId: selectedFarmId.value,
      startDate: startDate.value,
      endDate: endDate.value,
    }

    const [nextRows, nextSummary] = await Promise.all([
      getEggReportRows(input),
      getEggReportSummary(input),
    ])

    rows.value = nextRows
    summary.value = nextSummary
  } catch (nextError) {
    console.error(nextError)
    error.value =
      nextError instanceof Error ? nextError.message : 'Gagal memuat laporan telur'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadPage()
})

watch([selectedFarmId, startDate, endDate, dataVersion], () => {
  void loadPage()
})
</script>

<template>
  <AppLayout
    title="Laporan telur"
    subtitle="Pantau produksi telur layer, berat telur, FCR, dan laba harian."
  >
    <section class="surface-card">
      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <label class="app-label">Farm</label>
          <select v-model="selectedFarmId" class="app-input">
            <option v-for="farm in farms" :key="farm.id" :value="farm.id">{{ farm.name }}</option>
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

    <section v-if="loading" class="surface-card text-sm text-slate-500">Memuat laporan telur...</section>

    <template v-else>
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total telur" :value="`${formatNumber(summary.totalEggs)} butir`" helper="Akumulasi periode terpilih" />
        <MetricCard label="Total kg telur" :value="`${formatDecimal(summary.totalEggWeightKg)} kg`" helper="Konversi butir ke kilogram" />
        <MetricCard label="Rata-rata HD%" :value="`${formatDecimal(summary.averageHenDay)}%`" helper="Rata-rata performa produksi" />
        <MetricCard label="Rata-rata FCR" :value="summary.averageFcr !== null ? formatDecimal(summary.averageFcr, { maximumFractionDigits: 3 }) : '-'" helper="Feed dibagi total kg telur" />
        <MetricCard label="Flock pelapor" :value="formatNumber(summary.reportingFlocks)" helper="Jumlah flock layer yang mengisi laporan" />
        <MetricCard label="Feed terpakai" :value="`${formatDecimal(summary.totalFeedKg)} kg`" helper="Feed pada flock layer terlapor" />
        <MetricCard label="Total laba" :value="formatCurrency(summary.totalProfitRp)" helper="Omzet telur dikurangi biaya pakan" />
      </section>

      <section v-if="rows.length" class="space-y-4">
        <article v-for="row in rows" :key="row.id" class="surface-card">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-lg font-semibold text-ink">{{ row.flock_code }} • {{ row.flock_name }}</p>
              <p class="mt-1 text-sm text-slate-500">{{ row.log_date }} • populasi {{ formatNumber(row.live_population) }} ekor</p>
            </div>
            <span
              class="status-pill"
              :class="row.sync_status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'"
            >
              {{ row.sync_status }}
            </span>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <div class="rounded-2xl bg-slate-50 p-3">
              <p class="text-xs text-slate-500">Telur</p>
              <p class="font-semibold text-ink">{{ formatNumber(row.egg_count) }} butir</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <p class="text-xs text-slate-500">Kg telur</p>
              <p class="font-semibold text-ink">{{ formatDecimal(row.total_egg_weight_kg) }} kg</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <p class="text-xs text-slate-500">Hen-day</p>
              <p class="font-semibold text-ink">{{ formatDecimal(row.hen_day_percentage) }}%</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <p class="text-xs text-slate-500">FCR</p>
              <p class="font-semibold text-ink">
                {{ row.fcr !== null ? formatDecimal(row.fcr, { maximumFractionDigits: 3 }) : '-' }}
              </p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <p class="text-xs text-slate-500">Biaya pakan</p>
              <p class="font-semibold text-ink">{{ formatCurrency(row.feed_cost_rp) }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <p class="text-xs text-slate-500">Laba kotor</p>
              <p class="font-semibold text-ink">{{ formatCurrency(row.gross_profit_rp) }}</p>
            </div>
          </div>
        </article>
      </section>

      <EmptyState v-else title="Belum ada laporan telur" description="Isi daily log layer dengan jumlah telur agar laporan harian muncul di sini." />
    </template>
  </AppLayout>
</template>
