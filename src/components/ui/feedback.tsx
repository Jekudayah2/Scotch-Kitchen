import { AlertTriangle, Info, LoaderCircle, RotateCw, type LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { friendlyError } from '@/utils/errors'
import { Button } from './button'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center text-ink-3', className)}>
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl bg-[color-mix(in_oklab,var(--surface-3)_75%,transparent)]', className)}
      {...props}
    />
  )
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-ink-3">
        <LoaderCircle className="size-7 animate-spin text-primary-text" aria-hidden="true" />
        <p className="text-sm font-medium">{label}…</p>
      </div>
    </div>
  )
}

interface StateProps {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({ icon: Icon = Info, title, description, action, className, compact }: StateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-3 ring-1 ring-line">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-base font-bold text-ink">{title}</p>
        {description && <p className="text-sm text-ink-3">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

interface ErrorStateProps extends Omit<StateProps, 'title'> {
  title?: ReactNode
  error?: unknown
  onRetry?: () => void
  retrying?: boolean
}

export function ErrorState({ title = 'We couldn’t load this', error, description, onRetry, retrying, className, compact }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger-text">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-base font-bold text-ink">{title}</p>
        <p className="text-sm text-ink-3">{description ?? friendlyError(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying} leadingIcon={<RotateCw aria-hidden="true" />}>
          Try again
        </Button>
      )}
    </div>
  )
}

type NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'neutral'
const noticeTones: Record<NoticeTone, string> = {
  info: 'bg-info-soft text-info-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  success: 'bg-success-soft text-success-text',
  neutral: 'bg-surface-2 text-ink-2',
}

export function Notice({
  tone = 'info',
  icon: Icon = tone === 'warning' || tone === 'danger' ? AlertTriangle : Info,
  title,
  children,
  className,
}: {
  tone?: NoticeTone
  icon?: LucideIcon
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex gap-3 rounded-2xl px-4 py-3 text-sm', noticeTones[tone], className)}>
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-95">{children}</div>}
      </div>
    </div>
  )
}
