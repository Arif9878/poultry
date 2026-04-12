import type { DashboardSummary, DashboardTrendPoint } from '../types/models'
import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import { listPendingDailyLogs } from './offlineQueue.service'
import { listFlocksByFarm } from './flocks.service'
import { withCache } from './localCache.service'
import { getFeedSummaryByFarm } from './feed.service'

function isoDaysAgo(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function isoDateOffset(baseDate: string, offset: number) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function summarizeLayerMetrics(
  logs: Array<{
    feed_used_kg: number
    feed_price_per_kg_rp: number
    live_population: number
    egg_count: number | null
    egg_price_per_kg_rp: number
    egg_weight_per_egg_kg: number
  }>,
) {
  const totalEggs = logs.reduce((sum, log) => sum + Number(log.egg_count ?? 0), 0)
  const totalEggWeightKg = logs.reduce(
    (sum, log) => sum + Number(log.egg_count ?? 0) * Number(log.egg_weight_per_egg_kg ?? 0),
    0,
  )
  const totalFeedKg = logs.reduce((sum, log) => sum + Number(log.feed_used_kg ?? 0), 0)
  const totalLivePopulation = logs.reduce((sum, log) => sum + Number(log.live_population ?? 0), 0)
  const totalEggRevenueRp = logs.reduce(
    (sum, log) =>
      sum +
      Number(log.egg_count ?? 0) *
        Number(log.egg_weight_per_egg_kg ?? 0) *
        Number(log.egg_price_per_kg_rp ?? 0),
    0,
  )
  const totalFeedCostRp = logs.reduce(
    (sum, log) => sum + Number(log.feed_used_kg ?? 0) * Number(log.feed_price_per_kg_rp ?? 0),
    0,
  )

  return {
    totalEggs,
    totalEggWeightKg,
    averageHdPercent: totalLivePopulation > 0 ? (totalEggs / totalLivePopulation) * 100 : 0,
    averageFcr: totalEggWeightKg > 0 ? totalFeedKg / totalEggWeightKg : null,
    totalProfitRp: totalEggRevenueRp - totalFeedCostRp,
  }
}

function getPendingLogsForRange(
  flockIds: string[],
  startDate: string,
  endDate: string,
) {
  return listPendingDailyLogs().filter(
    (log) =>
      flockIds.includes(log.flock_id) && log.log_date >= startDate && log.log_date <= endDate,
  )
}

function getAverageDailyFeedUsage(
  logs: Array<{
    log_date: string
    feed_used_kg: number
  }>,
) {
  const feedByDate = new Map<string, number>()

  for (const log of logs) {
    const isoDate = log.log_date
    const nextTotal = (feedByDate.get(isoDate) ?? 0) + Number(log.feed_used_kg ?? 0)
    feedByDate.set(isoDate, nextTotal)
  }

  const loggedDays = [...feedByDate.values()].filter((total) => total > 0)
  if (!loggedDays.length) {
    return 0
  }

  return loggedDays.reduce((sum, total) => sum + total, 0) / loggedDays.length
}

export async function getFarmDashboardSummary(
  farmId: string,
  selectedDate: string,
) {
  assertSupabaseConfigured()

  const activeFlocks = await listFlocksByFarm(farmId, 'active')
  const flockIds = activeFlocks.map((flock) => flock.id)

  if (!flockIds.length) {
    return {
      currentPopulation: 0,
      totalMortality: 0,
      totalFeedUsedKg: 0,
      averageDailyFeedUsageKg: 0,
      averageFeedPerBirdKg: null,
      eggProduction: 0,
      latestAvgWeightGram: null,
      activeFlockCount: 0,
      pendingSyncCount: 0,
      totalEggWeightKg: 0,
      averageHdPercent: 0,
      averageFcr: null,
      totalProfitRp: 0,
      lastFeedStockKg: 0,
      estimatedFeedStockDays: null,
      targetHdPercent: null,
      maxFcr: null,
      safetyStockDays: null,
      feedStockStatus: 'aman',
      hdBelowTarget: false,
      fcrAboveLimit: false,
      feedBelowSafetyStock: false,
    } satisfies DashboardSummary
  }

  const layerFlocks = activeFlocks.filter((flock) => flock.flock_type === 'layer')
  const layerFlockIds = layerFlocks.map((flock) => flock.id)
  const last7StartDate = isoDateOffset(selectedDate, -6)

  const [dayLogs, latestWeightLogs, recentFeedLogs, feedSummary] = await Promise.all([
    withCache(`dashboard:day:${farmId}:${selectedDate}`, async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select(
          'flock_id, mortality_count, feed_used_kg, feed_price_per_kg_rp, egg_count, egg_price_per_kg_rp, egg_weight_per_egg_kg, live_population, avg_weight_gram',
        )
        .in('flock_id', flockIds)
        .eq('log_date', selectedDate)

      if (error) {
        throw error
      }

      return data as Array<{
        flock_id: string
        mortality_count: number
        feed_used_kg: number
        feed_price_per_kg_rp: number
        egg_count: number | null
        egg_price_per_kg_rp: number
        egg_weight_per_egg_kg: number
        live_population: number
        avg_weight_gram: number | null
      }>
    }),
    withCache(`dashboard:latest-weight:${farmId}`, async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('avg_weight_gram, log_date')
        .in('flock_id', flockIds)
        .not('avg_weight_gram', 'is', null)
        .order('log_date', { ascending: false })
        .limit(1)

      if (error) {
        throw error
      }

      return data as Array<{ avg_weight_gram: number | null; log_date: string }>
    }),
    withCache(`dashboard:recent-feed:${farmId}:${selectedDate}`, async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('flock_id, log_date, feed_used_kg')
        .in('flock_id', flockIds)
        .gte('log_date', last7StartDate)
        .lte('log_date', selectedDate)

      if (error) {
        throw error
      }

      return data as Array<{ flock_id: string; log_date: string; feed_used_kg: number }>
    }),
    getFeedSummaryByFarm(farmId, selectedDate),
  ])

  const pendingDayLogs = getPendingLogsForRange(flockIds, selectedDate, selectedDate)
  const latestPendingWeight = [...listPendingDailyLogs()]
    .filter((log) => flockIds.includes(log.flock_id) && log.avg_weight_gram !== null)
    .sort((left, right) => right.log_date.localeCompare(left.log_date))[0]
  const layerDayLogs = [
    ...dayLogs.filter((log) => layerFlockIds.includes(log.flock_id)),
    ...pendingDayLogs.filter((log) => layerFlockIds.includes(log.flock_id)),
  ]
  const layerMetrics = summarizeLayerMetrics(layerDayLogs)
  const pendingRecentLogs = getPendingLogsForRange(flockIds, last7StartDate, selectedDate)
  const averageDailyFeedUsage = feedSummary.averageDailyUsageKg || getAverageDailyFeedUsage([...recentFeedLogs, ...pendingRecentLogs])
  const lastFeedStockKg = feedSummary.totalStockKg
  const targetHdPercent =
    layerFlocks.length > 0
      ? layerFlocks.reduce((sum, flock) => sum + Number(flock.target_hd_percent ?? 0), 0) /
        layerFlocks.length
      : null
  const maxFcr =
    layerFlocks.length > 0
      ? layerFlocks.reduce((sum, flock) => sum + Number(flock.max_fcr ?? 0), 0) / layerFlocks.length
      : null
  const safetyStockDays =
    layerFlocks.length > 0
      ? layerFlocks.reduce((sum, flock) => sum + Number(flock.safety_stock_days ?? 0), 0) /
        layerFlocks.length
      : null
  const estimatedFeedStockDays =
    averageDailyFeedUsage > 0 ? lastFeedStockKg / averageDailyFeedUsage : null

  return {
    currentPopulation: activeFlocks.reduce(
      (total, flock) => total + Number(flock.current_chicken_count ?? 0),
      0,
    ),
    totalMortality:
      dayLogs.reduce((total, log) => total + Number(log.mortality_count ?? 0), 0) +
      pendingDayLogs.reduce((total, log) => total + Number(log.mortality_count ?? 0), 0),
    totalFeedUsedKg:
      dayLogs.reduce((total, log) => total + Number(log.feed_used_kg ?? 0), 0) +
      pendingDayLogs.reduce((total, log) => total + Number(log.feed_used_kg ?? 0), 0),
    averageDailyFeedUsageKg: feedSummary.averageDailyUsageKg,
    averageFeedPerBirdKg: feedSummary.averageFeedPerBirdKg,
    eggProduction: layerMetrics.totalEggs,
    latestAvgWeightGram:
      latestPendingWeight?.avg_weight_gram ?? latestWeightLogs[0]?.avg_weight_gram ?? null,
    activeFlockCount: activeFlocks.length,
    pendingSyncCount: pendingDayLogs.length,
    totalEggWeightKg: layerMetrics.totalEggWeightKg,
    averageHdPercent: layerMetrics.averageHdPercent,
    averageFcr: layerMetrics.averageFcr,
    totalProfitRp: layerMetrics.totalProfitRp,
    lastFeedStockKg,
    estimatedFeedStockDays,
    targetHdPercent,
    maxFcr,
    safetyStockDays,
    feedStockStatus: feedSummary.stockStatus,
    hdBelowTarget:
      targetHdPercent !== null && layerMetrics.averageHdPercent < Number(targetHdPercent),
    fcrAboveLimit:
      maxFcr !== null &&
      layerMetrics.averageFcr !== null &&
      layerMetrics.averageFcr > Number(maxFcr),
    feedBelowSafetyStock:
      safetyStockDays !== null &&
      estimatedFeedStockDays !== null &&
      estimatedFeedStockDays < Number(safetyStockDays),
  } satisfies DashboardSummary
}

