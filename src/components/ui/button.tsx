import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'danger-soft' | 'link' | 'light'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg'

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ' +
  'transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-out ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:size-[1.1em] [&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-ink shadow-soft hover:bg-primary-hover',
  brand: 'bg-brand text-brand-ink shadow-soft hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  soft: 'bg-brand-soft text-brand-text hover:bg-[color-mix(in_oklab,var(--brand-soft)_80%,var(--brand)_20%)]',
  danger: 'bg-[var(--danger-solid)] text-white shadow-soft hover:brightness-110',
  'danger-soft': 'border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-soft text-danger-text hover:brightness-95',
  link: 'h-auto rounded-md px-0 text-primary-text underline-offset-4 hover:underline active:scale-100',
  light: 'bg-white text-[#1d1816] shadow-soft hover:bg-[#f6efe8]',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-8 text-[1.05rem]',
  icon: 'size-11',
  'icon-sm': 'size-9',
  'icon-lg': 'size-12',
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
    return (
      <Slot.Root className={classes} {...props}>
        {children}
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
