import { ArrowRight, IceCreamCone, Snowflake } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CreamypopWordmark, Watermark, ZobopopWordmark } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { QuantityStepper } from '@/components/ui/controls'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogBrand, CatalogProduct, CatalogVariant } from '@/features/products/catalog'
import { AddToCartButton, Price, ProductImage, StockBadge } from '@/features/products/components'
import { useCatalog } from '@/features/products/queries'
import { LabelFacts } from '@/features/storefront/home-sections'
import { SectionHeading } from '@/features/storefront/section-heading'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'

const FLAVOUR_DOT: Record<string, string> = {
  vanilla: 'var(--cp-vanilla)',
  strawberry: 'var(--cp-strawberry)',
}

function FlavourDot({ flavour }: { flavour: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="size-3.5 rounded-full ring-2 ring-surface"
      style={{ background: FLAVOUR_DOT[(flavour ?? '').toLowerCase()] ?? 'var(--brand)' }}
    />
  )
}

function CreamypopHero({ brand, product }: { brand: CatalogBrand; product: CatalogProduct }) {
  const first = product.variants.find((v) => v.orderable) ?? product.variants[0]
  const [variantId, setVariantId] = useState(first?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const { maxQuantity } = useCart()
  const reduceMotion = useReducedMotion()
  const variant = product.variants.find((v) => v.id === variantId) ?? first
  if (!variant) return null

  return (
    <section className="relative overflow-hidden bg-cp-cream" aria-labelledby="creamypop-title">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(40%_55%_at_78%_45%,color-mix(in_oklab,var(--cp-strawberry)_16%,transparent),transparent_70%)]" />
      <Watermark text="Creamy" className="-right-6 -bottom-16 text-[10rem] sm:text-[17rem]" />
      <div className="container-page relative grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="eyebrow text-brand-text">SCOTCH’s Kitchen presents</p>
          <h1 id="creamypop-title" className="mt-5">
            <CreamypopWordmark size="hero" />
          </h1>
          <p className="mt-5 font-display text-2xl font-bold text-ink sm:text-3xl">{brand.tagline ?? product.subtitle}</p>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-2">{product.description}</p>

          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-semibold text-ink">Choose a flavour</legend>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <label
                  key={v.id}
                  className={cn(
                    'inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-full px-5 font-semibold transition-colors',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                    v.id === variant.id ? 'bg-ink text-canvas shadow-soft' : 'bg-surface text-ink ring-1 ring-line hover:ring-line-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="flavour"
                    className="sr-only"
                    checked={v.id === variant.id}
                    onChange={() => {
                      setVariantId(v.id)
                      setQuantity(1)
                    }}
                  />
                  <FlavourDot flavour={v.flavour} />
                  {v.flavour ?? v.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex items-baseline gap-3">
            <Price pesewas={variant.price_pesewas} className="text-4xl text-ink" />
            <span className="font-semibold text-ink-3">{variant.size_label} tub</span>
            <StockBadge variant={variant} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} label={`Quantity of ${variant.displayName}`} disabled={!variant.orderable} />
            <AddToCartButton variant={variant} quantity={quantity} size="xl" onAdded={() => setQuantity(1)} />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="relative aspect-[4/3] overflow-hidden rounded-5xl shadow-float ring-1 ring-line" aria-live="polite">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={variant.id}
                className="absolute inset-0"
                initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <ProductImage image={variant.image} brandSlug="creamypop" className="size-full" priority sizes="(min-width: 1024px) 45vw, 100vw" />
              </motion.div>
            </AnimatePresence>
          </div>
          {product.storage_note && (
            <span className="glass absolute -bottom-5 left-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink shadow-lift">
              <Snowflake className="size-4 text-brand-text" aria-hidden="true" />
              {product.storage_note}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function FlavourCard({ variant }: { variant: CatalogVariant }) {
  const [quantity, setQuantity] = useState(1)
  const { maxQuantity } = useCart()
  return (
    <article className="overflow-hidden rounded-5xl border border-line bg-surface shadow-soft">
      <ProductImage image={variant.image} brandSlug="creamypop" className="aspect-[16/11]" sizes="(min-width: 768px) 45vw, 100vw" />
      <div className="space-y-4 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-[-0.03em] text-ink">
              <FlavourDot flavour={variant.flavour} />
              {variant.flavour ?? variant.name}
            </p>
            <p className="mt-1 text-ink-3">{variant.size_label} tub</p>
          </div>
          <Price pesewas={variant.price_pesewas} className="text-2xl text-brand-text" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} label={`Quantity of ${variant.displayName}`} disabled={!variant.orderable} />
          <AddToCartButton variant={variant} quantity={quantity} size="lg" className="flex-1" onAdded={() => setQuantity(1)} />
        </div>
      </div>
    </article>
  )
}

export default function CreamypopPage() {
  useDocumentTitle('Creamypop · Creamy. Fresh. Ghanaian.')
  const catalog = useCatalog()
  const brand = catalog.data?.brandBySlug.get('creamypop')
  const product = brand?.products[0]
  const zobopop = catalog.data?.brandBySlug.get('zobopop')

  if (catalog.isPending) {
    return (
      <div className="bg-cp-cream">
        <div className="container-page grid gap-10 py-20 lg:grid-cols-2">
          <div className="space-y-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-12 w-72 rounded-full" />
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-5xl" />
        </div>
      </div>
    )
  }
  if (catalog.isError) return <ErrorState className="min-h-[60vh]" error={catalog.error} onRetry={() => void catalog.refetch()} />
  if (!brand || !product) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={IceCreamCone}
        title="Creamypop isn’t on the menu right now"
        description="Check back soon, or see what else the kitchen has."
        action={
          <Button asChild>
            <Link to="/order">See the menu</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div data-brand="creamypop">
      <CreamypopHero brand={brand} product={product} />

      <section className="py-20 lg:py-28" aria-labelledby="tub-title">
        <div className="container-page">
          <SectionHeading
            id="tub-title"
            eyebrow="On every tub"
            title="Made to be creamy"
            description="Straight from the label: what every Creamypop tub promises."
          />
          <LabelFacts className="mt-12" />
        </div>
      </section>

      <section className="bg-surface-2 py-20 lg:py-28" aria-labelledby="flavours-title">
        <div className="container-page">
          <SectionHeading
            id="flavours-title"
            eyebrow="Flavours"
            title={product.variants.length === 2 ? 'Two flavours' : 'The flavours'}
            description={`Every tub is ${product.variants[0]?.size_label ?? ''}. Pick one, or one of each.`}
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {product.variants.map((variant) => (
              <FlavourCard key={variant.id} variant={variant} />
            ))}
          </div>
        </div>
      </section>

      {zobopop && (
        <section className="py-20" aria-labelledby="pair-title">
          <div className="container-page">
            <div
              data-brand="zobopop"
              className="flex flex-col items-start justify-between gap-8 overflow-hidden rounded-5xl bg-[linear-gradient(150deg,#4e0e19,#8c1c2f)] p-8 text-white sm:p-12 lg:flex-row lg:items-center"
            >
              <div className="space-y-3">
                <p className="eyebrow text-[#f4c9a8]">Also from the kitchen</p>
                <h2 id="pair-title" className="display-md">
                  Wash it down with <ZobopopWordmark size="lg" tone="light" className="align-baseline" />
                </h2>
                <p className="max-w-lg text-[#f0d9d4]">
                  {zobopop.tagline}, from {formatCedis(zobopop.fromPrice)}.
                </p>
              </div>
              <Button asChild variant="light" size="xl" trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link to="/zobopop">Explore ZOBOPOP</Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
