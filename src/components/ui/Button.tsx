import type { ButtonHTMLAttributes } from 'react'
import { cn, ui } from '../../lib/uiTokens'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dangerGhost' | 'neutralDark'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        ui.button.base,
        ui.button.size[size],
        ui.button.variant[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
