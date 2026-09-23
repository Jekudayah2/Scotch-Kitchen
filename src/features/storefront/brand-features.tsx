import { ArrowRight, Snowflake } from 'lucide-react'
import { m } from 'motion/react'
import { useRef } from 'react'
import { Link } from 'react-router'
import { CreamypopWordmark, ZobopopWordmark } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import type { CatalogBrand, CatalogVariant } from '@/features/products/catalog'
import { AddToCartButton, containerLabel, Price, ProductImage, StockBadge } from '@/features/products/components'
import { cn } from '@/utils/cn'
import { Reveal, useParallax } from './motion'

function StorageNote({ note }: { note: string | null }) {
  if (!note) return null
  return (
    <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-3">
      <Snowflake className="size-4" aria-hidden="true" />
      {note}
    </p>
  )
}

// ---------------------------------------------------------------------------
// ZOBOPOP: deep hibiscus world. One signature drink, two bottle sizes.
// ---------------------------------------------------------------------------
function SizeTile({ variant }: { variant: CatalogVariant }) {
  return (
    <li className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="condensed font-display text-3xl leading-none font-extrabold tracking-[-0.01em] text-ink uppercase">
          {variant.size_label ?? variant.name}
        </span>
        <Price pesewas={variant.price_pesewas} className="text-lg text-ink" />
      </div>
      <div className="-mt-2 flex items-center gap-2 text-sm text-ink-3">
        {containerLabel(variant.productType)}
        <StockBadge variant={variant} />
      </div>
      <AddToCartButton variant={variant} label="Add" showTotal={false} buttonVariant="primary" className="w-full" />
    </li>
  )
}

export function ZobopopFeature({ brand, className }: { brand: CatalogBrand; className?: string }) {
  const media = useRef<HTMLDivElement>(null)
  const drift = useParallax(media, 56)
  const product = brand.products[0]
  if (!product) return null

  return (
    <section data-scene="wine" data-brand="zobopop" aria-labelledby="zobopop-feature-title" className={cn('relative isolate overflow-hidden bg-canvas', className)}>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(45%_55%_at_28%_52%,var(--scene-wine-2),transparent_72%)]" />
      <div className="container-page grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div ref={media} className="relative mx-auto w-full max-w-[24rem] sm:max-w-[28rem] lg:max-w-[32rem]">
          <m.div style={{ y: drift }}>
            <ProductImage
              image={product.primaryImage}
              brandSlug={brand.slug}
              brandName={brand.name}
              className="feather-edges aspect-[4/5] bg-transparent"
              sizes="(min-width: 1024px) 32rem, 80vw"
            />
          </m.div>
        </div>

        <div>
          <Reveal>
            <p className="eyebrow text-ink-3">{product.subtitle ?? brand.tagline}</p>
            <h2 id="zobopop-feature-title" className="mt-4">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} className="h-16 w-auto sm:h-20" />
              ) : (
                <ZobopopWordmark size="xl" tone="light" />
              )}
            </h2>
            <p className="display-md mt-5 text-ink">Refreshing Nature In Every Sip.</p>
            {product.description && <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-2">{product.description}</p>}
          </Reveal>
          <Reveal delay={0.08}>
            <ul className="mt-8 grid max-w-lg gap-3 xs:grid-cols-2" aria-label={`${brand.name} sizes`}>
              {product.variants.map((variant) => (
                <SizeTile key={variant.id} variant={variant} />
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link to="/order?brand=zobopop">Order {brand.name}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/zobopop">Explore {brand.name}</Link>
              </Button>
            </div>
            <StorageNote note={product.storage_note} />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Creamypop: soft cream world. Two flavours, one 200ml tub each.
// ---------------------------------------------------------------------------
function FlavourTile({ variant, className }: { variant: CatalogVariant; className?: string }) {
  return (
    <article className={cn('group flex flex-col overflow-hidden rounded-media border border-line bg-surface shadow-soft', className)}>
      <ProductImage
        image={variant.image}
        brandSlug={variant.brand.slug}
        brandName={variant.brand.name}
        className="aspect-square"
        imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
        sizes="(min-width: 1024px) 22rem, 50vw"
      />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <h3 className="font-display text-xl font-extrabold tracking-[-0.02em] text-ink sm:text-2xl">{variant.flavour ?? variant.name}</h3>
          <Price pesewas={variant.price_pesewas} className="text-lg text-ink" />
        </div>
        <p className="-mt-1 text-sm text-ink-3">{[variant.size_label, containerLabel(variant.productType).toLowerCase()].filter(Boolean).join(' ')}</p>
        <div className="mt-auto">
          <StockBadge variant={variant} />
          <AddToCartButton variant={variant} label="Add" showTotal={false} className="mt-2 w-full" />
        </div>
      </div>
    </article>
  )
}

export function CreamypopFeature({ brand, className }: { brand: CatalogBrand; className?: string }) {
  const media = useRef<HTMLUListElement>(null)
  const drift = useParallax(media, 36)
  const product = brand.products[0]
  if (!product) return null

  return (
    <section data-scene="cream" data-brand="creamypop" aria-labelledby="creamypop-feature-title" className={cn('relative overflow-hidden bg-canvas', className)}>
      <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:py-28">
        <div>
          <Reveal>
            <p className="eyebrow text-brand-text">{product.name}</p>
            <h2 id="creamypop-feature-title" className="mt-4">
              {brand.logo_url ? <img src={brand.logo_url} alt={brand.name} className="h-16 w-auto sm:h-20" /> : <CreamypopWordmark size="xl" />}
            </h2>
            <p className="display-md mt-5 text-ink">{product.subtitle ?? brand.tagline}</p>
            {product.description && <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-2">{product.description}</p>}
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="brand" trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link to="/order?brand=creamypop">Order {brand.name}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/creamypop">Explore {brand.name}</Link>
              </Button>
            </div>
            <StorageNote note={product.storage_note} />
          </Reveal>
        </div>

        <ul ref={media} className="grid grid-cols-2 items-start gap-3 sm:gap-5" aria-label={`${brand.name} flavours`}>
          {product.variants.map((variant, i) => (
            <m.li key={variant.id} style={{ y: i % 2 === 1 ? drift : 0 }} className={cn('list-none', i % 2 === 1 && 'lg:mt-14')}>
              <Reveal delay={i * 0.08}>
                <FlavourTile variant={variant} />
              </Reveal>
            </m.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
