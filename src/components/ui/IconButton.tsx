import type { ButtonHTMLAttributes } from 'react'
import { cn, ui } from '../../lib/uiTokens'

type IconVariant = 'primary' | 'secondary' | 'ghost'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconVariant
}

export function IconButton({ className, variant = 'primary', ...props }: IconButtonProps) {
  return (
    <button
      className={cn(ui.button.base, ui.button.size.icon, ui.button.variant[variant], className)}
      {...props}
    />
  )
}
