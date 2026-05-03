<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import { dataVersion } from '../lib/appState'
import { listAccessibleFarms } from '../services/farms.service'
import { listAnomalyAlertsByFarm } from '../services/anomalies.service'
import type { AnomalyAlert, Farm } from '../types/models'

const route = useRoute()

const farms = ref<Farm[]>([])
const selectedFarmId = ref('')
const alerts = ref<AnomalyAlert[]>([])
const loading = ref(false)
const error = ref('')

function severityClass(severity: AnomalyAlert['severity']) {
  switch (severity) {
    case 'critical':
      return 'bg-rose-100 text-rose-700'
    case 'warning':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-sky-100 text-sky-700'
  }
}

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
      alerts.value = []
      return
    }

    alerts.value = await listAnomalyAlertsByFarm(selectedFarmId.value)
  } catch (nextError) {
    console.error(nextError)
    error.value = nextError instanceof Error ? nextError.message : 'Gagal memuat anomaly alerts'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadPage()
})

watch([selectedFarmId, dataVersion], () => {
  if (selectedFarmId.value) {
    void loadPage()
  }
})
</script>

<template>
  <AppLayout
    title="Anomaly alerts"
    subtitle="Pantau anomali operasional, stok pakan, ayam mati, dan treatment aktif."
  >
    <section class="surface-card">
      <div class="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <label class="app-label">Peternakan</label>
          <select v-model="selectedFarmId" class="app-input">
            <option v-for="farm in farms" :key="farm.id" :value="farm.id">{{ farm.name }}</option>
          </select>
        </div>
        <div class="flex items-end">
          <RouterLink class="btn-secondary" :to="selectedFarmId ? `/feed?farmId=${selectedFarmId}` : '/feed'">
            Buka pakan
          </RouterLink>
        </div>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat alerts...
    </section>

    <section v-else-if="alerts.length" class="space-y-4">
      <article v-for="alert in alerts" :key="alert.id" class="surface-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-ink">{{ alert.title }}</p>
            <p class="mt-1 text-sm text-slate-500">{{ alert.description }}</p>
          </div>
          <span class="status-pill" :class="severityClass(alert.severity)">
            {{ alert.severity }}
          </span>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {{ alert.category }}
          </span>
          <RouterLink
            v-if="alert.action_to"
            class="btn-secondary !py-2.5"
            :to="alert.action_to"
          >
            {{ alert.action_label || 'Buka detail' }}
          </RouterLink>
        </div>
      </article>
    </section>

    <EmptyState
      v-else
      title="Belum ada anomali"
      description="Semua indikator utama masih dalam batas aman untuk peternakan terpilih."
    />
  </AppLayout>
</template>
