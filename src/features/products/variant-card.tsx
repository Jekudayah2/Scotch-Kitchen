import { useState } from 'react'
import { QuantitySelector } from '@/components/ui/controls'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogVariant } from './catalog'
import { AddToCartButton, containerLabel, Price, ProductImage, StockBadge } from './components'

/** Card title: the flavour, else the size when the product is the brand itself (ZOBOPOP → "330ml"). */
export function variantTitle(variant: CatalogVariant) {
  if (variant.flavour) return variant.flavour
  if (variant.productName === variant.brand.name) return variant.size_label ?? variant.name
  return variant.productName
}

export function variantSubtitle(variant: CatalogVariant) {
  if (!variant.flavour && variant.productName === variant.brand.name) return containerLabel(variant.productType)
  const container = containerLabel(variant.productType).toLowerCase()
  return [variant.size_label ?? (variant.flavour ? null : variant.name), container === 'each' ? null : container].filter(Boolean).join(' ')
}

/**
 * Ordering card: official image, brand, name, variant, price, availability,
 * quantity and a single clear Add action with the live total.
 */
export function ProductCard({ variant, priority = false }: { variant: CatalogVariant; priority?: boolean }) {
  const [quantity, setQuantity] = useState(1)
  const { maxQuantity } = useCart()
  return (
    <article data-brand={variant.brand.slug} className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-shadow duration-300 hover:shadow-lift">
      <div className="relative">
        <ProductImage
          image={variant.image}
          brandSlug={variant.brand.slug}
          brandName={variant.brand.name}
          className="aspect-square"
          imgClassName="object-[50%_35%] transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
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
            <p className="text-[0.7rem] font-bold tracking-[0.14em] text-brand-text uppercase">{variant.brand.name}</p>
            <h3 className="mt-1 font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-ink">{variantTitle(variant)}</h3>
            <p className="text-sm text-ink-3">{variantSubtitle(variant)}</p>
          </div>
          <Price pesewas={variant.price_pesewas} className="text-xl text-ink" />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <QuantitySelector
            size="sm"
            value={quantity}
            onChange={setQuantity}
            max={maxQuantity}
            label={`Quantity of ${variant.displayName}`}
            disabled={!variant.orderable}
          />
          <AddToCartButton variant={variant} quantity={quantity} label="Add" className="min-w-0 flex-1" onAdded={() => setQuantity(1)} />
        </div>
      </div>
    </article>
  )
}

/** Compact quick-add tile: image, name, price and one Add action (homepage order band). */
export function QuickAddTile({ variant }: { variant: CatalogVariant }) {
  return (
    <article data-brand={variant.brand.slug} className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
      <ProductImage
        image={variant.image}
        brandSlug={variant.brand.slug}
        brandName={variant.brand.name}
        className="aspect-square"
        imgClassName="object-[50%_35%] transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
        sizes="(min-width: 1024px) 20vw, (min-width: 360px) 50vw, 100vw"
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold tracking-[0.14em] text-brand-text uppercase">{variant.brand.name}</p>
          <h3 className="mt-1 font-display text-lg leading-tight font-extrabold tracking-[-0.02em] break-words text-ink">{variantTitle(variant)}</h3>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-sm text-ink-3">{variantSubtitle(variant)}</span>
            <Price pesewas={variant.price_pesewas} className="shrink-0 text-base text-ink" />
          </div>
        </div>
        <div className="mt-auto space-y-2">
          <StockBadge variant={variant} />
          <AddToCartButton variant={variant} label="Add" showTotal={false} className="w-full" />
        </div>
      </div>
    </article>
  )
}
