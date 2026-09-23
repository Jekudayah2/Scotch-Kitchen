import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { QuantityStepper } from '@/components/ui/controls'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogVariant } from '@/features/products/catalog'
import { AddToCartButton, Price, ProductImage, StockBadge } from '@/features/products/components'
import { cn } from '@/utils/cn'

/**
 * Variant carousel with side arrows and elongated-dot pagination (the
 * Pizzaman Chickenman menu pattern), built as an accessible carousel.
 */
export function FlavourCarousel({ variants, description }: { variants: CatalogVariant[]; description?: string | null }) {
  const [index, setIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const { maxQuantity } = useCart()
  const reduceMotion = useReducedMotion()
  const labelId = useId()
  const current = variants[index] ?? variants[0]
  if (!current) return null

  const go = (next: number) => {
    setIndex((next + variants.length) % variants.length)
    setQuantity(1)
  }

  return (
    <section aria-roledescription="carousel" aria-labelledby={labelId} className="space-y-6">
      <h3 id={labelId} className="sr-only">
        Creamypop flavours
      </h3>
      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden rounded-4xl shadow-lift ring-1 ring-line" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={current.id}
              className="absolute inset-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${variants.length}: ${current.name}`}
              initial={reduceMotion ? false : { opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProductImage image={current.image} brandSlug={current.brand.slug} className="size-full" sizes="(min-width: 1024px) 50vw, 100vw" />
            </motion.div>
          </AnimatePresence>
        </div>
        {variants.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-lift ring-1 ring-line transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Previous flavour"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-lift ring-1 ring-line transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Next flavour"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="font-display text-3xl font-extrabold tracking-[-0.03em] text-brand-text">{current.name}</p>
            <StockBadge variant={current} />
          </div>
          <p className="flex items-baseline gap-2 text-ink-3">
            <span className="text-sm font-semibold">{current.size_label}</span>
            <Price pesewas={current.price_pesewas} className="text-2xl text-ink" />
          </p>
        </div>
        {description && <p className="max-w-xl leading-relaxed text-ink-2">{description}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} label={`Quantity of ${current.displayName}`} />
          <AddToCartButton variant={current} quantity={quantity} size="lg" />
        </div>
      </div>

      {variants.length > 1 && (
        <div className="flex items-center gap-2" role="tablist" aria-label="Choose a flavour">
          {variants.map((variant, i) => (
            <button
              key={variant.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={variant.name}
              onClick={() => go(i)}
              className={cn(
                'h-2.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                i === index ? 'w-10 bg-brand' : 'w-2.5 bg-line-strong hover:bg-ink-3',
              )}
            />
          ))}
          <span className="ml-2 text-sm font-medium text-ink-3">
            {variants.map((v) => v.name).join(' · ')}
          </span>
        </div>
      )}
    </section>
  )
}
