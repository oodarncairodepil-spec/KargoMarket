import type { InputHTMLAttributes } from 'react'
import { cn, ui } from '../../lib/uiTokens'

type Density = 'comfy' | 'compact'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  density?: Density
}

export function Input({ className, density = 'comfy', ...props }: InputProps) {
  return <input className={cn(ui.form.input[density], className)} {...props} />
}
