import type { ReactNode } from 'react'
import { Card } from '../Card'

interface SectionCardProps {
  title?: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

export function SectionCard({ title, description, actions, children, className = '' }: SectionCardProps) {
  return (
    <Card className={className}>
      {(title || description || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Card>
  )
}
