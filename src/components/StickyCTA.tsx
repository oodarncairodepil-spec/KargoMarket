import type { ReactNode } from 'react'
import { cn } from '../lib/uiTokens'

/** Tinggi bar navigasi bawah (BottomNav) — harus selaras dengan `h-16` di BottomNav. */
const BOTTOM_NAV_OFFSET = 'bottom-16'

type StickyCTAProps = {
  children: ReactNode
  /** Set true di layout yang punya BottomNav tetap (customer/admin), agar CTA tidak tertutup nav. */
  aboveBottomNav?: boolean
}

export function StickyCTA({ children, aboveBottomNav }: StickyCTAProps) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[60] bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10',
        aboveBottomNav ? BOTTOM_NAV_OFFSET : 'bottom-0',
      )}
    >
      <div className="pointer-events-auto mx-auto max-w-lg">{children}</div>
    </div>
  )
}
