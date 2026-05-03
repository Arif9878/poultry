<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import { dataVersion } from '../lib/appState'
import { listAccessibleFarms } from '../services/farms.service'
import { listFlocksByFarm } from '../services/flocks.service'
import {
  createHealthTreatment,
  listHealthTreatmentsByFarm,
} from '../services/healthTreatments.service'
import type { Farm, Flock, HealthTreatmentLog } from '../types/models'
import { downloadCsv } from '../utils/exportCsv'

const route = useRoute()
const farms = ref<Farm[]>([])
const flocks = ref<Flock[]>([])
const selectedFarmId = ref('')
const selectedFlockId = ref('')
const treatments = ref<HealthTreatmentLog[]>([])
const loading = ref(false)
const error = ref('')

const form = reactive({
  treatmentDate: new Date().toISOString().slice(0, 10),
  category: 'vaccine' as HealthTreatmentLog['category'],
  productName: '',
  dosage: '',
  administeredBy: '',
  symptoms: '',
  diagnosis: '',
  withdrawalUntil: '',
  notes: '',
})

const filteredTreatments = computed(() =>
  selectedFlockId.value
    ? treatments.value.filter((item) => item.flock_id === selectedFlockId.value)
    : treatments.value,
)

function categoryLabel(category: HealthTreatmentLog['category']) {
  switch (category) {
    case 'vaccine':
      return 'Vaksin'
    case 'vitamin':
      return 'Vitamin'
    case 'medication':
      return 'Obat'
    case 'checkup':
      return 'Checkup'
    default:
      return 'Lainnya'
  }
}

