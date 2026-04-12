<script setup lang="ts">
import { reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const route = useRoute();
const { signIn, loading, error } = useAuth();

const form = reactive({
  email: "",
  password: "",
});

async function submit() {
  const success = await signIn(form.email, form.password);
  if (success) {
    await router.replace(String(route.query.redirect ?? "/dashboard"));
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-8">
    <div class="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section
        class="surface-card overflow-hidden bg-gradient-to-br from-ink to-moss text-white"
      >
        <span class="status-pill bg-white/10 text-white">
          Solusi manajemen peternakan ayam mobile-first
        </span>

        <h1 class="mt-4 max-w-xl text-4xl font-bold leading-tight">
          Pantau pakan, mortalitas, populasi, produksi telur, dan bobot ayam
          dalam satu dashboard sederhana.
        </h1>

        <p class="mt-4 max-w-2xl text-sm text-emerald-50/90">
          Aplikasi ini membantu pencatatan operasional harian peternakan secara
          praktis — mulai dari manajemen farm, kandang, dan flock, hingga
          dashboard KPI, log harian, riwayat data, serta sinkronisasi otomatis
          dengan Supabase.
        </p>
        <!-- 
        <div class="mt-8 grid gap-4 sm:grid-cols-3">
          <div class="rounded-3xl bg-white/10 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-emerald-100">
              Feed hari ini
            </p>
            <p class="mt-2 text-2xl font-bold">2.202 kg</p>
          </div>
          <div class="rounded-3xl bg-white/10 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-emerald-100">
              Flock aktif
            </p>
            <p class="mt-2 text-2xl font-bold">3 flock</p>
          </div>
          <div class="rounded-3xl bg-white/10 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-emerald-100">
              Offline queue
            </p>
            <p class="mt-2 text-2xl font-bold">Auto sync</p>
          </div>
        </div> -->
      </section>

      <section class="surface-card">
        <p
          class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
        >
          Masuk
        </p>
        <h2 class="mt-2 text-3xl font-bold text-ink">
          Poultry Farm Management
        </h2>
        <p class="mt-2 text-sm text-slate-500">
          Masuk memakai akun email/password yang sudah dibuat di Supabase Auth.
        </p>

        <form class="mt-8 space-y-4" @submit.prevent="submit">
          <div>
            <label class="app-label" for="email">Email</label>
            <input
              id="email"
              v-model="form.email"
              class="app-input"
              type="email"
              required
            />
          </div>
          <div>
            <label class="app-label" for="password">Password</label>
            <input
              id="password"
              v-model="form.password"
              class="app-input"
              type="password"
              required
            />
          </div>

          <p
            v-if="error"
            class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {{ error }}
          </p>

          <button class="btn-primary w-full" :disabled="loading" type="submit">
            {{ loading ? "Masuk..." : "Masuk ke aplikasi" }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>
