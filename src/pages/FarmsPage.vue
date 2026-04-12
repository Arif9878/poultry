<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import EmptyState from '../components/EmptyState.vue'
import { useAuth } from '../composables/useAuth'
import { useFarms } from '../composables/useFarms'
import { dataVersion } from '../lib/appState'

const { profile } = useAuth()
const { farms, loading, error, loadFarms, addFarm } = useFarms()

const form = reactive({
  name: '',
  location: '',
  managerName: profile.value?.full_name ?? '',
})

async function submitFarm() {
  if (!form.name.trim() || !form.location.trim()) {
    return
  }

  await addFarm({
    name: form.name,
    location: form.location,
    managerName: form.managerName,
  })

  form.name = ''
  form.location = ''
}

onMounted(() => {
  void loadFarms()
})

watch(dataVersion, () => {
  void loadFarms()
})
</script>

<template>
  <AppLayout
    title="Kandang & flock"
    subtitle="Pilih farm, buka kandang, lalu lanjut ke kelompok ayam yang ingin dicek."
  >
    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <section
      v-if="profile?.role !== 'operator'"
      class="surface-card"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-lg font-semibold text-ink">Tambah farm</p>
          <p class="text-sm text-slate-500">
            Untuk MVP, admin dan manager bisa menambahkan farm baru langsung dari UI.
          </p>
        </div>
        <span class="status-pill bg-emerald-100 text-emerald-700">{{ profile?.role }}</span>
      </div>

      <form class="mt-5 grid gap-4 md:grid-cols-3" @submit.prevent="submitFarm">
        <div>
          <label class="app-label">Nama farm</label>
          <input v-model="form.name" class="app-input" placeholder="Farm Sukabumi Timur" />
        </div>
        <div>
          <label class="app-label">Lokasi</label>
          <input v-model="form.location" class="app-input" placeholder="Sukabumi, Jawa Barat" />
        </div>
        <div>
          <label class="app-label">PIC / Manager</label>
          <input v-model="form.managerName" class="app-input" placeholder="Nama manager" />
        </div>
        <div class="md:col-span-3">
          <button class="btn-primary" type="submit">Tambah farm</button>
        </div>
      </form>
    </section>

    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-lg font-semibold text-ink">Daftar farm</p>
          <p class="text-sm text-slate-500">Klik farm untuk setup kandang dan flock.</p>
        </div>
      </div>

      <div v-if="loading" class="surface-card text-sm text-slate-500">Memuat farm...</div>

      <div v-else-if="farms.length" class="grid gap-4 lg:grid-cols-2">
        <article
          v-for="farm in farms"
          :key="farm.id"
          class="surface-card"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {{ farm.membershipRole }}
              </p>
              <h3 class="mt-2 text-xl font-bold text-ink">{{ farm.name }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ farm.location || '-' }}</p>
            </div>
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-moss">
              {{ farm.manager_name || 'Belum ada PIC' }}
            </span>
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <RouterLink class="btn-primary flex-1" :to="`/farms/${farm.id}`">
              Buka farm
            </RouterLink>
            <RouterLink class="btn-secondary flex-1" to="/dashboard">
              Kembali ke dashboard
            </RouterLink>
          </div>
        </article>
      </div>

      <EmptyState
        v-else
        title="Belum ada farm"
        description="Tambahkan farm baru untuk memulai setup kandang dan flock."
      />
    </section>
  </AppLayout>
</template>
