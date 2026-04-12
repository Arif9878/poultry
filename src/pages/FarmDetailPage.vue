<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import { useAuth } from '../composables/useAuth'
import { useFarms } from '../composables/useFarms'
import { useFlocks } from '../composables/useFlocks'
import { dataVersion } from '../lib/appState'
import { formatDate } from '../utils/formatDate'
import { formatCurrency, formatDecimal, formatNumber } from '../utils/formatNumber'
import { getFlockTypeLabel } from '../utils/flock'

const route = useRoute()
const farmId = computed(() => String(route.params.farmId))

const { profile } = useAuth()
const { farm, houses, flocks, loading, error, loadFarmDetail, addHouse } = useFarms()
const { addFlock } = useFlocks()

const houseForm = reactive({
  name: '',
  capacity: 5000,
})

const submitError = reactive({
  house: '',
  flock: '',
})

const flockForm = reactive({
  houseId: '',
  code: '',
  name: '',
  flockType: 'layer' as const,
  startDate: new Date().toISOString().slice(0, 10),
  initialChickenCount: 5000,
  strain: '',
  sourceVendor: '',
  eggPricePerKgRp: 26000,
  eggWeightPerEggKg: 0.06,
  targetHdPercent: 85,
  maxFcr: 2.3,
  safetyStockDays: 7,
  notes: '',
})

async function loadPage() {
  await loadFarmDetail(farmId.value)
  if (!flockForm.houseId && houses.value[0]) {
    flockForm.houseId = houses.value[0].id
  }
}

async function submitHouse() {
  if (!houseForm.name.trim()) {
    return
  }

  try {
    submitError.house = ''
    await addHouse({
      farmId: farmId.value,
      name: houseForm.name,
      capacity: houseForm.capacity,
    })

    houseForm.name = ''
  } catch (nextError) {
    console.error(nextError)
    submitError.house =
      nextError instanceof Error ? nextError.message : 'Gagal menambahkan kandang'
  }
}

function validateFlockForm() {
  if (!flockForm.houseId || !flockForm.name.trim() || !flockForm.code.trim()) {
    return 'Kandang, kode, dan nama flock wajib diisi'
  }

  if (flockForm.initialChickenCount <= 0) {
    return 'Populasi awal harus lebih dari 0'
  }

  if (flockForm.flockType === 'layer') {
    if (flockForm.eggPricePerKgRp < 0) {
      return 'Harga telur / kg tidak boleh negatif'
    }

    if (flockForm.eggWeightPerEggKg <= 0) {
      return 'Berat telur per butir harus lebih dari 0'
    }

    if (flockForm.targetHdPercent < 0 || flockForm.targetHdPercent > 100) {
      return 'Target HD% harus di antara 0 sampai 100'
    }

    if (flockForm.maxFcr <= 0) {
      return 'Batas FCR harus lebih dari 0'
    }

    if (flockForm.safetyStockDays < 0) {
      return 'Safety stock tidak boleh negatif'
    }
  }

  return ''
}

