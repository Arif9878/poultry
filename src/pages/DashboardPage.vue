<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import MetricCard from '../components/MetricCard.vue'
import { useAuth } from '../composables/useAuth'
import { useDashboard } from '../composables/useDashboard'
import { dataVersion } from '../lib/appState'
import { listAnomalyAlertsByFarm } from '../services/anomalies.service'
import type { AnomalyAlert } from '../types/models'
import { formatDate } from '../utils/formatDate'
import { formatCurrency, formatDecimal, formatNumber } from '../utils/formatNumber'
import { getFlockTypeLabel } from '../utils/flock'
import { ref } from 'vue'

const { profile } = useAuth()
const {
  farms,
  selectedFarmId,
  selectedDate,
  summary,
  activeFlocks,
  trend,
  loading,
  error,
  loadDashboard,
} = useDashboard()
const anomalyAlerts = ref<AnomalyAlert[]>([])

const dashboardAlerts = computed(() =>
  [
    summary.value.hdBelowTarget
      ? `HD ${formatDecimal(summary.value.averageHdPercent)}% di bawah target ${formatDecimal(summary.value.targetHdPercent)}%`
      : null,
    summary.value.fcrAboveLimit && summary.value.averageFcr !== null
      ? `FCR ${formatDecimal(summary.value.averageFcr, { maximumFractionDigits: 3 })} melewati batas ${formatDecimal(summary.value.maxFcr, { maximumFractionDigits: 3 })}`
      : null,
    summary.value.feedBelowSafetyStock && summary.value.estimatedFeedStockDays !== null
      ? `Stok pakan diperkirakan tinggal ${formatDecimal(summary.value.estimatedFeedStockDays, { maximumFractionDigits: 1 })} hari`
      : null,
  ].filter(Boolean) as string[],
)

async function loadPage() {
  await loadDashboard()
  if (selectedFarmId.value) {
    anomalyAlerts.value = await listAnomalyAlertsByFarm(selectedFarmId.value, selectedDate.value)
  } else {
    anomalyAlerts.value = []
  }
}

onMounted(() => {
  void loadPage()
})

watch(dataVersion, () => {
  void loadPage()
})

watch([selectedFarmId, selectedDate], () => {
  if (selectedFarmId.value) {
    void listAnomalyAlertsByFarm(selectedFarmId.value, selectedDate.value).then((nextAlerts) => {
      anomalyAlerts.value = nextAlerts
    })
  }
})
</script>

