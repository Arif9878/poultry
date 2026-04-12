<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { useDailyLogForm } from '../composables/useDailyLogForm'
import { useFlocks } from '../composables/useFlocks'
import { onlineStatus, dataVersion } from '../lib/appState'
import { getSuggestedFeedPriceByFarm } from '../services/feed.service'
import { formatCurrency, formatDecimal } from '../utils/formatNumber'
import { getFlockTypeLabel } from '../utils/flock'

const route = useRoute()
const router = useRouter()
const flockId = computed(() => String(route.params.flockId))

const { flock, loadFlockDetail } = useFlocks()
const { form, errors, submitting, submitError, successMessage, initializeForFlock, submit } =
  useDailyLogForm()

async function loadPage() {
  await loadFlockDetail(flockId.value)
  if (flock.value) {
    initializeForFlock(flock.value)

    try {
      const suggestedFeedPrice = await getSuggestedFeedPriceByFarm(flock.value.farm_id)
      if (!form.value.feed_price_per_kg_rp && suggestedFeedPrice > 0) {
        form.value.feed_price_per_kg_rp = suggestedFeedPrice
      }
    } catch (error) {
      console.error(error)
    }
  }
}

async function handleSubmit() {
  if (!flock.value) {
    return
  }

  const success = await submit(flock.value)
  if (success) {
    setTimeout(() => {
      void router.replace(`/flocks/${flock.value?.id}`)
    }, 800)
  }
}

onMounted(() => {
  void loadPage()
})

watch(dataVersion, () => {
  if (!successMessage.value) {
    void loadPage()
  }
})
</script>

