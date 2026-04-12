import { beginSync, finishSync, onlineStatus } from '../lib/appState'
import { bumpDataVersion } from '../lib/appState'
import { getCurrentSession } from './auth.service'
import { getFlockById } from './flocks.service'
import { clearCache } from './localCache.service'
import { listPendingDailyLogs, removePendingDailyLog } from './offlineQueue.service'
import { persistDailyLog } from './dailyLogs.service'

export async function syncPendingLogs() {
  if (!onlineStatus.value) {
    return 0
  }

  const session = await getCurrentSession()
  if (!session) {
    return 0
  }

  const pendingLogs = listPendingDailyLogs()
  if (!pendingLogs.length) {
    finishSync(0)
    return 0
  }

  beginSync()
  let syncedCount = 0

  for (const pendingLog of pendingLogs) {
    const flock = await getFlockById(pendingLog.flock_id)

    await persistDailyLog(
      flock,
      {
        log_date: pendingLog.log_date,
        feed_used_kg: pendingLog.feed_used_kg,
        feed_price_per_kg_rp: pendingLog.feed_price_per_kg_rp,
        mortality_count: pendingLog.mortality_count,
        live_population: pendingLog.live_population,
        egg_count: pendingLog.egg_count,
        egg_price_per_kg_rp: pendingLog.egg_price_per_kg_rp,
        egg_weight_per_egg_kg: pendingLog.egg_weight_per_egg_kg,
        avg_weight_gram: pendingLog.avg_weight_gram,
        sample_count: pendingLog.sample_count,
        notes: pendingLog.notes ?? '',
      },
      pendingLog.client_request_id,
    )

    removePendingDailyLog(pendingLog.client_request_id)
    syncedCount += 1
  }

  clearCache()
  bumpDataVersion()
  finishSync(syncedCount)
  return syncedCount
}

export async function getPendingSyncCount() {
  return listPendingDailyLogs().length
}
