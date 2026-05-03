<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import { dataVersion } from '../lib/appState'
import { listAccessibleFarms } from '../services/farms.service'
import { listFlocksByFarm } from '../services/flocks.service'
import { createFlockTransfer, listFlockTransfersByFarm } from '../services/flockTransfers.service'
import type { Farm, Flock, FlockTransfer } from '../types/models'
import { downloadCsv } from '../utils/exportCsv'
import { formatNumber } from '../utils/formatNumber'

const route = useRoute()
const farms = ref<Farm[]>([])
const flocks = ref<Flock[]>([])
const transfers = ref<FlockTransfer[]>([])
const selectedFarmId = ref('')
const loading = ref(false)
const error = ref('')

const form = reactive({
  fromFlockId: '',
  toFlockId: '',
  transferDate: new Date().toISOString().slice(0, 10),
  chickenCount: 0,
  notes: '',
})

const sourceFlock = computed(() => flocks.value.find((item) => item.id === form.fromFlockId) ?? null)
const destinationOptions = computed(() => {
  const currentSourceFlock = sourceFlock.value
  if (!currentSourceFlock) {
    return flocks.value
  }

  return flocks.value.filter(
    (item) => item.id !== currentSourceFlock.id && item.flock_type === currentSourceFlock.flock_type,
  )
})

function exportTransfers() {
  downloadCsv(
    'mutasi-antar-kandang.csv',
    ['Tanggal', 'Asal', 'Tujuan', 'Jumlah ayam', 'Catatan'],
    transfers.value.map((item) => [
      item.transfer_date,
      `${item.from_flock?.code ?? '-'} ${item.from_flock?.name ?? ''}`.trim(),
      `${item.to_flock?.code ?? '-'} ${item.to_flock?.name ?? ''}`.trim(),
      item.chicken_count,
      item.notes ?? '',
    ]),
  )
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
      flocks.value = []
      transfers.value = []
      return
    }

    const [nextFlocks, nextTransfers] = await Promise.all([
      listFlocksByFarm(selectedFarmId.value, 'active'),
      listFlockTransfersByFarm(selectedFarmId.value),
    ])

    flocks.value = nextFlocks
    transfers.value = nextTransfers

    if (form.fromFlockId && !nextFlocks.some((flock) => flock.id === form.fromFlockId)) {
      form.fromFlockId = ''
      form.toFlockId = ''
    }
  } catch (nextError) {
    console.error(nextError)
    error.value = nextError instanceof Error ? nextError.message : 'Gagal memuat mutasi antar kandang'
  } finally {
    loading.value = false
  }
}

async function submitTransfer() {
  if (!selectedFarmId.value || !form.fromFlockId || !form.toFlockId || form.chickenCount <= 0) {
    error.value = 'Lengkapi kandang asal, tujuan, dan jumlah ayam terlebih dahulu'
    return
  }

  try {
    error.value = ''
    await createFlockTransfer({
      farmId: selectedFarmId.value,
      fromFlockId: form.fromFlockId,
      toFlockId: form.toFlockId,
      transferDate: form.transferDate,
      chickenCount: form.chickenCount,
      notes: form.notes,
    })

    form.toFlockId = ''
    form.chickenCount = 0
    form.notes = ''
    await loadPage()
  } catch (nextError) {
    console.error(nextError)
    error.value = nextError instanceof Error ? nextError.message : 'Gagal menyimpan mutasi kandang'
  }
}

onMounted(() => {
  void loadPage()
})

watch([selectedFarmId, dataVersion], () => {
  void loadPage()
})

watch(
  () => form.fromFlockId,
  () => {
    if (!destinationOptions.value.some((item) => item.id === form.toFlockId)) {
      form.toFlockId = ''
    }
  },
)
</script>

<template>
  <AppLayout
    title="Mutasi antar kandang"
    subtitle="Pindahkan populasi antar kandang aktif dalam peternakan yang sama."
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
          <button class="btn-secondary" type="button" @click="exportTransfers">Export CSV</button>
        </div>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section class="surface-card">
      <div>
        <p class="text-lg font-semibold text-ink">Form mutasi</p>
        <p class="text-sm text-slate-500">Gunakan untuk split, regrouping, atau pemindahan populasi antar kandang.</p>
      </div>

      <form class="mt-5 grid gap-4" @submit.prevent="submitTransfer">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="app-label">Kandang asal</label>
            <select v-model="form.fromFlockId" class="app-input">
              <option value="" disabled>Pilih kandang asal</option>
              <option v-for="flock in flocks" :key="flock.id" :value="flock.id">
                {{ flock.code }} • {{ flock.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="app-label">Kandang tujuan</label>
            <select v-model="form.toFlockId" class="app-input" :disabled="!form.fromFlockId">
              <option value="" disabled>Pilih kandang tujuan</option>
              <option v-for="flock in destinationOptions" :key="flock.id" :value="flock.id">
                {{ flock.code }} • {{ flock.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="app-label">Tanggal mutasi</label>
            <input v-model="form.transferDate" class="app-input" type="date" />
          </div>
          <div>
            <label class="app-label">Jumlah ayam</label>
            <input v-model.number="form.chickenCount" class="app-input" min="1" type="number" />
          </div>
        </div>

        <div v-if="sourceFlock" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Populasi kandang asal saat ini:
          <span class="font-semibold text-ink">{{ formatNumber(sourceFlock.current_chicken_count) }} ekor</span>
        </div>

        <div>
          <label class="app-label">Catatan</label>
          <textarea v-model="form.notes" class="app-textarea" rows="3" placeholder="Alasan mutasi, regrouping, atau afkir parsial" />
        </div>

        <button class="btn-primary" type="submit">Simpan mutasi</button>
      </form>
    </section>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat mutasi kandang...
    </section>

    <section v-else-if="transfers.length" class="space-y-4">
      <article v-for="item in transfers" :key="item.id" class="surface-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-ink">
              {{ item.from_flock?.name ?? '-' }} → {{ item.to_flock?.name ?? '-' }}
            </p>
            <p class="mt-1 text-sm text-slate-500">
              {{ item.transfer_date }} • {{ formatNumber(item.chicken_count) }} ekor
            </p>
          </div>
          <span class="status-pill bg-emerald-100 text-emerald-700">transfer</span>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Asal</p>
            <p class="font-semibold text-ink">
              {{ item.from_flock?.code ?? '-' }} • {{ item.from_flock?.house_name ?? '-' }}
            </p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Tujuan</p>
            <p class="font-semibold text-ink">
              {{ item.to_flock?.code ?? '-' }} • {{ item.to_flock?.house_name ?? '-' }}
            </p>
          </div>
        </div>

        <p class="mt-4 text-sm text-slate-600">{{ item.notes || 'Tanpa catatan.' }}</p>
      </article>
    </section>

    <EmptyState
      v-else
      title="Belum ada mutasi"
      description="Catat mutasi antar kandang saat ada split, regrouping, atau pemindahan populasi."
    />
  </AppLayout>
</template>
