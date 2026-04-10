import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { API_BASE_URL } from '../lib/apiClient'

export type AuthRole = 'customer' | 'admin'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: AuthRole
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

async function fetchMe(accessToken: string): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) return null
  const body = (await res.json()) as { user: AuthUser | null }
  return body.user ?? null
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
      const user = await fetchMe(token)
      set({ user, hydrated: true, loading: false, error: '' })
    } catch {
      set({ user: null, hydrated: true, loading: false })
    }
  },
  login: async ({ email, password }) => {
    set({ loading: true, error: '' })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session?.access_token) {
      set({
        user: null,
        loading: false,
        error: error?.message || 'login_failed',
      })
      throw new Error(error?.message || 'login_failed')
    }
    const user = await fetchMe(data.session.access_token)
    if (!user) {
      await supabase.auth.signOut()
      set({
        user: null,
        loading: false,
        error: 'no_profile',
      })
      throw new Error('no_profile')
    }
    set({ user, loading: false, error: '' })
    return user
  },
  logout: async () => {
    set({ loading: true, error: '' })
    try {
      await supabase.auth.signOut()
    } finally {
      set({ user: null, loading: false })
    }
  },
}))