async function submitFlock() {
  const validationError = validateFlockForm()
  if (validationError) {
    submitError.flock = validationError
    return
  }

  try {
    submitError.flock = ''
    await addFlock({
      farmId: farmId.value,
      houseId: flockForm.houseId,
      code: flockForm.code,
      name: flockForm.name,
      flockType: flockForm.flockType,
      startDate: flockForm.startDate,
      initialChickenCount: flockForm.initialChickenCount,
      strain: flockForm.strain,
      sourceVendor: flockForm.sourceVendor,
      eggPricePerKgRp: flockForm.flockType === 'layer' ? flockForm.eggPricePerKgRp : 0,
      eggWeightPerEggKg: flockForm.flockType === 'layer' ? flockForm.eggWeightPerEggKg : 0.06,
      targetHdPercent: flockForm.flockType === 'layer' ? flockForm.targetHdPercent : 0,
      maxFcr: flockForm.flockType === 'layer' ? flockForm.maxFcr : 1,
      safetyStockDays: flockForm.flockType === 'layer' ? flockForm.safetyStockDays : 0,
      notes: flockForm.notes,
    })

    flockForm.code = ''
    flockForm.name = ''
    flockForm.strain = ''
    flockForm.sourceVendor = ''
    flockForm.notes = ''
    await loadPage()
  } catch (nextError) {
    console.error(nextError)
    submitError.flock =
      nextError instanceof Error ? nextError.message : 'Gagal menambahkan flock'
  }
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
    :title="farm?.name ?? 'Detail farm'"
    :subtitle="farm?.location ?? 'Kelola kandang dan flock dari farm ini.'"
  >
    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section v-if="loading" class="surface-card text-sm text-slate-500">
      Memuat detail farm...
    </section>

    <template v-else-if="farm">
      <section class="grid gap-5 lg:grid-cols-2">
        <article class="surface-card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-lg font-semibold text-ink">Kandang</p>
              <p class="text-sm text-slate-500">Tambah house baru untuk kapasitas flock berikutnya.</p>
            </div>
            <span class="status-pill bg-emerald-100 text-emerald-700">
              {{ formatNumber(houses.length) }} house
            </span>
          </div>

          <div v-if="houses.length" class="mt-5 space-y-3">
            <div
              v-for="house in houses"
              :key="house.id"
              class="rounded-3xl bg-slate-50 p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="font-semibold text-ink">{{ house.name }}</p>
                  <p class="text-sm text-slate-500">Kapasitas {{ formatNumber(house.capacity) }} ekor</p>
                </div>
                <span class="text-xs text-slate-400">{{ formatDate(house.created_at) }}</span>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            title="Belum ada kandang"
            description="Tambahkan kandang terlebih dahulu sebelum membuat flock."
          />

          <form
            v-if="profile?.role !== 'operator'"
            class="mt-5 grid gap-4 sm:grid-cols-2"
            @submit.prevent="submitHouse"
          >
            <div>
              <label class="app-label">Nama kandang</label>
              <input v-model="houseForm.name" class="app-input" placeholder="House D1" />
            </div>
            <div>
              <label class="app-label">Kapasitas</label>
              <input v-model.number="houseForm.capacity" class="app-input" min="1" type="number" />
            </div>
            <div class="sm:col-span-2">
              <p v-if="submitError.house" class="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {{ submitError.house }}
              </p>
              <button class="btn-primary" type="submit">Tambah kandang</button>
            </div>
          </form>
        </article>

        <article
          v-if="profile?.role !== 'operator'"
          class="surface-card"
        >
          <div>
            <p class="text-lg font-semibold text-ink">Tambah flock</p>
            <p class="text-sm text-slate-500">Lengkapi setting flock agar KPI layer langsung siap dipantau.</p>
          </div>

          <form class="mt-5 grid gap-4" @submit.prevent="submitFlock">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Kandang</label>
                <select v-model="flockForm.houseId" class="app-input">
                  <option value="" disabled>Pilih kandang</option>
                  <option v-for="house in houses" :key="house.id" :value="house.id">
                    {{ house.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="app-label">Tipe flock</label>
                <select v-model="flockForm.flockType" class="app-input">
                  <option value="layer">Layer</option>
                  <option value="broiler">Broiler</option>
                </select>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Kode</label>
                <input v-model="flockForm.code" class="app-input" placeholder="LY-03" />
              </div>
              <div>
                <label class="app-label">Nama flock</label>
                <input v-model="flockForm.name" class="app-input" placeholder="Layer 30 minggu" />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Tanggal mulai</label>
                <input v-model="flockForm.startDate" class="app-input" type="date" />
              </div>
              <div>
                <label class="app-label">Populasi awal</label>
                <input
                  v-model.number="flockForm.initialChickenCount"
                  class="app-input"
                  min="1"
                  type="number"
                />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="app-label">Strain</label>
                <input v-model="flockForm.strain" class="app-input" placeholder="Isa Brown / Cobb" />
              </div>
              <div>
                <label class="app-label">Vendor DOC</label>
                <input v-model="flockForm.sourceVendor" class="app-input" placeholder="Nama vendor" />
              </div>
            </div>

            <template v-if="flockForm.flockType === 'layer'">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="app-label">Harga telur / kg (Rp)</label>
                  <input v-model.number="flockForm.eggPricePerKgRp" class="app-input" min="0" step="1" type="number" />
                </div>
                <div>
                  <label class="app-label">Berat telur per butir (kg)</label>
                  <input v-model.number="flockForm.eggWeightPerEggKg" class="app-input" min="0.001" step="0.001" type="number" />
                </div>
              </div>

              <div class="grid gap-4 sm:grid-cols-3">
                <div>
                  <label class="app-label">Target HD%</label>
                  <input v-model.number="flockForm.targetHdPercent" class="app-input" min="0" max="100" step="0.1" type="number" />
                </div>
                <div>
                  <label class="app-label">Batas FCR</label>
                  <input v-model.number="flockForm.maxFcr" class="app-input" min="0.1" step="0.001" type="number" />
                </div>
                <div>
                  <label class="app-label">Safety stock (hari)</label>
                  <input v-model.number="flockForm.safetyStockDays" class="app-input" min="0" step="1" type="number" />
                </div>
              </div>
            </template>

            <div>
              <label class="app-label">Catatan</label>
              <textarea
                v-model="flockForm.notes"
                class="app-textarea"
                placeholder="Catatan singkat setup flock"
                rows="3"
              />
            </div>

            <p v-if="submitError.flock" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {{ submitError.flock }}
            </p>
            <button class="btn-primary" type="submit">Tambah flock</button>
          </form>
        </article>
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-semibold text-ink">Flock di farm ini</p>
            <p class="text-sm text-slate-500">Lanjutkan ke detail flock atau langsung isi log.</p>
          </div>
          <div class="flex gap-2">
            <RouterLink class="btn-secondary !py-2.5" :to="`/feed?farmId=${farm.id}`">Pakan</RouterLink>
            <RouterLink class="btn-secondary !py-2.5" :to="`/egg-report?farmId=${farm.id}`">Telur</RouterLink>
          </div>
        </div>

        <div v-if="flocks.length" class="grid gap-4 lg:grid-cols-2">
          <article
            v-for="flock in flocks"
            :key="flock.id"
            class="surface-card"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="status-pill bg-emerald-100 text-emerald-700">
                  {{ getFlockTypeLabel(flock.flock_type) }}
                </span>
                <h3 class="mt-3 text-xl font-bold text-ink">{{ flock.name }}</h3>
                <p class="mt-1 text-sm text-slate-500">
                  {{ flock.code }} • {{ flock.house_name }} • {{ formatNumber(flock.current_chicken_count) }} ekor
                </p>
              </div>
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="flock.status === 'active' ? 'bg-emerald-50 text-moss' : 'bg-slate-100 text-slate-600'"
              >
                {{ flock.status }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Strain</p>
                <p class="font-semibold text-ink">{{ flock.strain || '-' }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Mulai</p>
                <p class="font-semibold text-ink">{{ formatDate(flock.start_date) }}</p>
              </div>
              <div
                v-if="flock.flock_type === 'layer'"
                class="rounded-2xl bg-slate-50 p-3"
              >
                <p class="text-xs text-slate-500">Harga telur / berat per butir</p>
                <p class="font-semibold text-ink">
                  {{ formatCurrency(flock.egg_price_per_kg_rp) }} / {{ formatDecimal(flock.egg_weight_per_egg_kg, { maximumFractionDigits: 3 }) }} kg
                </p>
              </div>
              <div
                v-if="flock.flock_type === 'layer'"
                class="rounded-2xl bg-slate-50 p-3"
              >
                <p class="text-xs text-slate-500">Target HD / FCR / Safety</p>
                <p class="font-semibold text-ink">
                  {{ formatDecimal(flock.target_hd_percent) }}% / {{ formatDecimal(flock.max_fcr, { maximumFractionDigits: 3 }) }} / {{ formatNumber(flock.safety_stock_days) }} hari
                </p>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap gap-3">
              <RouterLink class="btn-primary flex-1" :to="`/flocks/${flock.id}`">
                Detail flock
              </RouterLink>
              <RouterLink class="btn-secondary flex-1" :to="`/flocks/${flock.id}/logs/new`">
                Isi log
              </RouterLink>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          title="Belum ada flock"
          description="Tambahkan flock pertama untuk mulai mencatat feed dan performa harian."
        />
      </section>
    </template>
  </AppLayout>
</template>
