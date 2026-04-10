import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const hydrateMe = useAuthStore((s) => s.hydrateMe)
  const hydrated = useAuthStore((s) => s.hydrated)
  useEffect(() => {
    void hydrateMe()
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (!session) {
        useAuthStore.setState({ user: null })
        return
      }
      const current = useAuthStore.getState().user
      if (current?.id === session.user.id) return
      void hydrateMe()
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [hydrateMe])
  if (!hydrated) {
    return <div className="p-6 text-center text-sm text-slate-500">Memuat sesi...</div>
  }
  return <>{children}</>
}
