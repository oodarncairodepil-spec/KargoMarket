export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const ui = {
  color: {
    primary: 'bg-accent text-white',
    secondary: 'border border-slate-200 bg-white text-slate-900',
    ghost: 'bg-slate-100 text-slate-700',
    dangerGhost: 'bg-rose-50 text-rose-700',
    textMuted: 'text-slate-500',
    surface: 'bg-white',
  },
  radius: {
    card: 'rounded-2xl',
    control: 'rounded-xl',
    compact: 'rounded-lg',
    pill: 'rounded-full',
  },
  shadow: {
    card: 'shadow-[var(--shadow-card)]',
    sm: 'shadow-sm',
    md: 'shadow-md',
  },
  space: {
    container: 'px-4 pt-6 pb-28',
    sectionGap: 'gap-4',
    cardPad: 'p-4',
  },
  form: {
    input: {
      comfy:
        'w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent',
      compact:
        'w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent',
    },
    textarea: {
      comfy: 'min-h-24 resize-none',
      compact: 'min-h-16 resize-none',
    },
  },
  button: {
    base:
      'inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    size: {
      sm: 'min-h-10 rounded-lg px-3 text-sm',
      md: 'min-h-11 rounded-xl px-3 text-sm',
      lg: 'min-h-11 rounded-xl px-4 text-base',
      icon: 'h-10 w-10 rounded-full',
    },
    variant: {
      primary: 'bg-accent text-white shadow-md',
      secondary: 'border border-slate-200 bg-white text-slate-900 shadow-sm',
      ghost: 'bg-slate-100 text-slate-700',
      dangerGhost: 'bg-rose-50 text-rose-700',
      neutralDark: 'bg-slate-900 text-white shadow-md',
    },
  },
} as const
