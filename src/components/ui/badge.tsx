import type { ComponentProps } from 'react'
import { cn } from '@/utils/cn'

export type BadgeTone = 'neutral' | 'brand' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 ring-line',
  brand: 'bg-brand-soft text-brand-text ring-[color-mix(in_oklab,var(--brand)_25%,transparent)]',
  primary: 'bg-primary-soft text-primary-text ring-[color-mix(in_oklab,var(--primary)_25%,transparent)]',
  accent: 'bg-accent-soft text-accent-text ring-[color-mix(in_oklab,var(--accent)_30%,transparent)]',
  success: 'bg-success-soft text-success-text ring-[color-mix(in_oklab,var(--success)_28%,transparent)]',
  warning: 'bg-warning-soft text-warning-text ring-[color-mix(in_oklab,var(--warning)_30%,transparent)]',
  danger: 'bg-danger-soft text-danger-text ring-[color-mix(in_oklab,var(--danger)_28%,transparent)]',
  info: 'bg-info-soft text-info-text ring-[color-mix(in_oklab,var(--info)_28%,transparent)]',
  outline: 'bg-transparent text-ink-2 ring-line-strong',
}

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: BadgeTone
  size?: 'sm' | 'md'
}

export function Badge({ className, tone = 'neutral', size = 'md', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset',
        size === 'sm' ? 'h-6 px-2 text-[0.7rem]' : 'h-7 px-2.5 text-xs',
        '[&_svg]:size-3.5 [&_svg]:shrink-0',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
