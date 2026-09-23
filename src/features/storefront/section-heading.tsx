import type { ReactNode } from 'react'
import { DoodleArrow } from '@/components/brand/brand-marks'
import { cn } from '@/utils/cn'

/**
 * Big punctuated headline ("Our brands.") with an optional hand-drawn arrow,
 * the signature section opener borrowed from the Pizzaman Chickenman site.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent = '.',
  description,
  align = 'left',
  doodle = false,
  className,
  as: Tag = 'h2',
  id,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  accent?: string
  description?: ReactNode
  align?: 'left' | 'center'
  doodle?: boolean
  className?: string
  as?: 'h1' | 'h2'
  id?: string
}) {
  return (
    <div className={cn('relative max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <p className="eyebrow mb-4 text-brand-text">{eyebrow}</p>}
      <Tag id={id} className="display-lg text-ink">
        {title}
        {accent && <span className="text-brand">{accent}</span>}
      </Tag>
      {description && <p className={cn('mt-5 text-lg leading-relaxed text-ink-2', align === 'center' && 'mx-auto max-w-2xl')}>{description}</p>}
      {doodle && (
        <DoodleArrow
          className={cn('absolute hidden h-24 w-32 lg:block', align === 'center' ? '-top-10 -right-36' : '-top-6 -right-40')}
        />
      )}
    </div>
  )
}
