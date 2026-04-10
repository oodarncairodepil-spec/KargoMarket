import type { SelectHTMLAttributes } from 'react'
import { cn, ui } from '../../lib/uiTokens'

type Density = 'comfy' | 'compact'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  density?: Density
}

export function Select({ className, density = 'comfy', ...props }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(ui.form.input[density], 'appearance-none pr-9', className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400" aria-hidden>
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
          <path d="m5 7 5 6 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  )
}
