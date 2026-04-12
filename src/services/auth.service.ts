import type { UserSession } from '../types/models'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from '../lib/supabase'

function mapSession(session: Session | null) {
  if (!session?.user.email) {
    return null
  }

  return {
    user_id: session.user.id,
    email: session.user.email,
  } satisfies UserSession
}

export async function signInWithPassword(email: string, password: string) {
  assertSupabaseConfigured()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    throw error
  }

  return {
    session: mapSession(data.session),
  }
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    return
  }

  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured) {
    return null satisfies UserSession | null
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return mapSession(session) satisfies UserSession | null
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: UserSession | null) => void,
) {
  if (!isSupabaseConfigured) {
    return {
      data: {
        subscription: {
          unsubscribe() {
            return
          },
        },
      },
    }
  }

  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, mapSession(session))
  })
}
