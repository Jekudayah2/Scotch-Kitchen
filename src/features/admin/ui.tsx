import { Search, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/field'
import { cn } from '@/utils/cn'

export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  to,
  loading,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'info' | 'accent'
  to?: string
  loading?: boolean
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    primary: 'bg-primary-soft text-primary-text',
    success: 'bg-success-soft text-success-text',
    warning: 'bg-warning-soft text-warning-text',
    info: 'bg-info-soft text-info-text',
    accent: 'bg-accent-soft text-accent-text',
  }
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink-3">{label}</p>
        {Icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-[0.7rem]', tones[tone])}>
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? <Skeleton className="mt-2 h-9 w-24" /> : <p className="tabular mt-1 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink">{value}</p>}
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </>
  )
  const className = 'block rounded-card border border-line bg-surface p-4 sm:p-5'
  return to ? (
    <Link
      to={to}
      className={cn(className, 'transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:hover:translate-y-0')}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function SearchField({ value, onChange, label, placeholder, className }: { value: string; onChange: (value: string) => void; label: string; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <Input type="search" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? label} className="h-11 pl-9" />
    </div>
  )
}

/** Horizontal filter chips (scrolls on phones). */
export function FilterChips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: Array<{ id: T; label: string; count?: number }>; label: string }) {
  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label={label}>
      <div className="flex w-max gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              value === o.id ? 'bg-ink text-canvas' : 'bg-surface text-ink-2 ring-1 ring-line hover:text-ink hover:ring-line-strong',
            )}
          >
            {o.label}
            {o.count !== undefined && o.count > 0 && <span className={cn('tabular text-xs font-bold', value === o.id ? 'text-canvas/75' : 'text-ink-3')}>{o.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  /** Phones show rows as cards: `primary` is the card title, `meta` lines follow, `hidden` is skipped. */
  mobile?: 'primary' | 'meta' | 'end' | 'hidden'
  align?: 'left' | 'right'
}

/**
 * Operations table: sticky header and full-row click on desktop, readable cards
 * on phones. Loading shows skeleton rows, never a spinner.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowLabel,
  loading,
  error,
  onRetry,
  empty,
}: {
  rows: T[] | undefined
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  empty: { icon: LucideIcon; title: string; description?: string }
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} className="rounded-card border border-line bg-surface" />
  if (loading || !rows) {
    return (
      <div className="space-y-2 rounded-card border border-line bg-surface p-4" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-[0.7rem]" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
      </div>
    )
  }

  const primary = columns.find((c) => c.mobile === 'primary') ?? columns[0]
  const end = columns.find((c) => c.mobile === 'end')
  const meta = columns.filter((c) => c.mobile === 'meta')

  return (
    <>
      {/* Phones */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-semibold text-ink">{primary?.cell(row)}</div>
                {end && <div className="shrink-0 text-right">{end.cell(row)}</div>}
              </div>
              {meta.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-2">
                  {meta.map((c) => (
                    <span key={c.id} className="min-w-0">
                      {c.cell(row)}
                    </span>
                  ))}
                </div>
              )}
            </>
          )
          return (
            <li key={rowKey(row)}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  aria-label={rowLabel?.(row)}
                  className="block w-full rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {content}
                </button>
              ) : (
                <div className="rounded-card border border-line bg-surface p-4">{content}</div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Tablets and up */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className={cn('border-b border-line px-4 py-3 text-xs font-bold tracking-wide text-ink-3 uppercase', c.align === 'right' ? 'text-right' : 'text-left', c.className)}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('border-b border-line last:border-b-0', onRowClick && 'cursor-pointer transition-colors hover:bg-surface-2/70')}
                >
                  {columns.map((c, i) => (
                    <td key={c.id} className={cn('px-4 py-3 align-middle text-ink-2', c.align === 'right' && 'text-right', c.className)}>
                      {i === 0 && onRowClick ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRowClick(row)
                          }}
                          aria-label={rowLabel?.(row)}
                          className="rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {c.cell(row)}
                        </button>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
