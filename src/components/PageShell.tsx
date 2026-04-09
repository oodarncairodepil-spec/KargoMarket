import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PageShellProps {
  title?: string
  children: ReactNode
  showHomeLink?: boolean
  headerRight?: ReactNode
}

export function PageShell({ title, children, showHomeLink = true, headerRight }: PageShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-32 pt-6">
      <header className="mb-6 flex shrink-0 items-start justify-between gap-3">
        <div>
          {showHomeLink && (
            <Link
              to="/"
              className="text-sm font-medium text-accent hover:underline"
            >
              ← Beranda
            </Link>
          )}
          {title && (
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          )}
        </div>
        {headerRight}
      </header>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
    </div>
  )
}
