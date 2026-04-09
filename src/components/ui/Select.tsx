import type { SelectHTMLAttributes } from 'react'
import { cn, ui } from '../../lib/uiTokens'

type Density = 'comfy' | 'compact'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  density?: Density
}

export function Select({ className, density = 'comfy', ...props }: SelectProps) {
  return <select className={cn(ui.form.input[density], className)} {...props} />
}
