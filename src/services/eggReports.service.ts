import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { EggReportRow, EggReportSummary } from '../types/models'
import { listPendingDailyLogs } from './offlineQueue.service'
import { withCache } from './localCache.service'

interface EggReportRemoteRow {
  id: string
  flock_id: string
  log_date: string
  live_population: number
  egg_count: number | null
  feed_used_kg: number
  feed_price_per_kg_rp: number
  egg_price_per_kg_rp: number
  egg_weight_per_egg_kg: number
  sync_status?: 'synced' | 'pending'
  flocks: Array<{
    id: string
    code: string
    name: string
    flock_type: 'layer' | 'broiler'
    farm_id: string
  }> | null
}

function mapEggRow(row: EggReportRemoteRow) {
  const flock = row.flocks?.[0]
  const eggCount = Number(row.egg_count ?? 0)
  const livePopulation = Number(row.live_population ?? 0)
  const feedUsedKg = Number(row.feed_used_kg ?? 0)
  const eggWeightPerEggKg = Number(row.egg_weight_per_egg_kg ?? 0)
  const totalEggWeightKg = eggCount * eggWeightPerEggKg
  const eggRevenueRp = totalEggWeightKg * Number(row.egg_price_per_kg_rp ?? 0)
  const feedCostRp = feedUsedKg * Number(row.feed_price_per_kg_rp ?? 0)

  return {
    id: row.id,
    log_date: row.log_date,
    flock_id: row.flock_id,
    flock_code: flock?.code ?? '-',
    flock_name: flock?.name ?? '-',
    live_population: livePopulation,
    egg_count: eggCount,
    feed_used_kg: feedUsedKg,
    total_egg_weight_kg: totalEggWeightKg,
    hen_day_percentage: livePopulation > 0 ? (eggCount / livePopulation) * 100 : 0,
    fcr: totalEggWeightKg > 0 ? feedUsedKg / totalEggWeightKg : null,
    egg_revenue_rp: eggRevenueRp,
    feed_cost_rp: feedCostRp,
    gross_profit_rp: eggRevenueRp - feedCostRp,
    sync_status: row.sync_status ?? 'synced',
  } satisfies EggReportRow
}

export async function getEggReportRows(input: {
  farmId: string
  startDate?: string
  endDate?: string
}) {
  assertSupabaseConfigured()

  const cacheKey = JSON.stringify(['egg-report', input])
  const remoteRows = await withCache(cacheKey, async () => {
    let query = supabase
      .from('daily_logs')
      .select(
        `
        id,
        flock_id,
        log_date,
        live_population,
        egg_count,
        feed_used_kg,
        feed_price_per_kg_rp,
        egg_price_per_kg_rp,
        egg_weight_per_egg_kg,
        sync_status,
        flocks!inner (
          id,
          code,
          name,
          flock_type,
          farm_id
        )
      `,
      )
      .eq('flocks.farm_id', input.farmId)
      .eq('flocks.flock_type', 'layer')
      .not('egg_count', 'is', null)
      .order('log_date', { ascending: false })

    if (input.startDate) {
      query = query.gte('log_date', input.startDate)
    }

    if (input.endDate) {
      query = query.lte('log_date', input.endDate)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return (data as EggReportRemoteRow[]).map(mapEggRow)
  })

  const pendingFlocks = await withCache(`egg-report:flocks:${input.farmId}`, async () => {
    const { data, error } = await supabase
      .from('flocks')
      .select('id, code, name, flock_type, farm_id')
      .eq('farm_id', input.farmId)
      .eq('flock_type', 'layer')

    if (error) {
      throw error
    }

    return Object.fromEntries(
      (data as Array<{
        id: string
        code: string
        name: string
        flock_type: 'layer' | 'broiler'
        farm_id: string
      }>).map((flock) => [flock.id, flock]),
    ) as Record<string, { id: string; code: string; name: string; flock_type: 'layer' | 'broiler'; farm_id: string }>
  })

  const pendingRows = listPendingDailyLogs()
    .filter((log) => pendingFlocks[log.flock_id])
    .filter((log) => (input.startDate ? log.log_date >= input.startDate : true))
    .filter((log) => (input.endDate ? log.log_date <= input.endDate : true))
    .map((log) =>
      mapEggRow({
        id: log.id,
        flock_id: log.flock_id,
        log_date: log.log_date,
        live_population: log.live_population,
        egg_count: log.egg_count,
        feed_used_kg: log.feed_used_kg,
        feed_price_per_kg_rp: log.feed_price_per_kg_rp,
        egg_price_per_kg_rp: log.egg_price_per_kg_rp,
        egg_weight_per_egg_kg: log.egg_weight_per_egg_kg,
        sync_status: 'pending',
        flocks: pendingFlocks[log.flock_id] ? [pendingFlocks[log.flock_id]] : null,
      }),
    )

  return [...pendingRows, ...remoteRows].sort((left, right) =>
    right.log_date.localeCompare(left.log_date),
  )
}

export async function getEggReportSummary(input: {
  farmId: string
  startDate?: string
  endDate?: string
}) {
  const rows = await getEggReportRows(input)
  const totalEggs = rows.reduce((sum, row) => sum + row.egg_count, 0)
  const totalEggWeightKg = rows.reduce((sum, row) => sum + row.total_egg_weight_kg, 0)
  const totalFeedKg = rows.reduce((sum, row) => sum + row.feed_used_kg, 0)
  const totalProfitRp = rows.reduce((sum, row) => sum + row.gross_profit_rp, 0)
  const reportingFlocks = new Set(rows.map((row) => row.flock_id)).size

  return {
    totalEggs,
    totalEggWeightKg,
    averageHenDay:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.hen_day_percentage, 0) / rows.length
        : 0,
    averageFcr: totalEggWeightKg > 0 ? totalFeedKg / totalEggWeightKg : null,
    reportingFlocks,
    totalFeedKg,
    totalProfitRp,
  } satisfies EggReportSummary
}
