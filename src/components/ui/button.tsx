import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'danger-soft' | 'link' | 'light' | 'outline-light'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg'

/**
 * Every major button has default, hover (≤2px lift), focus, active (press),
 * loading and disabled states. Radius is controlled, not pill-shaped.
 */
const base =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.005em] ' +
  'transition-[background-color,color,box-shadow,transform,border-color,opacity] duration-200 ease-[var(--ease-standard)] ' +
  'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-45 ' +
  'motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 ' +
  '[&_svg]:size-[1.1em] [&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-ink shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_8px_20px_-10px_rgb(var(--shadow-rgb)/0.6)] hover:bg-primary-hover',
  brand: 'bg-brand text-brand-ink shadow-[0_8px_20px_-10px_rgb(var(--shadow-rgb)/0.55)] hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink hover:translate-y-0',
  soft: 'bg-brand-soft text-brand-text hover:bg-[color-mix(in_oklab,var(--brand-soft)_80%,var(--brand)_20%)]',
  danger: 'bg-[var(--danger-solid)] text-white shadow-soft hover:brightness-110',
  'danger-soft': 'border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-soft text-danger-text hover:brightness-95',
  link: 'h-auto rounded-md px-0 text-primary-text underline-offset-4 hover:translate-y-0 hover:underline active:scale-100',
  light: 'bg-[#fffdf9] text-[#1d1816] shadow-[0_10px_24px_-12px_rgb(0_0_0/0.5)] hover:bg-white',
  'outline-light': 'border border-white/35 text-white hover:border-white/70 hover:bg-white/10',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-[0.625rem] px-3.5 text-sm',
  md: 'h-11 rounded-control px-5 text-[0.95rem]',
  lg: 'h-12 rounded-control px-6 text-base',
  xl: 'h-14 rounded-[0.875rem] px-7 text-[1.05rem]',
  icon: 'size-11 rounded-control',
  'icon-sm': 'size-9 rounded-[0.625rem]',
  'icon-lg': 'size-12 rounded-control',
}

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  loading?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  asChild = false,
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], variant === 'link' ? '' : sizes[size], className)

  if (asChild) {
    // Slottable keeps icons alongside the child's own content (e.g. a router <Link>).
    return (
      <Slot.Root className={classes} {...props}>
        {leadingIcon}
        <Slot.Slottable>{children}</Slot.Slottable>
        {trailingIcon}
      </Slot.Root>
    )
  }

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  )
}
