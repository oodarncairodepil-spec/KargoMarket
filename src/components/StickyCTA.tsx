import type { ReactNode } from 'react'

export function StickyCTA({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
      <div className="pointer-events-auto mx-auto max-w-lg">{children}</div>
    </div>
  )
}
