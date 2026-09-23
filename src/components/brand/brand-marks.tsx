import { cn } from '@/utils/cn'

type WordmarkSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'
const wordmarkSizes: Record<WordmarkSize, string> = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
  xl: 'text-6xl sm:text-7xl',
  hero: 'text-[clamp(4rem,1.5rem+11vw,13rem)]',
}

/** ZOBOPOP set in the campaign voice (condensed capitals), one colour like the label. */
export function ZobopopWordmark({ size = 'md', className, tone = 'brand' }: { size?: WordmarkSize; className?: string; tone?: 'brand' | 'light' }) {
  return (
    <span
      className={cn(
        'font-display font-extrabold leading-[0.82] tracking-[-0.01em] uppercase [font-stretch:75%]',
        tone === 'light' ? 'text-[#fff5ee]' : 'text-zp-hibiscus',
        wordmarkSizes[size],
        className,
      )}
    >
      Zobopop
    </span>
  )
}

/** Creamypop keeps its two-tone label colours: cocoa "Creamy", strawberry "pop". */
export function CreamypopWordmark({ size = 'md', className }: { size?: WordmarkSize; className?: string }) {
  return (
    <span className={cn('font-display font-extrabold leading-[0.9] tracking-[-0.035em]', wordmarkSizes[size], className)}>
      <span className="text-cp-cocoa">Creamy</span>
      <span className="text-cp-strawberry">pop</span>
    </span>
  )
}

/** Official uploaded logo when present, otherwise the typographic wordmark. */
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
    <span className={cn('font-display font-extrabold leading-none tracking-[-0.03em] text-brand-text', wordmarkSizes[size], className)}>{name}</span>
  )
}

/** Small circular brand mark used for placeholders and compact lists. */
export function BrandMark({ slug, name, className }: { slug: string; name: string; className?: string }) {
  return (
    <span
      data-brand={slug}
      aria-hidden="true"
      className={cn('grid size-10 shrink-0 place-items-center rounded-full bg-brand font-display text-sm font-extrabold text-brand-ink [font-stretch:80%]', className)}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
