<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import MetricCard from '../components/MetricCard.vue'
import { useFlocks } from '../composables/useFlocks'
import { dataVersion } from '../lib/appState'
import { formatDate } from '../utils/formatDate'
import { formatDecimal, formatNumber } from '../utils/formatNumber'
import { getFlockAgeInDays, getFlockTypeLabel } from '../utils/flock'

const route = useRoute()
const flockId = computed(() => String(route.params.flockId))

const { flock, recentLogs, trend, kpis, loading, error, loadFlockDetail } = useFlocks()

async function loadPage() {
  await loadFlockDetail(flockId.value)
}

onMounted(() => {
  void loadPage()
})

watch(dataVersion, () => {
  void loadPage()
})
</script>

<template>
  <AppLayout
    :title="flock?.name ?? 'Detail flock'"
    :subtitle="flock ? `${getFlockTypeLabel(flock.flock_type)} • ${flock.house_name} • umur ${getFlockAgeInDays(flock.start_date)} hari` : 'Memuat data flock...'"
  >
    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat detail flock...
    </section>

    <template v-else-if="flock">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Mortality rate"
          :value="`${formatDecimal(kpis.mortalityRate, { maximumFractionDigits: 2 })}%`"
          helper="Akumulasi vs populasi awal"
        />
        <MetricCard
          label="Feed per bird"
          :value="`${formatDecimal(kpis.feedPerBird, { maximumFractionDigits: 3 })} kg`"
          helper="Rata-rata 30 hari"
        />
        <MetricCard
          label="Hen-day / Weight"
          :value="flock.flock_type === 'layer' ? `${formatDecimal(kpis.henDayProduction)}%` : `${formatDecimal(kpis.averageSampleWeight)} g`"
          :helper="flock.flock_type === 'layer' ? 'Produksi telur dibanding populasi hidup' : 'Rata-rata bobot sampel'"
        />
        <MetricCard
          label="Populasi hidup"
          :value="formatNumber(flock.current_chicken_count)"
          helper="Update dari log terakhir"
        />
      </section>

      <section class="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article class="surface-card">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-lg font-semibold text-ink">Trend 7 hari</p>
              <p class="text-sm text-slate-500">Feed, mortalitas, dan metrik spesifik flock.</p>
            </div>
            <RouterLink class="btn-primary !py-2.5" :to="`/flocks/${flock.id}/logs/new`">
              Isi log hari ini
            </RouterLink>
          </div>

          <div v-if="trend.length" class="mt-5 space-y-3">
            <div v-for="item in trend" :key="item.id" class="rounded-3xl bg-slate-50 p-4">
              <div class="flex items-center justify-between">
                <p class="font-semibold text-ink">{{ formatDate(item.log_date) }}</p>
                <span
                  class="status-pill"
                  :class="item.sync_status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'"
                >
                  {{ item.sync_status }}
                </span>
              </div>
              <div class="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p class="text-xs text-slate-500">Feed</p>
                  <p class="font-semibold text-ink">{{ formatDecimal(item.feed_used_kg) }} kg</p>
                </div>
                <div>
                  <p class="text-xs text-slate-500">Mortalitas</p>
                  <p class="font-semibold text-ink">{{ formatNumber(item.mortality_count) }}</p>
                </div>
                <div>
                  <p class="text-xs text-slate-500">
                    {{ flock.flock_type === 'layer' ? 'Telur' : 'Bobot' }}
                  </p>
                  <p class="font-semibold text-ink">
                    {{
                      flock.flock_type === 'layer'
                        ? `${formatNumber(item.egg_count)} butir`
                        : `${formatDecimal(item.avg_weight_gram)} g`
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            title="Belum ada trend"
            description="Isi log pertama untuk melihat pergerakan harian flock."
          />
        </article>

        <article class="surface-card">
          <p class="text-lg font-semibold text-ink">Informasi flock</p>
          <div class="mt-5 grid gap-3">
            <div class="rounded-3xl bg-slate-50 p-4">
              <p class="text-xs text-slate-500">House & vendor</p>
              <p class="mt-1 font-semibold text-ink">
                {{ flock.house_name || '-' }} • {{ flock.source_vendor || '-' }}
              </p>
            </div>
            <div class="rounded-3xl bg-slate-50 p-4">
              <p class="text-xs text-slate-500">Strain & start date</p>
              <p class="mt-1 font-semibold text-ink">
                {{ flock.strain || '-' }} • {{ formatDate(flock.start_date) }}
              </p>
            </div>
            <div class="rounded-3xl bg-slate-50 p-4">
              <p class="text-xs text-slate-500">Catatan</p>
              <p class="mt-1 text-sm text-slate-700">{{ flock.notes || 'Tidak ada catatan.' }}</p>
            </div>
          </div>
        </article>
      </section>

      <section class="space-y-4">
        <div>
          <p class="text-lg font-semibold text-ink">Riwayat terbaru</p>
          <p class="text-sm text-slate-500">Log terakhir membantu cek kualitas data dan status sync.</p>
        </div>

        <div v-if="recentLogs.length" class="space-y-3">
          <article
            v-for="log in recentLogs"
            :key="log.id"
            class="surface-card"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-ink">{{ formatDate(log.log_date) }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ log.notes || 'Tanpa catatan.' }}</p>
              </div>
              <span
                class="status-pill"
                :class="log.sync_status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'"
              >
                {{ log.sync_status }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-4">
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Feed</p>
                <p class="font-semibold text-ink">{{ formatDecimal(log.feed_used_kg) }} kg</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Mortalitas</p>
                <p class="font-semibold text-ink">{{ formatNumber(log.mortality_count) }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Populasi</p>
                <p class="font-semibold text-ink">{{ formatNumber(log.live_population) }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">
                  {{ flock.flock_type === 'layer' ? 'Telur' : 'Bobot' }}
                </p>
                <p class="font-semibold text-ink">
                  {{
                    flock.flock_type === 'layer'
                      ? `${formatNumber(log.egg_count)} butir`
                      : `${formatDecimal(log.avg_weight_gram)} g`
                  }}
                </p>
              </div>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          title="Belum ada riwayat"
          description="Isi log harian agar data performa flock mulai tercatat."
        />
      </section>
    </template>
  </AppLayout>
</template>