<template>
  <AppLayout
    title="Beranda"
    :subtitle="`Halo, ${profile?.full_name ?? 'tim peternakan'} — cek telur, pakan, dan kandang hari ini lebih cepat.`"
  >
    <section class="surface-card bg-gradient-to-br from-emerald-900 to-moss text-white">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
            Ringkasan hari ini
          </p>
          <h2 class="mt-2 text-3xl font-bold">
            Data penting harian dalam satu layar.
          </h2>
          <p class="mt-3 max-w-2xl text-sm text-emerald-50/90">
            Pilih peternakan dan tanggal untuk melihat telur, pakan, laba, dan tren 7 hari terakhir.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Peternakan
            </label>
            <select v-model="selectedFarmId" class="app-input !border-white/10 !bg-white !text-slate-800">
              <option v-for="farm in farms" :key="farm.id" :value="farm.id">{{ farm.name }}</option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Tanggal
            </label>
            <input v-model="selectedDate" class="app-input !border-white/10 !bg-white !text-slate-800" type="date" />
          </div>
        </div>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat dashboard...
    </section>

    <template v-else>
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total telur"
          :value="`${formatNumber(summary.eggProduction)} butir`"
            helper="Akumulasi kandang layer pada tanggal terpilih"
        />
        <MetricCard
          label="Total kg telur"
          :value="`${formatDecimal(summary.totalEggWeightKg)} kg`"
          helper="Butir dikonversi dengan berat telur per butir"
        />
        <MetricCard
          label="Rata-rata HD%"
          :value="`${formatDecimal(summary.averageHdPercent)}%`"
           :helper="summary.targetHdPercent !== null ? `Target ${formatDecimal(summary.targetHdPercent)}%` : 'Belum ada target kandang layer'"
        />
        <MetricCard
          label="Rata-rata FCR"
          :value="summary.averageFcr !== null ? formatDecimal(summary.averageFcr, { maximumFractionDigits: 3 }) : '-'"
          :helper="summary.maxFcr !== null ? `Batas ${formatDecimal(summary.maxFcr, { maximumFractionDigits: 3 })}` : 'Belum ada batas FCR'"
        />
        <MetricCard
          label="Total laba"
          :value="formatCurrency(summary.totalProfitRp)"
          helper="Pendapatan telur dikurangi biaya pakan"
        />
        <MetricCard
          label="Stok pakan terakhir"
          :value="`${formatDecimal(summary.lastFeedStockKg)} kg`"
          :helper="`Status ${summary.feedStockStatus}`"
        />
        <MetricCard
          label="Rata-rata pakan harian"
          :value="`${formatDecimal(summary.averageDailyFeedUsageKg)} kg`"
          helper="Rata-rata dari hari yang punya log pakan"
        />
        <MetricCard
          label="Konsumsi per ekor"
          :value="summary.averageFeedPerBirdKg !== null ? `${formatDecimal(summary.averageFeedPerBirdKg * 1000, { maximumFractionDigits: 1 })} g` : '-'"
          helper="Berdasarkan input pakan hari terpilih"
        />
        <MetricCard
          label="Perkiraan stok tersisa"
          :value="summary.estimatedFeedStockDays !== null ? `${formatDecimal(summary.estimatedFeedStockDays, { maximumFractionDigits: 1 })} hari` : '-'"
          :helper="summary.safetyStockDays !== null ? `Safety stock ${formatDecimal(summary.safetyStockDays, { maximumFractionDigits: 1 })} hari` : 'Butuh histori konsumsi pakan'"
        />
        <MetricCard
          label="Status operasional"
          :value="`${formatNumber(summary.activeFlockCount)} kandang aktif`"
          :helper="`Pending sync ${formatNumber(summary.pendingSyncCount)} log`"
        />
      </section>

      <section class="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article class="surface-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-ink">Trend 7 hari</p>
              <p class="text-sm text-slate-500">Feed, telur, kg telur, dan laba kotor.</p>
            </div>
            <div class="flex gap-2">
              <RouterLink class="btn-secondary !py-2.5" to="/history">Lihat history</RouterLink>
              <RouterLink class="btn-secondary !py-2.5" to="/egg-report">Laporan telur</RouterLink>
            </div>
          </div>

          <div v-if="trend.length" class="mt-5 space-y-4">
            <div v-for="point in trend" :key="point.date" class="rounded-3xl bg-slate-50 p-4">
              <div class="flex items-center justify-between text-sm">
                <span class="font-semibold text-slate-700">{{ point.label }}</span>
                <span class="text-slate-500">{{ formatDate(point.date) }}</span>
              </div>
              <div class="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <p class="text-xs text-slate-500">Feed</p>
                  <p class="font-semibold text-ink">{{ formatDecimal(point.feed_used_kg) }} kg</p>
                </div>
                <div>
                  <p class="text-xs text-slate-500">Telur</p>
                  <p class="font-semibold text-ink">{{ formatNumber(point.egg_count) }} butir</p>
                </div>
                <div>
                  <p class="text-xs text-slate-500">Kg telur</p>
                  <p class="font-semibold text-ink">{{ formatDecimal(point.egg_weight_kg) }} kg</p>
                </div>
                <div>
                  <p class="text-xs text-slate-500">Laba</p>
                  <p class="font-semibold text-ink">{{ formatCurrency(point.profit_rp) }}</p>
                </div>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            title="Belum ada trend"
            description="Tambahkan log harian untuk menampilkan tren peternakan."
          />
        </article>

        <article class="surface-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-ink">Aksi cepat</p>
              <p class="text-sm text-slate-500">Masuk ke setup, pakan, dan laporan lebih cepat.</p>
            </div>
          </div>

          <div class="mt-5 grid gap-3">
            <RouterLink class="btn-primary" to="/farms">Kelola peternakan & kandang</RouterLink>
            <RouterLink class="btn-secondary" to="/feed">Management pakan</RouterLink>
            <RouterLink class="btn-secondary" to="/alerts">Anomaly alerts</RouterLink>
            <RouterLink class="btn-secondary" :to="selectedFarmId ? `/transfers?farmId=${selectedFarmId}` : '/transfers'">Mutasi kandang</RouterLink>
            <RouterLink class="btn-secondary" :to="selectedFarmId ? `/treatments?farmId=${selectedFarmId}` : '/treatments'">Health & treatment</RouterLink>
            <RouterLink class="btn-secondary" to="/egg-report">Laporan telur harian</RouterLink>
            <RouterLink
              v-if="activeFlocks[0]"
              class="btn-secondary"
              :to="`/input?farmId=${activeFlocks[0].farm_id}&flockId=${activeFlocks[0].id}`"
            >
               Isi log kandang pertama
            </RouterLink>
            <RouterLink class="btn-secondary" to="/profile">Lihat profil & status sync</RouterLink>
          </div>

          <div class="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
            <p class="font-semibold text-ink">Status peternakan terpilih</p>
            <p class="mt-2">Populasi aktif: {{ formatNumber(summary.currentPopulation) }} ekor</p>
            <p>Ayam mati hari ini: {{ formatNumber(summary.totalMortality) }} ekor</p>
            <p>Feed hari ini: {{ formatDecimal(summary.totalFeedUsedKg) }} kg</p>
          </div>

          <div
            class="mt-4 rounded-3xl p-4 text-sm"
            :class="dashboardAlerts.length ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'"
          >
            <p class="font-semibold">{{ dashboardAlerts.length ? 'Perlu perhatian' : 'Semua indikator aman' }}</p>
            <div v-if="dashboardAlerts.length" class="mt-2 space-y-2">
              <p v-for="alert in dashboardAlerts" :key="alert">{{ alert }}</p>
            </div>
            <p v-else class="mt-2">HD, FCR, dan stok pakan masih dalam batas target peternakan.</p>
          </div>
        </article>
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-semibold text-ink">Anomaly alerts</p>
            <p class="text-sm text-slate-500">Deteksi dini stok kritis, ayam mati tinggi, dan issue performa.</p>
          </div>
          <RouterLink class="btn-secondary !py-2.5" to="/alerts">Lihat semua</RouterLink>
        </div>

        <div v-if="anomalyAlerts.length" class="grid gap-4 lg:grid-cols-2">
          <article v-for="alert in anomalyAlerts.slice(0, 4)" :key="alert.id" class="surface-card">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-ink">{{ alert.title }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ alert.description }}</p>
              </div>
              <span
                class="status-pill"
                :class="
                  alert.severity === 'critical'
                    ? 'bg-rose-100 text-rose-700'
                    : alert.severity === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-sky-100 text-sky-700'
                "
              >
                {{ alert.severity }}
              </span>
            </div>
            <div class="mt-4 flex items-center justify-between gap-3">
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {{ alert.category }}
              </span>
              <RouterLink v-if="alert.action_to" class="btn-secondary !py-2.5" :to="alert.action_to">
                {{ alert.action_label || 'Tindak lanjuti' }}
              </RouterLink>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          title="Belum ada anomaly alert"
          description="Saat ini tidak ada sinyal anomali besar pada peternakan terpilih."
        />
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-semibold text-ink">Kandang aktif</p>
            <p class="text-sm text-slate-500">Pilih kandang untuk melihat KPI, target, dan history log.</p>
          </div>
          <RouterLink class="btn-secondary !py-2.5" to="/farms">Buka setup</RouterLink>
        </div>

        <div v-if="activeFlocks.length" class="grid gap-4 lg:grid-cols-2">
          <article
            v-for="flock in activeFlocks"
            :key="flock.id"
            class="surface-card"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="status-pill bg-emerald-100 text-emerald-700">
                  {{ getFlockTypeLabel(flock.flock_type) }}
                </p>
                <h3 class="mt-3 text-xl font-bold text-ink">{{ flock.name }}</h3>
                <p class="mt-1 text-sm text-slate-500">
                  {{ flock.code }} • {{ flock.house_name }} • last log {{ formatDate(flock.last_log_date) }}
                </p>
              </div>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {{ formatNumber(flock.current_chicken_count) }} ekor
              </span>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Strain</p>
                <p class="mt-1 font-semibold text-ink">{{ flock.strain || '-' }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Start</p>
                <p class="mt-1 font-semibold text-ink">{{ formatDate(flock.start_date) }}</p>
              </div>
              <div
                v-if="flock.flock_type === 'layer'"
                class="rounded-2xl bg-slate-50 p-3"
              >
                <p class="text-xs text-slate-500">Target HD / Batas FCR</p>
                <p class="mt-1 font-semibold text-ink">
                  {{ formatDecimal(flock.target_hd_percent) }}% / {{ formatDecimal(flock.max_fcr, { maximumFractionDigits: 3 }) }}
                </p>
              </div>
              <div
                v-if="flock.flock_type === 'layer'"
                class="rounded-2xl bg-slate-50 p-3"
              >
                <p class="text-xs text-slate-500">Harga telur / Safety stock</p>
                <p class="mt-1 font-semibold text-ink">
                  {{ formatCurrency(flock.egg_price_per_kg_rp) }} / {{ formatNumber(flock.safety_stock_days) }} hari
                </p>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap gap-3">
              <RouterLink class="btn-primary flex-1" :to="`/flocks/${flock.id}`">
                Detail kandang
              </RouterLink>
              <RouterLink class="btn-secondary flex-1" :to="`/input?farmId=${flock.farm_id}&flockId=${flock.id}`">
                Isi log
              </RouterLink>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          title="Belum ada kandang aktif"
          description="Tambahkan kandang baru dari halaman peternakan untuk mulai mencatat log harian."
        />
      </section>
    </template>
  </AppLayout>
</template>
