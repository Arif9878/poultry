import { bumpDataVersion } from '../lib/appState'
import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { FlockTransfer } from '../types/models'
import { clearCache, withCache } from './localCache.service'

interface TransferFlockRow {
  id: string
  code: string
  name: string
  current_chicken_count: number
  houses: { name: string | null } | null
}

interface FlockTransferRow extends Omit<FlockTransfer, 'from_flock' | 'to_flock'> {
  from_flock: TransferFlockRow | null
  to_flock: TransferFlockRow | null
}

function mapTransfer(row: FlockTransferRow) {
  return {
    ...row,
    from_flock: row.from_flock
      ? {
          id: row.from_flock.id,
          code: row.from_flock.code,
          name: row.from_flock.name,
          current_chicken_count: row.from_flock.current_chicken_count,
          house_name: row.from_flock.houses?.name ?? null,
        }
      : undefined,
    to_flock: row.to_flock
      ? {
          id: row.to_flock.id,
          code: row.to_flock.code,
          name: row.to_flock.name,
          current_chicken_count: row.to_flock.current_chicken_count,
          house_name: row.to_flock.houses?.name ?? null,
        }
      : undefined,
  } satisfies FlockTransfer
}

export async function listFlockTransfersByFarm(farmId: string, limit = 30) {
  assertSupabaseConfigured()

  return withCache(`flock-transfers:${farmId}:${limit}`, async () => {
    const { data, error } = await supabase
      .from('flock_transfers')
      .select(
        `
        *,
        from_flock:flocks!flock_transfers_from_flock_id_fkey (
          id,
          code,
          name,
          current_chicken_count,
          houses (name)
        ),
        to_flock:flocks!flock_transfers_to_flock_id_fkey (
          id,
          code,
          name,
          current_chicken_count,
          houses (name)
        )
      `,
      )
      .eq('farm_id', farmId)
      .order('transfer_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data as FlockTransferRow[]).map(mapTransfer)
  })
}

export async function createFlockTransfer(input: {
  fromFlockId: string
  toFlockId: string
  transferDate: string
  chickenCount: number
  notes: string
  farmId: string
}) {
  assertSupabaseConfigured()

  const { data, error } = await supabase.rpc('create_flock_transfer', {
    p_from_flock_id: input.fromFlockId,
    p_to_flock_id: input.toFlockId,
    p_transfer_date: input.transferDate,
    p_chicken_count: input.chickenCount,
    p_notes: input.notes.trim() || null,
  })

  if (error) {
    throw error
  }

  clearCache()
  bumpDataVersion()
  const transfers = await listFlockTransfersByFarm(input.farmId, 50)
  const createdTransfer = transfers.find((transfer) => transfer.id === data)

  if (!createdTransfer) {
    throw new Error('Mutasi berhasil disimpan, tetapi data terbaru belum tersedia')
  }

  return createdTransfer
}
