import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { BrandWordmark, CreamypopWordmark, ZobopopWordmark } from '@/components/brand/brand-marks'
import { Skeleton } from '@/components/ui/feedback'
import type { CatalogBrand } from '@/features/products/catalog'
import { Price, ProductImage } from '@/features/products/components'
import { cn } from '@/utils/cn'
import { Reveal } from './motion'
import { SectionHeader } from './section-header'

/** Each product brand lives in its own visual world; unknown brands get the neutral one. */
export const BRAND_WORLDS: Record<string, { scene: 'wine' | 'cream'; path: string }> = {
  zobopop: { scene: 'wine', path: '/zobopop' },
  creamypop: { scene: 'cream', path: '/creamypop' },
}

export function brandPath(slug: string) {
  return BRAND_WORLDS[slug]?.path ?? `/brands/${slug}`
}

function PanelWordmark({ brand }: { brand: CatalogBrand }) {
  const size = 'text-4xl sm:text-5xl'
  if (brand.slug === 'zobopop' && !brand.logo_url) return <ZobopopWordmark size="lg" tone="light" className={size} />
  if (brand.slug === 'creamypop' && !brand.logo_url) return <CreamypopWordmark size="lg" className={size} />
  return <BrandWordmark slug={brand.slug} name={brand.name} logoUrl={brand.logo_url} size="lg" />
}

export function BrandPanel({ brand }: { brand: CatalogBrand }) {
  const world = BRAND_WORLDS[brand.slug]
  const wine = world?.scene === 'wine'
  return (
    <Link
      to={brandPath(brand.slug)}
      data-scene={world?.scene}
      data-brand={brand.slug}
      className={cn(
        'group relative isolate flex min-h-[24rem] flex-col overflow-hidden rounded-media bg-canvas p-7 ring-1 ring-line sm:min-h-[28rem] sm:p-9',
        'transition-[transform,box-shadow] duration-300 ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
        !world && 'bg-surface',
      )}
    >
      {wine && (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(70%_70%_at_85%_80%,var(--scene-wine-2),transparent_70%)]"
        />
      )}
      <div className="relative z-10 max-w-[58%] sm:max-w-[55%]">
        <h3>
          <PanelWordmark brand={brand} />
        </h3>
        {brand.tagline && <p className="mt-3 text-base font-semibold text-ink-2 sm:text-lg">{brand.tagline}</p>}
        {brand.fromPrice != null && (
          <p className="mt-6 text-sm font-semibold text-ink-3">
            From <Price pesewas={brand.fromPrice} className="ml-1 text-xl text-ink" />
          </p>
        )}
      </div>
      <span className="relative z-10 mt-auto inline-flex items-center gap-2 pt-8 font-semibold text-ink">
        Explore {brand.name}
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
      </span>

      <ProductImage
        image={brand.primaryImage}
        brandSlug={brand.slug}
        brandName={brand.name}
        className={cn(
          'absolute right-0 bottom-0 bg-transparent',
          wine
            ? 'feather-edges h-[94%] w-[52%]'
            : 'right-5 bottom-5 aspect-square w-[46%] rounded-card shadow-soft sm:right-7 sm:bottom-7',
        )}
        imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
        sizes="(min-width: 1024px) 25vw, 50vw"
      />
    </Link>
  )
}

/** "Discover our brands": one panel per product brand, straight from the catalog. */
export function BrandPanels({ brands, loading }: { brands: CatalogBrand[]; loading: boolean }) {
  return (
    <section id="brands" aria-labelledby="brands-title" className="container-page scroll-mt-24 py-16 sm:py-20 lg:py-28">
      <Reveal>
        <SectionHeader
          id="brands-title"
          eyebrow="The SCOTCH’s Kitchen family"
          title="Discover our brands"
          description="A signature hibiscus drink and a creamy ice cream, both made by our kitchen."
        />
      </Reveal>
      <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-2">
        {loading
          ? [0, 1].map((i) => <Skeleton key={i} className="h-[24rem] rounded-media sm:h-[28rem]" />)
          : brands.map((brand, i) => (
              <Reveal key={brand.id} delay={i * 0.08}>
                <BrandPanel brand={brand} />
              </Reveal>
            ))}
      </div>
    </section>
  )
}
