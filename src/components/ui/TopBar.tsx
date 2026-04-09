import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface TopBarProps {
  title: string
  backTo?: string
  backLabel?: string
  rightSlot?: ReactNode
}

export function TopBar({ title, backTo, backLabel = 'Kembali', rightSlot }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 -mx-4 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {backTo && (
            <Link
              to={backTo}
              aria-label={backLabel}
              title={backLabel}
              className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          )}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        </div>
        {rightSlot}
      </div>
    </header>
  )
}