<template>
  <AppLayout
    :title="flock ? `Log harian ${flock.code}` : 'Log harian'"
    :subtitle="flock ? `${flock.name} • ${getFlockTypeLabel(flock.flock_type)}` : 'Isi data operasional hari ini.'"
  >
    <section v-if="!flock" class="surface-card text-sm text-slate-500">
      Memuat flock...
    </section>

    <template v-else>
      <section class="surface-card bg-gradient-to-r from-emerald-900 to-moss text-white">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {{ getFlockTypeLabel(flock.flock_type) }}
            </p>
            <h2 class="mt-2 text-2xl font-bold">{{ flock.name }}</h2>
            <p class="mt-1 text-sm text-emerald-50/90">
              Populasi saat ini {{ flock.current_chicken_count }} ekor • house {{ flock.house_name }}
            </p>
          </div>

          <span
            class="status-pill"
            :class="onlineStatus ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800'"
          >
            {{ onlineStatus ? 'Online: simpan langsung' : 'Offline: masuk queue sync' }}
          </span>
        </div>

        <div
          v-if="flock.flock_type === 'layer'"
          class="mt-4 grid gap-3 md:grid-cols-3"
        >
          <div class="rounded-2xl bg-white/10 p-3">
            <p class="text-xs text-emerald-100">Harga telur / kg</p>
            <p class="mt-1 font-semibold">{{ formatCurrency(flock.egg_price_per_kg_rp) }}</p>
          </div>
          <div class="rounded-2xl bg-white/10 p-3">
            <p class="text-xs text-emerald-100">Berat telur per butir</p>
            <p class="mt-1 font-semibold">{{ formatDecimal(flock.egg_weight_per_egg_kg, { maximumFractionDigits: 3 }) }} kg</p>
          </div>
          <div class="rounded-2xl bg-white/10 p-3">
            <p class="text-xs text-emerald-100">Target HD / Batas FCR</p>
            <p class="mt-1 font-semibold">
              {{ formatDecimal(flock.target_hd_percent) }}% / {{ formatDecimal(flock.max_fcr, { maximumFractionDigits: 3 }) }}
            </p>
          </div>
        </div>
      </section>

      <section class="surface-card">
        <form class="grid gap-4" @submit.prevent="handleSubmit">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="app-label">Tanggal</label>
              <input v-model="form.log_date" class="app-input" type="date" />
              <p v-if="errors.log_date" class="mt-1 text-sm text-rose-600">{{ errors.log_date }}</p>
            </div>
            <div>
              <label class="app-label">Populasi hidup</label>
              <input v-model.number="form.live_population" class="app-input" type="number" min="1" />
              <p v-if="errors.live_population" class="mt-1 text-sm text-rose-600">
                {{ errors.live_population }}
              </p>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="app-label">Pakan dipakai (kg)</label>
              <input v-model.number="form.feed_used_kg" class="app-input" type="number" min="0" step="0.1" />
              <p v-if="errors.feed_used_kg" class="mt-1 text-sm text-rose-600">
                {{ errors.feed_used_kg }}
              </p>
            </div>
            <div>
              <label class="app-label">Harga pakan / kg (Rp)</label>
              <input v-model.number="form.feed_price_per_kg_rp" class="app-input" type="number" min="0" step="1" />
              <p v-if="errors.feed_price_per_kg_rp" class="mt-1 text-sm text-rose-600">
                {{ errors.feed_price_per_kg_rp }}
              </p>
            </div>
            <div>
              <label class="app-label">Mortalitas (ekor)</label>
              <input v-model.number="form.mortality_count" class="app-input" type="number" min="0" />
              <p v-if="errors.mortality_count" class="mt-1 text-sm text-rose-600">
                {{ errors.mortality_count }}
              </p>
            </div>
          </div>

          <div v-if="flock.flock_type === 'layer'" class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="app-label">Produksi telur (butir)</label>
              <input v-model.number="form.egg_count" class="app-input" type="number" min="0" />
              <p v-if="errors.egg_count" class="mt-1 text-sm text-rose-600">{{ errors.egg_count }}</p>
            </div>
            <div>
              <label class="app-label">Harga telur / kg (Rp)</label>
              <input v-model.number="form.egg_price_per_kg_rp" class="app-input" type="number" min="0" step="1" />
              <p v-if="errors.egg_price_per_kg_rp" class="mt-1 text-sm text-rose-600">
                {{ errors.egg_price_per_kg_rp }}
              </p>
            </div>
            <div>
              <label class="app-label">Berat telur per butir (kg)</label>
              <input v-model.number="form.egg_weight_per_egg_kg" class="app-input" type="number" min="0.001" step="0.001" />
              <p v-if="errors.egg_weight_per_egg_kg" class="mt-1 text-sm text-rose-600">
                {{ errors.egg_weight_per_egg_kg }}
              </p>
            </div>
          </div>

          <div v-else class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="app-label">Bobot rata-rata sampel (gram)</label>
              <input v-model.number="form.avg_weight_gram" class="app-input" type="number" min="1" />
              <p v-if="errors.avg_weight_gram" class="mt-1 text-sm text-rose-600">
                {{ errors.avg_weight_gram }}
              </p>
            </div>
            <div>
              <label class="app-label">Jumlah sampel</label>
              <input v-model.number="form.sample_count" class="app-input" type="number" min="1" />
              <p v-if="errors.sample_count" class="mt-1 text-sm text-rose-600">
                {{ errors.sample_count }}
              </p>
            </div>
          </div>

          <div>
            <label class="app-label">Catatan harian</label>
            <textarea
              v-model="form.notes"
              class="app-textarea"
              placeholder="Contoh: cuaca panas, konsumsi air naik, litter lembap"
              rows="4"
            />
          </div>

          <p v-if="submitError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ submitError }}
          </p>
          <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ successMessage }}
          </p>

          <div class="flex flex-wrap gap-3">
            <button class="btn-primary" :disabled="submitting" type="submit">
              {{ submitting ? 'Menyimpan...' : 'Simpan log harian' }}
            </button>
            <button class="btn-secondary" type="button" @click="router.back()">
              Batal
            </button>
          </div>
        </form>
      </section>
    </template>
  </AppLayout>
</template>
