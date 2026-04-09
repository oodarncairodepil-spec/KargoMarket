import { create } from 'zustand'
import { apiClient } from '../lib/apiClient'

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  loading: false,
  error: '',
  hydrateMe: async () => {
    set({ loading: true, error: '' })
    try {
      const data = (await apiClient.get('/auth/me')) as { user: AuthUser | null }
      set({ user: data.user, hydrated: true, loading: false, error: '' })
    } catch {
      set({ user: null, hydrated: true, loading: false })
    }
  },
  login: async ({ email, password }) => {
    set({ loading: true, error: '' })
    try {
      const data = (await apiClient.post('/auth/login', { email, password })) as { user: AuthUser }
      set({ user: data.user, loading: false, error: '' })
      return data.user
    } catch (err) {
      set({
        user: null,
        loading: false,
        error: err instanceof Error ? err.message : 'login_failed',
      })
      throw err
    }
  },
  logout: async () => {
    set({ loading: true, error: '' })
    try {
      await apiClient.post('/auth/logout')
    } finally {
      set({ user: null, loading: false })
    }
  },
}))
