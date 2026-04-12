import { ref } from 'vue'

export const dataVersion = ref(0)
export const onlineStatus = ref(
  typeof navigator === 'undefined' ? true : navigator.onLine,
)
export const syncState = ref({
  syncing: false,
  lastSyncedAt: '',
  syncedCount: 0,
})

let listenersBound = false

export function initializeClientState() {
  if (listenersBound || typeof window === 'undefined') {
    return
  }

  const updateOnlineStatus = () => {
    onlineStatus.value = navigator.onLine
  }

  updateOnlineStatus()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  listenersBound = true
}

export function bumpDataVersion() {
  dataVersion.value += 1
}

export function beginSync() {
  syncState.value = {
    ...syncState.value,
    syncing: true,
  }
}

export function finishSync(syncedCount: number) {
  syncState.value = {
    syncing: false,
    syncedCount,
    lastSyncedAt: new Date().toISOString(),
  }
}
