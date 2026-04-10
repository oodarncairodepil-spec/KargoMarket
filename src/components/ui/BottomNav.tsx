import type { ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/uiTokens'

export interface BottomNavItem {
  to: string
  label: string
  match: (path: string) => boolean
  icon: ComponentType<{ className?: string }>
}

interface BottomNavProps {
  items: BottomNavItem[]
}

export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function VendorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 8h11v7H3V8Zm11 2h3l3 3v2h-6v-5ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 15h2m8 0h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function InquiryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 7h8M8 12h8M8 17h5M6 3h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.95 8.95 0 0 0 4.95-1.49A3.99 3.99 0 0 0 13 16h-2a3.99 3.99 0 0 0-3.95 3.51A8.95 8.95 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BottomNav({ items }: BottomNavProps) {
  const location = useLocation()
  const path = location.pathname
  const colsClass =
    items.length <= 1
      ? 'grid-cols-1'
      : items.length === 2
        ? 'grid-cols-2'
        : items.length === 3
          ? 'grid-cols-3'
          : items.length === 4
            ? 'grid-cols-4'
            : 'grid-cols-5'

  return (
    <nav className="fixed bottom-0 left-0 z-50 h-16 w-full border-t border-slate-200 bg-white/95 backdrop-blur" aria-label="Bottom navigation">
      <div className={cn('mx-auto grid h-full w-full max-w-lg font-medium', colsClass)}>
        {items.map((item) => {
          const active = item.match(path)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'inline-flex h-full flex-col items-center justify-center px-2 transition-colors',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="text-[11px] font-semibold leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
