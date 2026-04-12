import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { Farm, House, Profile } from '../types/models'
import { getCurrentSession } from './auth.service'
import { clearCache, withCache } from './localCache.service'
import { getProfileById } from './profiles.service'

async function getCurrentProfile() {
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sesi pengguna tidak ditemukan')
  }

  return getProfileById(session.user_id)
}

export async function listAccessibleFarms() {
  assertSupabaseConfigured()
  const profile = await getCurrentProfile()

  return withCache(`farms:user:${profile.id}`, async () => {
    const { data, error } = await supabase.from('farms').select('*').order('name')

    if (error) {
      throw error
    }

    return (data as Farm[]).map((farm) => ({
      ...farm,
      membershipRole: profile.role,
    }))
  })
}

export async function getFarmById(farmId: string) {
  const farms = await listAccessibleFarms()
  const farm = farms.find((item) => item.id === farmId)
  if (!farm) {
    throw new Error('Farm tidak ditemukan')
  }

  return farm
}

export async function listHousesByFarm(farmId: string) {
  assertSupabaseConfigured()

  return withCache(`houses:${farmId}`, async () => {
    const { data, error } = await supabase
      .from('houses')
      .select('*')
      .eq('farm_id', farmId)
      .order('name')

    if (error) {
      throw error
    }

    return data as House[]
  })
}

export async function createFarm(input: {
  name: string
  location: string
  managerName: string
}) {
  assertSupabaseConfigured()
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sesi pengguna tidak ditemukan')
  }

  const profile = (await getProfileById(session.user_id)) as Profile
  const { data, error } = await supabase
    .from('farms')
    .insert({
      name: input.name.trim(),
      location: input.location.trim(),
      manager_name: input.managerName.trim() || null,
      created_by: session.user_id,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const farm = data as Farm

  const { error: membershipError } = await supabase.from('farm_memberships').insert({
    farm_id: farm.id,
    user_id: session.user_id,
    role: profile.role,
  })

  if (membershipError) {
    throw membershipError
  }

  clearCache()

  return {
    ...farm,
    membershipRole: profile.role,
  } satisfies Farm
}

export async function createHouse(input: {
  farmId: string
  name: string
  capacity: number
}) {
  assertSupabaseConfigured()

  const { data, error } = await supabase
    .from('houses')
    .insert({
      farm_id: input.farmId,
      name: input.name.trim(),
      capacity: input.capacity,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  clearCache()
  return data as House
}
