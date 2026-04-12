import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { FeedItem, FeedSummary, FeedTransaction } from '../types/models'
import { bumpDataVersion } from '../lib/appState'
import { getCurrentSession } from './auth.service'
import { clearCache, withCache } from './localCache.service'

interface FeedTransactionRow extends Omit<FeedTransaction, 'feed_item'> {
  feed_items: Pick<FeedItem, 'id' | 'name' | 'brand' | 'unit'> | null
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

export async function getFeedSummaryByFarm(farmId: string) {
  const items = await listFeedItemsByFarm(farmId)
  const pricedItems = items.filter((item) => Number(item.price_per_kg_rp ?? 0) > 0)

  return {
    totalStockKg: items.reduce((sum, item) => sum + Number(item.current_stock_kg ?? 0), 0),
    lowStockCount: items.filter((item) => item.current_stock_kg <= item.reorder_level_kg).length,
    totalItems: items.length,
    averageFeedPricePerKgRp:
      pricedItems.length > 0
        ? pricedItems.reduce((sum, item) => sum + Number(item.price_per_kg_rp ?? 0), 0) /
          pricedItems.length
        : 0,
  } satisfies FeedSummary
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
    .select('unit_cost')
    .eq('farm_id', farmId)
    .not('unit_cost', 'is', null)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (transactionError) {
    throw transactionError
  }

  const recentUnitCost = Number(transactionData?.[0]?.unit_cost ?? 0)
  if (recentUnitCost > 0) {
    return recentUnitCost
  }

  const items = await listFeedItemsByFarm(farmId)
  return Number(items.find((item) => Number(item.price_per_kg_rp ?? 0) > 0)?.price_per_kg_rp ?? 0)
}
