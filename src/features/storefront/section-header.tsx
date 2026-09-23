import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Eyebrow, heading and supporting line for a storefront section. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  as: Heading = 'h2',
  align = 'start',
  className,
}: {
  id?: string
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  as?: 'h1' | 'h2'
  align?: 'start' | 'center'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6',
        align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className="eyebrow text-primary-text">{eyebrow}</p>}
        <Heading id={id} className={cn('display-lg text-ink', eyebrow && 'mt-3')}>
          {title}
        </Heading>
        {description && <p className="mt-4 text-lg leading-relaxed text-ink-2">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
