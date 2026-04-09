const variants: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80',
  success: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80',
  info: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200/80',
  muted: 'bg-slate-50 text-slate-600',
}

export function Badge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: React.ReactNode
  variant?: keyof typeof variants
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
