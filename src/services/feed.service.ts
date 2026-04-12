import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { FeedItem, FeedSummary, FeedTransaction, FeedUsageHistoryRow } from '../types/models'
import { bumpDataVersion } from '../lib/appState'
import { getCurrentSession } from './auth.service'
import { clearCache, withCache } from './localCache.service'
import { listPendingDailyLogs } from './offlineQueue.service'
import { listFlocksByFarm } from './flocks.service'

interface FeedTransactionRow extends Omit<FeedTransaction, 'feed_item'> {
  feed_items: Pick<FeedItem, 'id' | 'name' | 'brand' | 'unit'> | null
}

interface FeedUsageRow {
  id: string
  flock_id: string
  log_date: string
  live_population: number
  feed_used_kg: number
  sync_status: 'synced' | 'pending'
  flocks: Array<{
    id: string
    code: string
    name: string
    farm_id?: string
  }>
}

const MAX_REASONABLE_FEED_PRICE_PER_KG = 100_000

function roundRupiah(value: number) {
  return Math.round(value)
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function isoDateOffset(baseDate: string, offset: number) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function getAverageDailyUsage(logs: Array<{ log_date: string; feed_used_kg: number }>) {
  const feedByDate = new Map<string, number>()

  for (const log of logs) {
    const nextTotal = (feedByDate.get(log.log_date) ?? 0) + Number(log.feed_used_kg ?? 0)
    feedByDate.set(log.log_date, nextTotal)
  }

  const loggedDays = [...feedByDate.values()].filter((total) => total > 0)
  if (!loggedDays.length) {
    return 0
  }

  return loggedDays.reduce((sum, total) => sum + total, 0) / loggedDays.length
}

function getFeedStockStatus(estimatedStockDays: number | null, totalStockKg: number, lowStockCount: number) {
  if (totalStockKg <= 0) {
    return 'kritis' as const
  }

  if (estimatedStockDays !== null) {
    if (estimatedStockDays < 3) {
      return 'kritis' as const
    }

    if (estimatedStockDays < 7) {
      return 'warning' as const
    }
  }

  if (lowStockCount > 0) {
    return 'warning' as const
  }

  return 'aman' as const
}

export function normalizeFeedUnitCost(unitCost: number | null, quantityKg: number) {
  if (unitCost === null) {
    return null
  }

  if (quantityKg > 0 && unitCost > MAX_REASONABLE_FEED_PRICE_PER_KG) {
    return roundRupiah(unitCost / quantityKg)
  }

  return roundRupiah(unitCost)
}

export function normalizeFeedTotalCost(unitCost: number | null, quantityKg: number) {
  if (unitCost === null) {
    return null
  }

  if (quantityKg > 0 && unitCost > MAX_REASONABLE_FEED_PRICE_PER_KG) {
    return unitCost
  }

  return unitCost * quantityKg
}

export function normalizeFeedItemPrice(pricePerKg: number, openingStockKg: number) {
  if (openingStockKg > 0 && pricePerKg > MAX_REASONABLE_FEED_PRICE_PER_KG) {
    return roundRupiah(pricePerKg / openingStockKg)
  }

  return roundRupiah(pricePerKg)
}

async function getFeedBaselineDate(farmId: string, endDate?: string) {
  return withCache(`feed-baseline:${farmId}:${endDate ?? 'latest'}`, async () => {
    let query = supabase
      .from('feed_transactions')
      .select('transaction_date, transaction_type')
      .eq('farm_id', farmId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const transactions = data as Array<{
      transaction_date: string
      transaction_type: FeedTransaction['transaction_type']
    }>

    const latestAdjustment = transactions.find(
      (transaction) => transaction.transaction_type === 'adjustment',
    )

    if (latestAdjustment) {
      return latestAdjustment.transaction_date
    }

    return transactions.at(-1)?.transaction_date ?? null
  })
}

export async function listFeedItemsByFarm(farmId: string) {
  assertSupabaseConfigured()

  return withCache(`feed-items:${farmId}`, async () => {
    const { data, error } = await supabase
      .from('feed_items')
      .select('*')
      .eq('farm_id', farmId)
      .order('name')

    if (error) {
      throw error
    }

    return data as FeedItem[]
  })
}

export async function listFeedTransactionsByFarm(farmId: string, limit = 25) {
  assertSupabaseConfigured()

  return withCache(`feed-transactions:${farmId}:${limit}`, async () => {
    const { data, error } = await supabase
      .from('feed_transactions')
      .select(
        `
        *,
        feed_items (
          id,
          name,
          brand,
          unit
        )
      `,
      )
      .eq('farm_id', farmId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data as FeedTransactionRow[]).map((row) => ({
      ...row,
      feed_item: row.feed_items ?? undefined,
    })) as FeedTransaction[]
  })
}

async function getFarmConsumedFeedKg(farmId: string, endDate?: string) {
  const flocks = await listFlocksByFarm(farmId, 'all')
  const flockIds = flocks.map((flock) => flock.id)

  if (!flockIds.length) {
    return 0
  }

  const baselineDate = await getFeedBaselineDate(farmId, endDate)

  if (!baselineDate) {
    return 0
  }

  const cacheKey = `feed-consumed:${farmId}:${endDate ?? 'latest'}`
  const remoteConsumedFeed = await withCache(cacheKey, async () => {
    let query = supabase
      .from('daily_logs')
      .select('flock_id, log_date, feed_used_kg')
      .in('flock_id', flockIds)
      .gte('log_date', baselineDate)

    if (endDate) {
      query = query.lte('log_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return (data as Array<{ flock_id: string; log_date: string; feed_used_kg: number }>).reduce(
      (sum, log) => sum + Number(log.feed_used_kg ?? 0),
      0,
    )
  })

  const pendingConsumedFeed = listPendingDailyLogs()
    .filter((log) => flockIds.includes(log.flock_id))
    .filter((log) => log.log_date >= baselineDate)
    .filter((log) => (endDate ? log.log_date <= endDate : true))
    .reduce((sum, log) => sum + Number(log.feed_used_kg ?? 0), 0)

  return remoteConsumedFeed + pendingConsumedFeed
}

export async function getFeedSummaryByFarm(farmId: string, endDate?: string) {
  const referenceDate = endDate ?? getTodayDate()
  const items = await listFeedItemsByFarm(farmId)
  const normalizedItems = items.map((item) => ({
    ...item,
    normalized_price_per_kg_rp: normalizeFeedItemPrice(
      Number(item.price_per_kg_rp ?? 0),
      Number(item.opening_stock_kg ?? 0),
    ),
  }))
  const pricedItems = normalizedItems.filter((item) => Number(item.normalized_price_per_kg_rp ?? 0) > 0)
  const grossStockKg = items.reduce((sum, item) => sum + Number(item.current_stock_kg ?? 0), 0)
  const consumedFeedKg = await getFarmConsumedFeedKg(farmId, referenceDate)
  const totalStockKg = Math.max(0, grossStockKg - consumedFeedKg)

  const flocks = await listFlocksByFarm(farmId, 'all')
  const flockIds = flocks.map((flock) => flock.id)
  const baselineDate = await getFeedBaselineDate(farmId, referenceDate)
  const usageStartDate =
    baselineDate && baselineDate > isoDateOffset(referenceDate, -6)
      ? baselineDate
      : isoDateOffset(referenceDate, -6)

  let recentUsageLogs: Array<{
    log_date: string
    live_population: number
    feed_used_kg: number
  }> = []

  if (flockIds.length) {
    const remoteRecentUsageLogs = await withCache(
      `feed-usage-summary:${farmId}:${usageStartDate}:${referenceDate}`,
      async () => {
        const { data, error } = await supabase
          .from('daily_logs')
          .select('log_date, live_population, feed_used_kg, flock_id')
          .in('flock_id', flockIds)
          .gte('log_date', usageStartDate)
          .lte('log_date', referenceDate)

        if (error) {
          throw error
        }

        return data as Array<{
          flock_id: string
          log_date: string
          live_population: number
          feed_used_kg: number
        }>
      },
    )

    const pendingRecentUsageLogs = listPendingDailyLogs()
      .filter((log) => flockIds.includes(log.flock_id))
      .filter((log) => log.log_date >= usageStartDate && log.log_date <= referenceDate)
      .map((log) => ({
        log_date: log.log_date,
        live_population: log.live_population,
        feed_used_kg: log.feed_used_kg,
      }))

    recentUsageLogs = [
      ...remoteRecentUsageLogs.map((log) => ({
        log_date: log.log_date,
        live_population: log.live_population,
        feed_used_kg: log.feed_used_kg,
      })),
      ...pendingRecentUsageLogs,
    ]
  }

  const todayUsageLogs = recentUsageLogs.filter((log) => log.log_date === referenceDate)
  const totalUsedTodayKg = todayUsageLogs.reduce((sum, log) => sum + Number(log.feed_used_kg ?? 0), 0)
  const totalTodayPopulation = todayUsageLogs.reduce(
    (sum, log) => sum + Number(log.live_population ?? 0),
    0,
  )
  const averageDailyUsageKg = getAverageDailyUsage(recentUsageLogs)
  const averageFeedPerBirdKg =
    totalTodayPopulation > 0 ? totalUsedTodayKg / totalTodayPopulation : null
  const estimatedStockDays = averageDailyUsageKg > 0 ? totalStockKg / averageDailyUsageKg : null
  const stockStatus = getFeedStockStatus(
    estimatedStockDays,
    totalStockKg,
    items.filter((item) => item.current_stock_kg <= item.reorder_level_kg).length,
  )

  return {
    totalStockKg,
    grossStockKg,
    lowStockCount: items.filter((item) => item.current_stock_kg <= item.reorder_level_kg).length,
    totalItems: items.length,
    averageFeedPricePerKgRp:
      pricedItems.length > 0
        ? pricedItems.reduce((sum, item) => sum + Number(item.normalized_price_per_kg_rp ?? 0), 0) /
          pricedItems.length
        : 0,
    totalUsedTodayKg,
    averageDailyUsageKg,
    averageFeedPerBirdKg,
    estimatedStockDays,
    stockStatus,
  } satisfies FeedSummary
}

export async function listFeedUsageHistoryByFarm(farmId: string, limit = 20) {
  assertSupabaseConfigured()

  const remoteLogs = await withCache(`feed-usage-history:${farmId}:${limit}`, async () => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select(
        `
        id,
        flock_id,
        log_date,
        live_population,
        feed_used_kg,
        sync_status,
        flocks!inner (
          id,
          farm_id,
          code,
          name
        )
      `,
      )
      .eq('flocks.farm_id', farmId)
      .gt('feed_used_kg', 0)
      .order('log_date', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data as FeedUsageRow[]).map((row) => ({
      id: row.id,
      flock_id: row.flock_id,
      flock_code: row.flocks[0]?.code ?? '-',
      flock_name: row.flocks[0]?.name ?? 'Flock',
      log_date: row.log_date,
      live_population: row.live_population,
      feed_used_kg: row.feed_used_kg,
      feed_per_bird_kg: row.live_population > 0 ? row.feed_used_kg / row.live_population : null,
      sync_status: row.sync_status,
    })) satisfies FeedUsageHistoryRow[]
  })

  const flocks = await listFlocksByFarm(farmId, 'all')
  const flockMap = Object.fromEntries(flocks.map((flock) => [flock.id, flock]))
  const pendingLogs = listPendingDailyLogs()
    .filter((log) => log.feed_used_kg > 0)
    .filter((log) => flockMap[log.flock_id]?.farm_id === farmId)
    .map((log) => ({
      id: log.id,
      flock_id: log.flock_id,
      flock_code: flockMap[log.flock_id]?.code ?? '-',
      flock_name: flockMap[log.flock_id]?.name ?? 'Flock',
      log_date: log.log_date,
      live_population: log.live_population,
      feed_used_kg: log.feed_used_kg,
      feed_per_bird_kg: log.live_population > 0 ? log.feed_used_kg / log.live_population : null,
      sync_status: 'pending' as const,
    })) satisfies FeedUsageHistoryRow[]

  return [...pendingLogs, ...remoteLogs]
    .sort((left, right) => right.log_date.localeCompare(left.log_date))
    .slice(0, limit)
}

export async function createFeedItem(input: {
  farmId: string
  name: string
  brand: string
  unit: string
  pricePerKgRp: number
  openingStockKg: number
  reorderLevelKg: number
  notes: string
}) {
  assertSupabaseConfigured()
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sesi pengguna tidak ditemukan')
  }

  const { data, error } = await supabase
    .from('feed_items')
    .insert({
      farm_id: input.farmId,
      name: input.name.trim(),
      brand: input.brand.trim() || null,
      unit: input.unit.trim() || 'kg',
      price_per_kg_rp: input.pricePerKgRp,
      opening_stock_kg: input.openingStockKg,
      current_stock_kg: 0,
      reorder_level_kg: input.reorderLevelKg,
      notes: input.notes.trim() || null,
      created_by: session.user_id,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  if (input.openingStockKg > 0) {
    const { error: stockError } = await supabase.from('feed_transactions').insert({
      feed_item_id: data.id,
      farm_id: input.farmId,
       transaction_type: 'adjustment',
       quantity_kg: input.openingStockKg,
       unit_cost: input.pricePerKgRp,
       transaction_date: new Date().toISOString().slice(0, 10),
       notes: 'Stok awal item pakan',
       created_by: session.user_id,
    })

    if (stockError) {
      throw stockError
    }
  }

  clearCache()
  bumpDataVersion()
  return data as FeedItem
}

export async function createFeedTransaction(input: {
  farmId: string
  feedItemId: string
  transactionType: FeedTransaction['transaction_type']
  quantityKg: number
  unitCost: number | null
  transactionDate: string
  notes: string
}) {
  assertSupabaseConfigured()
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sesi pengguna tidak ditemukan')
  }

  const { data, error } = await supabase
    .from('feed_transactions')
    .insert({
      farm_id: input.farmId,
      feed_item_id: input.feedItemId,
      transaction_type: input.transactionType,
      quantity_kg: input.quantityKg,
      unit_cost: input.unitCost,
      transaction_date: input.transactionDate,
      notes: input.notes.trim() || null,
      created_by: session.user_id,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  if (input.unitCost !== null) {
    const { error: itemError } = await supabase
      .from('feed_items')
      .update({ price_per_kg_rp: input.unitCost })
      .eq('id', input.feedItemId)

    if (itemError) {
      throw itemError
    }
  }

  clearCache()
  bumpDataVersion()
  return data as FeedTransaction
}

export async function getSuggestedFeedPriceByFarm(farmId: string) {
  assertSupabaseConfigured()

  const { data: transactionData, error: transactionError } = await supabase
    .from('feed_transactions')
    .select('unit_cost, quantity_kg')
    .eq('farm_id', farmId)
    .not('unit_cost', 'is', null)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (transactionError) {
    throw transactionError
  }

  const recentTransaction = transactionData?.[0]
  const recentUnitCost = normalizeFeedUnitCost(
    recentTransaction?.unit_cost ?? null,
    Number(recentTransaction?.quantity_kg ?? 0),
  )
  if ((recentUnitCost ?? 0) > 0) {
    return recentUnitCost
  }

  const items = await listFeedItemsByFarm(farmId)
  return Number(
    items
      .map((item) =>
        normalizeFeedItemPrice(
          Number(item.price_per_kg_rp ?? 0),
          Number(item.opening_stock_kg ?? 0),
        ),
      )
      .find((pricePerKg) => pricePerKg > 0) ?? 0,
  )
}
