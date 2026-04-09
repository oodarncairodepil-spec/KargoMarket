import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuthStore } from '../store/useAuthStore'

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const hydrateMe = useAuthStore((s) => s.hydrateMe)
  const hydrated = useAuthStore((s) => s.hydrated)
  useEffect(() => {
    void hydrateMe()
  }, [hydrateMe])
  if (!hydrated) {
    return <div className="p-6 text-center text-sm text-slate-500">Memuat sesi...</div>
  }
  return <>{children}</>
}
