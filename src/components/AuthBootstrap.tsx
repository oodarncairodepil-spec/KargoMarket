import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const hydrateMe = useAuthStore((s) => s.hydrateMe)
  const hydrated = useAuthStore((s) => s.hydrated)
  useEffect(() => {
    void hydrateMe()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        useAuthStore.setState({ user: null })
        return
      }
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
