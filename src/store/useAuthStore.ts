import { create } from 'zustand'
import { clearApiAuthHeaderCache, API_BASE_URL } from '../lib/apiClient'
import { supabase } from '../lib/supabase'

export type AuthRole = 'customer' | 'admin'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: AuthRole
}

type MeResponse = {
  user: AuthUser | null
  authError?: string | null
}

async function fetchMe(accessToken: string): Promise<MeResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    let body: MeResponse = { user: null, authError: null }
    try {
      body = (await res.json()) as MeResponse
    } catch {
      return { user: null, authError: 'bad_response' }
    }
    if (!res.ok) {
      return { user: null, authError: body.authError || `http_${res.status}` }
    }
    return body
  } catch {
    return { user: null, authError: 'api_unreachable' }
  }
}

interface AuthState {
  user: AuthUser | null
  hydrated: boolean
  loading: boolean
  error: string
  hydrateMe: () => Promise<void>
  login: (payload: { email: string; password: string }) => Promise<AuthUser>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  loading: false,
  error: '',
  hydrateMe: async () => {
    set({ loading: true, error: '' })
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        set({ user: null, hydrated: true, loading: false })
        return
      }
      const { user } = await fetchMe(token)
      set({ user, hydrated: true, loading: false, error: '' })
    } catch {
      set({ user: null, hydrated: true, loading: false })
    }
  },
  login: async ({ email, password }) => {
    set({ loading: true, error: '' })
    clearApiAuthHeaderCache()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session?.access_token) {
      set({
        user: null,
        loading: false,
        error: 'login_failed',
      })
      throw new Error(error?.message || 'login_failed')
    }
    const { user, authError } = await fetchMe(data.session.access_token)
    if (!user) {
      await supabase.auth.signOut()
      const code = authError || 'session_invalid'
      set({
        user: null,
        loading: false,
        error: code,
      })
      throw new Error(code)
    }
    set({ user, loading: false, error: '' })
    return user
  },
  logout: async () => {
    set({ loading: true, error: '' })
    try {
      await supabase.auth.signOut()
    } finally {
      clearApiAuthHeaderCache()
      set({ user: null, loading: false })
    }
  },
}))
