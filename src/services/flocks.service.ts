import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { DailyLog, Flock, FlockKpi, FlockStatus } from '../types/models'
import { listPendingDailyLogs, toDailyLog } from './offlineQueue.service'
import { clearCache, withCache } from './localCache.service'
import { getCurrentSession } from './auth.service'

interface FlockRow extends Omit<Flock, 'house_name'> {
  houses: { name: string | null } | null
}

function mapFlock(row: FlockRow) {
  return {
    ...row,
    house_name: row.houses?.name ?? null,
  } satisfies Flock
}

function mergePendingLogs(remoteLogs: DailyLog[], flockId: string) {
  const pendingLogs = listPendingDailyLogs()
    .filter((log) => log.flock_id === flockId)
    .map((log) => toDailyLog(log))

  return [...pendingLogs, ...remoteLogs].sort((left, right) =>
    right.log_date.localeCompare(left.log_date),
  )
}

async function getFlockBaselinePopulation(flock: Flock) {
  const [inboundTransfers, outboundTransfers] = await Promise.all([
    withCache(`flock-transfer-impact:in:${flock.id}`, async () => {
      const { data, error } = await supabase
        .from('flock_transfers')
        .select('chicken_count')
        .eq('to_flock_id', flock.id)

      if (error) {
        throw error
      }

      return ((data ?? []) as Array<{ chicken_count: number }>).reduce(
        (sum, row) => sum + Number(row.chicken_count ?? 0),
        0,
      )
    }),
    withCache(`flock-transfer-impact:out:${flock.id}`, async () => {
      const { data, error } = await supabase
        .from('flock_transfers')
        .select('chicken_count')
        .eq('from_flock_id', flock.id)

      if (error) {
        throw error
      }

      return ((data ?? []) as Array<{ chicken_count: number }>).reduce(
        (sum, row) => sum + Number(row.chicken_count ?? 0),
        0,
      )
    }),
  ])

  return flock.initial_chicken_count + inboundTransfers - outboundTransfers
}

export async function listFlocksByFarm(
  farmId: string,
  status: FlockStatus | 'all' = 'all',
) {
  assertSupabaseConfigured()

  return withCache(`flocks:${farmId}:${status}`, async () => {
    let query = supabase
      .from('flocks')
      .select(
        `
        *,
        houses (
          name
        )
      `,
      )
      .eq('farm_id', farmId)
      .order('start_date', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return (data as FlockRow[]).map(mapFlock)
  })
}

export async function getFlockById(flockId: string) {
  assertSupabaseConfigured()

  return withCache(`flock:${flockId}`, async () => {
    const { data, error } = await supabase
      .from('flocks')
      .select(
        `
        *,
        houses (
          name
        )
      `,
      )
      .eq('id', flockId)
      .single()

    if (error) {
      throw error
    }

    return mapFlock(data as FlockRow)
  })
}

export async function getRecentLogsByFlockId(flockId: string, limit = 7) {
  assertSupabaseConfigured()

  const remoteLogs = await withCache(`flock-logs:${flockId}:${limit}`, async () => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('flock_id', flockId)
      .order('log_date', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data as DailyLog[]).map((log) => ({
      ...log,
      sync_status: 'synced' as const,
    }))
  })

  return mergePendingLogs(remoteLogs, flockId).slice(0, limit)
}

export async function createFlock(input: {
  farmId: string
  houseId: string
  code: string
  name: string
  flockType: Flock['flock_type']
  startDate: string
  initialChickenCount: number
  strain: string
  sourceVendor: string
  eggPricePerKgRp: number
  eggWeightPerEggKg: number
  targetHdPercent: number
  maxFcr: number
  safetyStockDays: number
  notes: string
}) {
  assertSupabaseConfigured()
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sesi pengguna tidak ditemukan')
  }

  const { error } = await supabase.from('flocks').insert({
    farm_id: input.farmId,
    house_id: input.houseId,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    flock_type: input.flockType,
    start_date: input.startDate,
    initial_chicken_count: input.initialChickenCount,
    current_chicken_count: input.initialChickenCount,
    strain: input.strain.trim() || null,
    source_vendor: input.sourceVendor.trim() || null,
    egg_price_per_kg_rp: input.flockType === 'layer' ? input.eggPricePerKgRp : 0,
    egg_weight_per_egg_kg: input.flockType === 'layer' ? input.eggWeightPerEggKg : 0.06,
    target_hd_percent: input.flockType === 'layer' ? input.targetHdPercent : 0,
    max_fcr: input.flockType === 'layer' ? input.maxFcr : 0.001,
    safety_stock_days: input.flockType === 'layer' ? input.safetyStockDays : 0,
    status: 'active',
    notes: input.notes.trim() || null,
    created_by: session.user_id,
  })

  if (error) {
    throw error
  }

  clearCache()
  const flocks = await listFlocksByFarm(input.farmId, 'all')
  const createdFlock = flocks.find(
    (item) => item.code === input.code.trim().toUpperCase() && item.name === input.name.trim(),
  )

  if (!createdFlock) {
    throw new Error('Kandang berhasil ditambahkan, tetapi data terbaru belum tersedia')
  }

  return createdFlock
}

export async function getFlockTrend(flockId: string, limit = 7) {
  return getRecentLogsByFlockId(flockId, limit).then((logs) => [...logs].reverse())
}

export async function getFlockKpis(flockId: string) {
  const flock = await getFlockById(flockId)
  const logs = await getRecentLogsByFlockId(flockId, 30)
  const baselinePopulation = await getFlockBaselinePopulation(flock)

  if (!logs.length) {
    return {
      mortalityRate:
        baselinePopulation > 0
          ? (Math.max(0, baselinePopulation - flock.current_chicken_count) / baselinePopulation) * 100
          : 0,
      feedPerBird: 0,
      henDayProduction: flock.flock_type === 'layer' ? 0 : null,
      averageSampleWeight: flock.flock_type === 'broiler' ? 0 : null,
    } satisfies FlockKpi
  }

  const totalFeed = logs.reduce((sum, log) => sum + log.feed_used_kg, 0)
  const latestLog = logs[0]
  const feedPerBird =
    latestLog.live_population > 0 ? totalFeed / latestLog.live_population : 0
  const layerLogs = logs.filter((log) => log.egg_count !== null)
  const broilerLogs = logs.filter((log) => log.avg_weight_gram !== null)

  return {
    mortalityRate:
      baselinePopulation > 0
        ? (Math.max(0, baselinePopulation - flock.current_chicken_count) / baselinePopulation) * 100
        : 0,
    feedPerBird,
    henDayProduction:
      flock.flock_type === 'layer' && layerLogs.length
        ? (layerLogs.reduce((sum, log) => sum + (log.egg_count ?? 0), 0) /
            layerLogs.length /
            Math.max(1, latestLog.live_population)) *
          100
        : null,
    averageSampleWeight:
      flock.flock_type === 'broiler' && broilerLogs.length
        ? broilerLogs.reduce((sum, log) => sum + (log.avg_weight_gram ?? 0), 0) /
          broilerLogs.length
        : null,
  } satisfies FlockKpi
}

export async function countAccessibleFlocks() {
  assertSupabaseConfigured()

  const { count, error } = await supabase
    .from('flocks')
    .select('id', { count: 'exact', head: true })

  if (error) {
    throw error
  }

  return count ?? 0
}
