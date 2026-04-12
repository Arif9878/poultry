import type { DailyLog, DailyLogInput, Flock } from '../types/models'
import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import { bumpDataVersion, onlineStatus } from '../lib/appState'
import { getCurrentSession } from './auth.service'
import { clearCache, withCache } from './localCache.service'
import {
  enqueuePendingDailyLog,
  listPendingDailyLogs,
  toDailyLog,
} from './offlineQueue.service'
import { syncPendingLogs } from './sync.service'

interface HistoryFilters {
  farmId?: string
  flockId?: string
  startDate?: string
  endDate?: string
}

interface DailyLogRow extends Omit<DailyLog, 'flock' | 'sync_status'> {
  flocks?: DailyLog['flock']
}

function hydrateLog(log: DailyLog) {
  return {
    ...log,
    sync_status: log.sync_status ?? 'synced',
  } satisfies DailyLog
}

export async function persistDailyLog(
  flock: Flock,
  form: DailyLogInput,
  clientRequestId: string,
) {
  assertSupabaseConfigured()

  const { data, error } = await supabase
    .from('daily_logs')
    .upsert(
      {
        flock_id: flock.id,
        client_request_id: clientRequestId,
        log_date: form.log_date,
        feed_used_kg: form.feed_used_kg ?? 0,
        feed_price_per_kg_rp: form.feed_price_per_kg_rp ?? 0,
        mortality_count: form.mortality_count ?? 0,
        live_population: form.live_population ?? flock.current_chicken_count,
        egg_count: flock.flock_type === 'layer' ? form.egg_count : null,
        egg_price_per_kg_rp:
          flock.flock_type === 'layer'
            ? (form.egg_price_per_kg_rp ?? flock.egg_price_per_kg_rp)
            : 0,
        egg_weight_per_egg_kg:
          flock.flock_type === 'layer'
            ? (form.egg_weight_per_egg_kg ?? flock.egg_weight_per_egg_kg)
            : 0.06,
        avg_weight_gram: flock.flock_type === 'broiler' ? form.avg_weight_gram : null,
        sample_count: flock.flock_type === 'broiler' ? form.sample_count : null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        sync_status: 'synced',
      },
      { onConflict: 'client_request_id' },
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  clearCache()
  bumpDataVersion()
  return hydrateLog(data as DailyLog)
}

export async function createDailyLog(flock: Flock, form: DailyLogInput) {
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sesi pengguna tidak ditemukan')
  }

  if (!onlineStatus.value) {
    return toDailyLog(
      enqueuePendingDailyLog({
        flockId: flock.id,
        form,
        createdBy: session.user_id,
      }),
    )
  }

  const log = await persistDailyLog(flock, form, crypto.randomUUID())
  void syncPendingLogs()
  return log
}

export async function listDailyLogHistory(filters: HistoryFilters) {
  assertSupabaseConfigured()

  const cacheKey = JSON.stringify(['history', filters])
  const remoteLogs = await withCache(cacheKey, async () => {
    let query = supabase
      .from('daily_logs')
      .select(
        `
        *,
        flocks!inner (
          id,
          farm_id,
          code,
          name,
          flock_type
        )
      `,
      )
      .order('log_date', { ascending: false })
      .limit(60)

    if (filters.farmId) {
      query = query.eq('flocks.farm_id', filters.farmId)
    }

    if (filters.flockId) {
      query = query.eq('flock_id', filters.flockId)
    }

    if (filters.startDate) {
      query = query.gte('log_date', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('log_date', filters.endDate)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return (data as DailyLogRow[]).map((row) => ({
      ...row,
      sync_status: 'synced',
      flock: row.flocks,
    })) as DailyLog[]
  })

  const pendingQueue = listPendingDailyLogs()
  const pendingFlockIds = [...new Set(pendingQueue.map((log) => log.flock_id))]
  const pendingFlockMap =
    pendingFlockIds.length > 0
      ? await withCache(`history:pending-flocks:${pendingFlockIds.join(',')}`, async () => {
          const { data, error } = await supabase
            .from('flocks')
            .select('id, farm_id, code, name, flock_type')
            .in('id', pendingFlockIds)

          if (error) {
            throw error
          }

          return Object.fromEntries(
            (data as Array<NonNullable<DailyLog['flock']>>).map((flock) => [flock.id, flock]),
          ) as Record<string, NonNullable<DailyLog['flock']>>
        })
      : {}

  const pendingLogs = pendingQueue
    .map((log) => ({
      ...toDailyLog(log),
      flock: pendingFlockMap[log.flock_id],
    }))
    .filter((log) => (filters.flockId ? log.flock_id === filters.flockId : true))
    .filter((log) => (filters.startDate ? log.log_date >= filters.startDate : true))
    .filter((log) => (filters.endDate ? log.log_date <= filters.endDate : true))

  const farmScopedPendingLogs =
    filters.farmId && pendingLogs.length
      ? pendingLogs.filter((log) =>
          log.flock?.farm_id === filters.farmId ||
          remoteLogs.some(
            (remoteLog) =>
              remoteLog.flock_id === log.flock_id &&
              remoteLog.flock?.farm_id === filters.farmId,
          ),
        )
      : pendingLogs

  return [...farmScopedPendingLogs, ...remoteLogs]
    .sort((left, right) => right.log_date.localeCompare(left.log_date))
    .slice(0, 60)
}
