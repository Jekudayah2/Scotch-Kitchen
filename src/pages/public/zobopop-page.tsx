import { ArrowRight, CupSoda, ThermometerSnowflake } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CreamypopWordmark, Watermark, ZobopopWordmark } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { QuantityStepper } from '@/components/ui/controls'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogBrand, CatalogProduct, CatalogVariant } from '@/features/products/catalog'
import { AddToCartButton, Price, StockBadge } from '@/features/products/components'
import { useCatalog } from '@/features/products/queries'
import { IngredientStory } from '@/features/storefront/ingredient-story'
import { SectionHeading } from '@/features/storefront/section-heading'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatCedis } from '@/utils/money'

/** Illustrative bottle outline, scaled by volume. Not a product photo. */
function BottleOutline({ volume, maxVolume }: { volume: number; maxVolume: number }) {
  const scale = 0.62 + 0.38 * (volume / maxVolume)
  return (
    <svg viewBox="0 0 60 140" className="h-36 w-auto" aria-hidden="true" style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}>
      <path d="M24 4h12v18c0 6 12 12 12 30v76a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V52c0-18 12-24 12-30V4z" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="2.5" />
      <path d="M14 70h32v58a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V70z" fill="var(--brand)" opacity="0.9" />
      <rect x="22" y="2" width="16" height="8" rx="2" fill="var(--ink)" />
    </svg>
  )
}

function SizeCard({ variant, maxVolume }: { variant: CatalogVariant; maxVolume: number }) {
  const [quantity, setQuantity] = useState(1)
  const { maxQuantity } = useCart()
  return (
    <article className="flex flex-col gap-6 rounded-5xl border border-line bg-surface p-6 shadow-soft sm:flex-row sm:items-end sm:p-8">
      <div className="grid h-40 w-24 shrink-0 place-items-end justify-center self-center">
        <BottleOutline volume={variant.volume_ml ?? maxVolume} maxVolume={maxVolume} />
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-5xl font-extrabold tracking-[-0.04em] text-ink">{variant.size_label ?? variant.name}</p>
            <p className="mt-1 text-ink-3">ZOBOPOP bottle</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Price pesewas={variant.price_pesewas} className="text-3xl text-brand-text" />
            <StockBadge variant={variant} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} label={`Quantity of ${variant.displayName}`} disabled={!variant.orderable} />
          <AddToCartButton variant={variant} quantity={quantity} size="lg" className="flex-1" onAdded={() => setQuantity(1)} />
        </div>
      </div>
    </article>
  )
}

