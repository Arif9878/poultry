import { computed, reactive, toRefs } from 'vue'
import { getProfileById } from '../services/profiles.service'
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithPassword,
  signOut,
} from '../services/auth.service'
import type { Profile, UserSession } from '../types/models'

const state = reactive({
  session: null as Awaited<ReturnType<typeof getCurrentSession>>,
  user: null as { id: string; email: string } | null,
  profile: null as Profile | null,
  loading: false,
  initialized: false,
  error: '',
})

let authListenerRegistered = false

async function loadProfile(userId: string) {
  try {
    state.profile = await getProfileById(userId)
  } catch (error) {
    console.error(error)
    state.profile = null
  }
}

async function applySession(session: UserSession | null) {
  state.session = session
  state.user = session
    ? {
        id: session.user_id,
        email: session.email,
      }
    : null

  if (state.user) {
    await loadProfile(state.user.id)
  } else {
    state.profile = null
  }
}

export function useAuth() {
  async function initialize() {
    if (state.initialized) {
      return
    }

    state.loading = true
    state.error = ''

    try {
      const session = await getCurrentSession()
      await applySession(session)

      if (!authListenerRegistered) {
        onAuthStateChange((_event, nextSession) => {
          void applySession(nextSession)
        })
        authListenerRegistered = true
      }
    } catch (error) {
      console.error(error)
      state.error = 'Gagal memuat sesi pengguna'
    } finally {
      state.loading = false
      state.initialized = true
    }
  }

  async function signIn(email: string, password: string) {
    state.loading = true
    state.error = ''

    try {
      const { session } = await signInWithPassword(email, password)
      await applySession(session)
      return true
    } catch (error) {
      console.error(error)
      state.error =
        error instanceof Error ? error.message : 'Email atau password tidak valid'
      return false
    } finally {
      state.loading = false
    }
  }

  async function logout() {
    state.loading = true

    try {
      await signOut()
      await applySession(null)
    } finally {
      state.loading = false
    }
  }

  return {
    ...toRefs(state),
    initialize,
    signIn,
    logout,
    isAuthenticated: computed(() => Boolean(state.session)),
  }
}
