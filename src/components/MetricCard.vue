<script setup lang="ts">
defineProps<{
  label: string
  value: string
  helper?: string
}>()
</script>

<template>
  <article class="surface-card">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {{ label }}
    </p>
    <p class="mt-3 text-3xl font-bold text-ink">{{ value }}</p>
    <p v-if="helper" class="mt-2 text-sm text-slate-500">{{ helper }}</p>
  </article>
</template>
