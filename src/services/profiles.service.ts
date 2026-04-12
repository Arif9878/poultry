import type { Profile } from '../types/models'
import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import { withCache } from './localCache.service'

export async function getProfileById(userId: string) {
  assertSupabaseConfigured()

  return withCache(`profile:${userId}`, async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      throw error
    }

    return data as Profile
  })
}