export async function getFarmTrend(farmId: string, days = 7, endDate = isoDaysAgo(0)) {
  assertSupabaseConfigured()

  const activeFlocks = await listFlocksByFarm(farmId, 'active')
  const flockIds = activeFlocks.map((flock) => flock.id)

  if (!flockIds.length) {
    return [] as DashboardTrendPoint[]
  }

  const startDate = isoDateOffset(endDate, -(days - 1))

  const remoteLogs = await withCache(`dashboard:trend:${farmId}:${days}:${endDate}`, async () => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select(
        'flock_id, log_date, feed_used_kg, mortality_count, egg_count, egg_price_per_kg_rp, egg_weight_per_egg_kg, feed_price_per_kg_rp',
      )
      .in('flock_id', flockIds)
      .gte('log_date', startDate)
      .lte('log_date', endDate)

    if (error) {
      throw error
    }

    return data as Array<{
      flock_id: string
      log_date: string
      feed_used_kg: number
      mortality_count: number
      egg_count: number | null
      egg_price_per_kg_rp: number
      egg_weight_per_egg_kg: number
      feed_price_per_kg_rp: number
    }>
  })

  const pendingLogs = getPendingLogsForRange(flockIds, startDate, endDate)

  const trend: DashboardTrendPoint[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const isoDate = isoDateOffset(endDate, -offset)
    const displayDate = new Date(isoDate)
    const dayRemoteLogs = remoteLogs.filter((log) => log.log_date === isoDate)
    const dayPendingLogs = pendingLogs.filter((log) => log.log_date === isoDate)

    trend.push({
      date: isoDate,
      label: new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
      }).format(displayDate),
      feed_used_kg:
        dayRemoteLogs.reduce((sum, log) => sum + Number(log.feed_used_kg ?? 0), 0) +
        dayPendingLogs.reduce((sum, log) => sum + Number(log.feed_used_kg ?? 0), 0),
      mortality_count:
        dayRemoteLogs.reduce((sum, log) => sum + Number(log.mortality_count ?? 0), 0) +
        dayPendingLogs.reduce((sum, log) => sum + Number(log.mortality_count ?? 0), 0),
      egg_count:
        dayRemoteLogs.reduce((sum, log) => sum + Number(log.egg_count ?? 0), 0) +
        dayPendingLogs.reduce((sum, log) => sum + Number(log.egg_count ?? 0), 0),
      egg_weight_kg:
        dayRemoteLogs.reduce(
          (sum, log) =>
            sum + Number(log.egg_count ?? 0) * Number(log.egg_weight_per_egg_kg ?? 0),
          0,
        ) +
        dayPendingLogs.reduce(
          (sum, log) =>
            sum + Number(log.egg_count ?? 0) * Number(log.egg_weight_per_egg_kg ?? 0),
          0,
        ),
      profit_rp:
        dayRemoteLogs.reduce(
          (sum, log) =>
            sum +
            Number(log.egg_count ?? 0) *
              Number(log.egg_weight_per_egg_kg ?? 0) *
              Number(log.egg_price_per_kg_rp ?? 0) -
            Number(log.feed_used_kg ?? 0) * Number(log.feed_price_per_kg_rp ?? 0),
          0,
        ) +
        dayPendingLogs.reduce(
          (sum, log) =>
            sum +
            Number(log.egg_count ?? 0) *
              Number(log.egg_weight_per_egg_kg ?? 0) *
              Number(log.egg_price_per_kg_rp ?? 0) -
            Number(log.feed_used_kg ?? 0) * Number(log.feed_price_per_kg_rp ?? 0),
          0,
        ),
    })
  }

  return trend
}
