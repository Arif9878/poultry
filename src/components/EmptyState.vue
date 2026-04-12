<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="rounded-3xl border border-dashed border-emerald-200 bg-white/70 px-5 py-8 text-center">
    <p class="text-base font-semibold text-ink">{{ title }}</p>
    <p class="mt-2 text-sm text-slate-500">{{ description }}</p>
  </div>
</template>
