<script setup lang="ts">
defineProps<{
  online: boolean
  syncing: boolean
  pending: number
}>()
</script>

<template>
  <span
    class="status-pill"
    :class="
      syncing
        ? 'bg-amber-100 text-amber-800'
        : online
          ? pending
            ? 'bg-orange-100 text-orange-700'
            : 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-200 text-slate-700'
    "
  >
    <span class="h-2 w-2 rounded-full bg-current opacity-70" />
    <span v-if="syncing">Sinkronisasi...</span>
    <span v-else-if="!online">Offline</span>
    <span v-else-if="pending">{{ pending }} pending sync</span>
    <span v-else>Tersinkron</span>
  </span>
</template>
