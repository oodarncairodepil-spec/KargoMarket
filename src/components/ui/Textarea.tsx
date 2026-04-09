import type { TextareaHTMLAttributes } from 'react'
import { cn, ui } from '../../lib/uiTokens'

type Density = 'comfy' | 'compact'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  density?: Density
}

export function Textarea({ className, density = 'comfy', ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        ui.form.input[density],
        density === 'comfy' ? ui.form.textarea.comfy : ui.form.textarea.compact,
        className,
      )}
      {...props}
    />
  )
}
