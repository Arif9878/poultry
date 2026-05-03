import { bumpDataVersion } from '../lib/appState'
import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { HealthTreatmentLog } from '../types/models'
import { getCurrentSession } from './auth.service'
import { clearCache, withCache } from './localCache.service'

interface HealthTreatmentRow extends Omit<HealthTreatmentLog, 'flock'> {
  flocks:
    | (Pick<NonNullable<HealthTreatmentLog['flock']>, 'id' | 'farm_id' | 'code' | 'name' | 'flock_type'> & {
        houses: { name: string | null } | null
      })
    | null
}

function mapTreatment(row: HealthTreatmentRow) {
  return {
    ...row,
    flock: row.flocks
      ? {
          id: row.flocks.id,
          farm_id: row.flocks.farm_id,
          code: row.flocks.code,
          name: row.flocks.name,
          flock_type: row.flocks.flock_type,
          house_name: row.flocks.houses?.name ?? null,
        }
      : undefined,
  } satisfies HealthTreatmentLog
}

export async function listHealthTreatmentsByFlock(flockId: string, limit = 20) {
  assertSupabaseConfigured()

  return withCache(`health-treatments:flock:${flockId}:${limit}`, async () => {
    const { data, error } = await supabase
      .from('health_treatment_logs')
      .select(
        `
        *,
        flocks (
          id,
          farm_id,
          code,
          name,
          flock_type,
          houses (name)
        )
      `,
      )
      .eq('flock_id', flockId)
      .order('treatment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data as HealthTreatmentRow[]).map(mapTreatment)
  })
}

export async function listHealthTreatmentsByFarm(farmId: string, limit = 30) {
  assertSupabaseConfigured()

  return withCache(`health-treatments:farm:${farmId}:${limit}`, async () => {
    const { data, error } = await supabase
      .from('health_treatment_logs')
      .select(
        `
        *,
        flocks!inner (
          id,
          farm_id,
          code,
          name,
          flock_type,
          houses (name)
        )
      `,
      )
      .eq('flocks.farm_id', farmId)
      .order('treatment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data as HealthTreatmentRow[]).map(mapTreatment)
  })
}

export async function createHealthTreatment(input: {
  flockId: string
  treatmentDate: string
  category: HealthTreatmentLog['category']
  productName: string
  dosage: string
  administeredBy: string
  symptoms: string
  diagnosis: string
  withdrawalUntil: string
  notes: string
}) {
  assertSupabaseConfigured()
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sesi pengguna tidak ditemukan')
  }

  const { data, error } = await supabase
    .from('health_treatment_logs')
    .insert({
      flock_id: input.flockId,
      treatment_date: input.treatmentDate,
      category: input.category,
      product_name: input.productName.trim(),
      dosage: input.dosage.trim() || null,
      administered_by: input.administeredBy.trim() || null,
      symptoms: input.symptoms.trim() || null,
      diagnosis: input.diagnosis.trim() || null,
      withdrawal_until: input.withdrawalUntil || null,
      notes: input.notes.trim() || null,
      created_by: session.user_id,
    })
    .select(
      `
      *,
      flocks (
        id,
        farm_id,
        code,
        name,
        flock_type,
        houses (name)
      )
    `,
    )
    .single()

  if (error) {
    throw error
  }

  clearCache()
  bumpDataVersion()
  return mapTreatment(data as HealthTreatmentRow)
}