function ZobopopHero({ brand, product }: { brand: CatalogBrand; product: CatalogProduct }) {
  const floating = product.ingredients.slice(0, 5)
  const positions = ['top-[6%] -left-4', 'top-[30%] -right-6', 'bottom-[26%] -left-8', 'bottom-[8%] right-2', 'top-[58%] -right-10']
  return (
    <section className="relative overflow-hidden bg-zp-wine text-white" aria-labelledby="zobopop-title">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(45%_60%_at_75%_40%,rgba(194,58,82,0.55),transparent_70%)]" />
      <Watermark text="SOBOLO" className="-bottom-10 left-0 text-[9rem] [-webkit-text-stroke-color:rgba(255,255,255,0.07)] sm:text-[16rem]" />
      <div className="container-page relative grid items-center gap-14 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <p className="eyebrow text-[#f4c9a8]">SCOTCH’s Kitchen presents</p>
          <h1 id="zobopop-title" className="mt-5">
            <ZobopopWordmark size="hero" tone="light" />
          </h1>
          <p className="mt-5 font-display text-2xl font-bold sm:text-3xl">{product.subtitle ?? brand.tagline}</p>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[#f0d9d4]">{product.description}</p>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Sizes and prices">
            {product.variants.map((v) => (
              <li key={v.id} className="inline-flex h-11 items-center gap-2.5 rounded-full bg-white/10 px-4 text-sm font-semibold ring-1 ring-white/20 backdrop-blur">
                <CupSoda className="size-4 text-[#f4c9a8]" aria-hidden="true" />
                {v.size_label ?? v.name}
                <span className="tabular text-[#f4c9a8]">{formatCedis(v.price_pesewas)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="light" size="xl">
              <a href="#sizes">Choose your size</a>
            </Button>
            <Button asChild size="xl" variant="ghost" className="text-white ring-1 ring-white/30 hover:bg-white/10 hover:text-white" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <Link to="/order">Order now</Link>
            </Button>
          </div>
          {product.storage_note && (
            <p className="mt-6 flex items-center gap-2 text-sm font-medium text-[#f0d9d4]">
              <ThermometerSnowflake className="size-4" aria-hidden="true" />
              {product.storage_note}
            </p>
          )}
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
          <figure className="rotate-2 overflow-hidden rounded-5xl shadow-float ring-1 ring-white/10">
            {product.primaryImage ? (
              <img
                src={product.primaryImage.url}
                alt={product.primaryImage.alt_text}
                fetchPriority="high"
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="aspect-[4/5] w-full bg-white/10" />
            )}
          </figure>
          {floating.map((ingredient, i) => (
            <span
              key={ingredient.id}
              className={`absolute hidden rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-semibold text-white shadow-lift ring-1 ring-white/25 backdrop-blur-md sm:inline-flex ${positions[i] ?? ''}`}
              aria-hidden="true"
            >
              {ingredient.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function ZobopopPage() {
  useDocumentTitle('ZOBOPOP · Premium Hibiscus Drink')
  const catalog = useCatalog()
  const brand = catalog.data?.brandBySlug.get('zobopop')
  const product = brand?.products[0]
  const creamypop = catalog.data?.brandBySlug.get('creamypop')

  if (catalog.isPending) {
    return (
      <div className="bg-zp-wine">
        <div className="container-page grid gap-10 py-20 lg:grid-cols-2">
          <div className="space-y-5">
            <Skeleton className="h-6 w-48 bg-white/10" />
            <Skeleton className="h-28 w-full bg-white/10" />
            <Skeleton className="h-20 w-3/4 bg-white/10" />
          </div>
          <Skeleton className="aspect-[4/5] w-full max-w-md rounded-5xl bg-white/10" />
        </div>
      </div>
    )
  }
  if (catalog.isError) return <ErrorState className="min-h-[60vh]" error={catalog.error} onRetry={() => void catalog.refetch()} />
  if (!brand || !product) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={CupSoda}
        title="ZOBOPOP isn’t on the menu right now"
        description="Check back soon, or see what else the kitchen has."
        action={
          <Button asChild>
            <Link to="/order">See the menu</Link>
          </Button>
        }
      />
    )
  }

  const maxVolume = Math.max(...product.variants.map((v) => v.volume_ml ?? 0), 1)

  return (
    <div data-brand="zobopop">
      <ZobopopHero brand={brand} product={product} />

      <section className="py-20 lg:py-28" aria-labelledby="blend-title">
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              id="blend-title"
              eyebrow="The signature blend"
              title={`One drink. ${product.ingredients.length} ingredients`}
              description="ZOBOPOP isn’t a range of flavours. It’s a single recipe: hibiscus at the heart, warmed with spice and brightened with fruit, in every bottle."
            />
          </div>
          <IngredientStory ingredients={product.ingredients} />
        </div>
      </section>

      <section id="sizes" className="scroll-mt-24 bg-surface-2 py-20 lg:py-28" aria-labelledby="sizes-title">
        <div className="container-page">
          <SectionHeading id="sizes-title" eyebrow="Sizes" title="Pick your size" description="The same recipe in two bottle sizes." />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {product.variants.map((variant) => (
              <SizeCard key={variant.id} variant={variant} maxVolume={maxVolume} />
            ))}
          </div>
        </div>
      </section>

      {creamypop && (
        <section className="py-20" aria-labelledby="pair-title">
          <div className="container-page">
            <div data-brand="creamypop" className="flex flex-col items-start justify-between gap-8 overflow-hidden rounded-5xl bg-cp-cream p-8 ring-1 ring-line sm:p-12 lg:flex-row lg:items-center">
              <div className="space-y-3">
                <p className="eyebrow text-brand-text">Also from the kitchen</p>
                <h2 id="pair-title" className="display-md text-ink">
                  Pair it with <CreamypopWordmark size="lg" className="align-baseline" />
                </h2>
                <p className="max-w-lg text-ink-2">{creamypop.tagline} Vanilla and Strawberry, from {formatCedis(creamypop.fromPrice)}.</p>
              </div>
              <Button asChild variant="brand" size="xl" trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link to="/creamypop">Explore Creamypop</Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
