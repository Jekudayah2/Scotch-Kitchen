import { CupSoda, IceCreamCone, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/utils/cn'

/** SCOTCH's Kitchen monogram: a wine tile with a serif "S" and a spice-seed dot. */
export function KitchenMonogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-10', className)} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="14" fill="var(--primary)" />
      <text
        x="24"
        y="34.5"
        textAnchor="middle"
        fontFamily="Instrument Serif, Georgia, serif"
        fontStyle="italic"
        fontSize="32"
        fill="var(--primary-ink)"
      >
        S
      </text>
      <circle cx="36.5" cy="12" r="3.2" fill="var(--accent)" />
    </svg>
  )
}

/** Parent-brand lockup. The product brands sit underneath this, never beside it. */
export function KitchenLogo({ className, compact = false, tone = 'default' }: { className?: string; compact?: boolean; tone?: 'default' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <KitchenMonogram className={compact ? 'size-9' : 'size-10'} />
      <span className={cn('flex flex-col leading-none', tone === 'light' ? 'text-white' : 'text-ink')}>
        <span className="font-display text-[1.15rem] font-extrabold tracking-[-0.03em]">
          SCOTCH<span className="text-accent">’</span>s
        </span>
        {!compact && (
          <span className={cn('font-serif text-[1.05rem] italic', tone === 'light' ? 'text-white/80' : 'text-ink-2')}>Kitchen</span>
        )}
      </span>
      {compact && <span className="sr-only">Kitchen</span>}
    </span>
  )
}

type WordmarkSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'
const wordmarkSizes: Record<WordmarkSize, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-5xl sm:text-6xl',
  hero: 'text-[clamp(3.25rem,2rem+7vw,8rem)]',
}

export function ZobopopWordmark({ size = 'md', className, tone = 'brand' }: { size?: WordmarkSize; className?: string; tone?: 'brand' | 'light' }) {
  return (
    <span
      className={cn(
        'font-display font-extrabold uppercase leading-none tracking-[-0.035em]',
        tone === 'light' ? 'text-white' : 'text-zp-hibiscus',
        wordmarkSizes[size],
        className,
      )}
    >
      ZOBO<span className={tone === 'light' ? 'text-[#f4c9a8]' : 'text-ink'}>POP</span>
    </span>
  )
}

export function CreamypopWordmark({ size = 'md', className }: { size?: WordmarkSize; className?: string }) {
  return (
    <span className={cn('font-display font-extrabold leading-none tracking-[-0.035em]', wordmarkSizes[size], className)}>
      <span className="text-cp-cocoa">Creamy</span>
      <span className="text-cp-strawberry">pop</span>
    </span>
  )
}

/** Renders the official uploaded logo when present, otherwise the typographic wordmark. */
export function BrandWordmark({
  slug,
  name,
  logoUrl,
  size = 'md',
  className,
}: {
  slug: string
  name: string
  logoUrl?: string | null
  size?: WordmarkSize
  className?: string
}) {
  if (logoUrl) {
    const heights: Record<WordmarkSize, string> = { sm: 'h-6', md: 'h-8', lg: 'h-12', xl: 'h-16', hero: 'h-24' }
    return <img src={logoUrl} alt={name} className={cn('w-auto object-contain', heights[size], className)} />
  }
  if (slug === 'zobopop') return <ZobopopWordmark size={size} className={className} />
  if (slug === 'creamypop') return <CreamypopWordmark size={size} className={className} />
  return (
    <span className={cn('font-display font-extrabold leading-none tracking-[-0.03em] text-brand-text', wordmarkSizes[size], className)}>
      {name}
    </span>
  )
}

const brandIcons: Record<string, LucideIcon> = {
  zobopop: CupSoda,
  creamypop: IceCreamCone,
}

/** The tilted icon tile that anchors each brand's menu column. */
export function BrandTile({ slug, className, size = 'md' }: { slug: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = brandIcons[slug] ?? UtensilsCrossed
  const sizes = { sm: 'size-12 rounded-2xl [&_svg]:size-6', md: 'size-20 rounded-3xl [&_svg]:size-9', lg: 'size-24 rounded-[1.75rem] [&_svg]:size-11' }
  return (
    <span
      data-brand={slug}
      className={cn('grid -rotate-6 place-items-center bg-brand text-brand-ink shadow-lift', sizes[size], className)}
      aria-hidden="true"
    >
      <Icon strokeWidth={1.75} />
    </span>
  )
}

/** Giant outlined wordmark used as a background texture. Purely decorative. */
export function Watermark({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={cn('watermark absolute select-none', className)} style={style}>
      {text}
    </span>
  )
}

/** Hand-drawn dashed arrow that links sections. Purely decorative. */
export function DoodleArrow({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      className={cn('pointer-events-none text-line-strong', flip && '-scale-x-100', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M150 8c-6 34-30 44-52 40-26-5-18-30 0-26 22 5 8 52-34 64-17 5-33 4-50-2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="6 8"
      />
      <path d="M22 76 12 85l13 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
