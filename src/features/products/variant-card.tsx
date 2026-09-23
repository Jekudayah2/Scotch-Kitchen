import { useState } from 'react'
import { QuantityStepper } from '@/components/ui/controls'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogVariant } from './catalog'
import { AddToCartButton, Price, ProductImage, StockBadge } from './components'

/** Card title: the flavour, else the size when the product is the brand itself (ZOBOPOP → "330ml"). */
export function variantTitle(variant: CatalogVariant) {
  if (variant.flavour) return variant.flavour
  if (variant.productName === variant.brand.name) return variant.size_label ?? variant.name
  return variant.productName
}

export function variantSubtitle(variant: CatalogVariant) {
  const container = variant.productType === 'FROZEN_DESSERT' ? 'tub' : variant.productType === 'DRINK' ? 'bottle' : ''
  if (!variant.flavour && variant.productName === variant.brand.name) {
    return container ? `${container[0]?.toUpperCase()}${container.slice(1)}` : ''
  }
  return [variant.size_label ?? (variant.flavour ? null : variant.name), container].filter(Boolean).join(' ')
}

/** Menu card for one orderable variant (e.g. "ZOBOPOP 500ml", "Creamypop Vanilla"). */
export function VariantCard({ variant, priority = false }: { variant: CatalogVariant; priority?: boolean }) {
  const [quantity, setQuantity] = useState(1)
  const { maxQuantity } = useCart()
  return (
    <article data-brand={variant.brand.slug} className="group flex flex-col overflow-hidden rounded-4xl border border-line bg-surface shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative">
        <ProductImage
          image={variant.image}
          brandSlug={variant.brand.slug}
          className="aspect-[4/3]"
          imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          priority={priority}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
        />
        <div className="absolute top-3 left-3">
          <StockBadge variant={variant} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.12em] text-brand-text uppercase">{variant.brand.name}</p>
            <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">{variantTitle(variant)}</h3>
            <p className="text-sm text-ink-3">{variantSubtitle(variant)}</p>
          </div>
          <Price pesewas={variant.price_pesewas} className="text-xl text-ink" />
        </div>
        <div className="mt-auto flex items-center gap-2">
          <QuantityStepper
            size="sm"
            value={quantity}
            onChange={setQuantity}
            max={maxQuantity}
            label={`Quantity of ${variant.displayName}`}
            disabled={!variant.orderable}
          />
          <AddToCartButton variant={variant} quantity={quantity} className="flex-1" onAdded={() => setQuantity(1)} />
        </div>
      </div>
    </article>
  )
}