function exportTreatments() {
  downloadCsv(
    'health-treatment-log.csv',
    ['Tanggal', 'Kategori', 'Kandang', 'Produk', 'Dosis', 'Petugas', 'Diagnosis', 'Withdrawal', 'Catatan'],
    filteredTreatments.value.map((item) => [
      item.treatment_date,
      categoryLabel(item.category),
      item.flock?.name ?? '-',
      item.product_name,
      item.dosage ?? '',
      item.administered_by ?? '',
      item.diagnosis ?? '',
      item.withdrawal_until ?? '',
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
    const routeFlockId = String(route.query.flockId ?? '')

    if (routeFarmId && farms.value.some((farm) => farm.id === routeFarmId)) {
      selectedFarmId.value = routeFarmId
    } else if (!selectedFarmId.value && farms.value[0]) {
      selectedFarmId.value = farms.value[0].id
    }

    if (!selectedFarmId.value) {
      flocks.value = []
      treatments.value = []
      return
    }

    const [nextFlocks, nextTreatments] = await Promise.all([
      listFlocksByFarm(selectedFarmId.value, 'all'),
      listHealthTreatmentsByFarm(selectedFarmId.value),
    ])

    flocks.value = nextFlocks
    treatments.value = nextTreatments

    if (routeFlockId && nextFlocks.some((flock) => flock.id === routeFlockId)) {
      selectedFlockId.value = routeFlockId
    } else if (selectedFlockId.value && !nextFlocks.some((flock) => flock.id === selectedFlockId.value)) {
      selectedFlockId.value = ''
    }
  } catch (nextError) {
    console.error(nextError)
    error.value = nextError instanceof Error ? nextError.message : 'Gagal memuat health & treatment log'
  } finally {
    loading.value = false
  }
}

async function submitTreatment() {
  if (!selectedFlockId.value || !form.productName.trim()) {
    error.value = 'Pilih kandang dan isi nama produk terlebih dahulu'
    return
  }

  try {
    error.value = ''
    await createHealthTreatment({
      flockId: selectedFlockId.value,
      treatmentDate: form.treatmentDate,
      category: form.category,
      productName: form.productName,
      dosage: form.dosage,
      administeredBy: form.administeredBy,
      symptoms: form.symptoms,
      diagnosis: form.diagnosis,
      withdrawalUntil: form.withdrawalUntil,
      notes: form.notes,
    })

    form.productName = ''
    form.dosage = ''
    form.administeredBy = ''
    form.symptoms = ''
    form.diagnosis = ''
    form.withdrawalUntil = ''
    form.notes = ''
    await loadPage()
  } catch (nextError) {
    console.error(nextError)
    error.value = nextError instanceof Error ? nextError.message : 'Gagal menyimpan treatment log'
  }
}

onMounted(() => {
  void loadPage()
})

watch([selectedFarmId, dataVersion], () => {
  void loadPage()
})
</script>

<template>
  <AppLayout
    title="Health & treatment log"
    subtitle="Catat vaksin, obat, vitamin, checkup, dan withdrawal per kandang."
  >
    <section class="surface-card">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="app-label">Peternakan</label>
          <select v-model="selectedFarmId" class="app-input">
            <option v-for="farm in farms" :key="farm.id" :value="farm.id">{{ farm.name }}</option>
          </select>
        </div>
        <div>
          <label class="app-label">Kandang</label>
          <select v-model="selectedFlockId" class="app-input">
            <option value="">Semua kandang</option>
            <option v-for="flock in flocks" :key="flock.id" :value="flock.id">
              {{ flock.code }} • {{ flock.name }}
            </option>
          </select>
        </div>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section class="surface-card">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-lg font-semibold text-ink">Tambah treatment log</p>
          <p class="text-sm text-slate-500">Gunakan satu catatan per produk / tindakan agar riwayat kesehatan rapi.</p>
        </div>
        <button class="btn-secondary" type="button" @click="exportTreatments">Export CSV</button>
      </div>

      <form class="mt-5 grid gap-4" @submit.prevent="submitTreatment">
        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <label class="app-label">Tanggal</label>
            <input v-model="form.treatmentDate" class="app-input" type="date" />
          </div>
          <div>
            <label class="app-label">Kategori</label>
            <select v-model="form.category" class="app-input">
              <option value="vaccine">Vaksin</option>
              <option value="vitamin">Vitamin</option>
              <option value="medication">Obat</option>
              <option value="checkup">Checkup</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
          <div>
            <label class="app-label">Kandang</label>
            <select v-model="selectedFlockId" class="app-input">
              <option value="" disabled>Pilih kandang</option>
              <option v-for="flock in flocks" :key="flock.id" :value="flock.id">
                {{ flock.code }} • {{ flock.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="app-label">Produk / tindakan</label>
            <input v-model="form.productName" class="app-input" placeholder="ND vaksin, antibiotik, vitamin C" />
          </div>
          <div>
            <label class="app-label">Dosis</label>
            <input v-model="form.dosage" class="app-input" placeholder="1 ml / ekor atau 2 gr / liter" />
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <label class="app-label">Petugas</label>
            <input v-model="form.administeredBy" class="app-input" placeholder="Nama PIC" />
          </div>
          <div>
            <label class="app-label">Diagnosis</label>
            <input v-model="form.diagnosis" class="app-input" placeholder="CRD / diare / stress" />
          </div>
          <div>
            <label class="app-label">Withdrawal sampai</label>
            <input v-model="form.withdrawalUntil" class="app-input" type="date" />
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="app-label">Gejala</label>
            <textarea v-model="form.symptoms" class="app-textarea" rows="3" placeholder="Nafsu makan turun, ngorok, lemas" />
          </div>
          <div>
            <label class="app-label">Catatan</label>
            <textarea v-model="form.notes" class="app-textarea" rows="3" placeholder="Catatan tambahan treatment" />
          </div>
        </div>

        <button class="btn-primary" type="submit">Simpan treatment log</button>
      </form>
    </section>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat treatment log...
    </section>

    <section v-else-if="filteredTreatments.length" class="space-y-4">
      <article v-for="item in filteredTreatments" :key="item.id" class="surface-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-ink">{{ item.product_name }}</p>
            <p class="mt-1 text-sm text-slate-500">
              {{ item.treatment_date }} • {{ item.flock?.code }} • {{ item.flock?.name }}
            </p>
          </div>
          <span class="status-pill bg-emerald-100 text-emerald-700">{{ categoryLabel(item.category) }}</span>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Dosis</p>
            <p class="font-semibold text-ink">{{ item.dosage || '-' }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Diagnosis</p>
            <p class="font-semibold text-ink">{{ item.diagnosis || '-' }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Withdrawal</p>
            <p class="font-semibold text-ink">{{ item.withdrawal_until || '-' }}</p>
          </div>
        </div>

        <p class="mt-4 text-sm text-slate-600">
          {{ item.notes || item.symptoms || 'Tanpa catatan tambahan.' }}
        </p>
      </article>
    </section>

    <EmptyState
      v-else
      title="Belum ada treatment log"
      description="Catat vaksin, obat, atau vitamin untuk mulai membangun riwayat kesehatan kandang."
    />
  </AppLayout>
</template>
