import { Check, ImageOff, ShoppingBag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandTile } from '@/components/brand/brand-marks'
import { Badge } from '@/components/ui/badge'
import { Button, type ButtonProps, type ButtonVariant } from '@/components/ui/button'
import { useCart } from '@/features/cart/cart-provider'
import type { ProductImage as ProductImageRow } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'
import type { CatalogVariant } from './catalog'

/**
 * Renders official product photography from the database. When no photo has
 * been uploaded yet it shows a branded placeholder, never a fabricated image.
 */
export function ProductImage({
  image,
  brandSlug,
  className,
  imgClassName,
  priority = false,
  sizes,
}: {
  image: Pick<ProductImageRow, 'url' | 'alt_text'> | null | undefined
  brandSlug?: string
  className?: string
  imgClassName?: string
  priority?: boolean
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)
  const showPlaceholder = !image?.url || failed
  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)}>
      {showPlaceholder ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-ink-3">
            {brandSlug ? <BrandTile slug={brandSlug} size="sm" /> : <ImageOff className="size-8" aria-hidden="true" />}
            <span className="text-xs font-semibold">Photo coming soon</span>
          </div>
        </div>
      ) : (
        <img
          src={image.url}
          alt={image.alt_text}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          sizes={sizes}
          onError={() => setFailed(true)}
          className={cn('absolute inset-0 size-full object-cover', imgClassName)}
        />
      )}
    </div>
  )
}

export function Price({ pesewas, className }: { pesewas: number | null | undefined; className?: string }) {
  return <span className={cn('tabular font-display font-bold tracking-tight', className)}>{formatCedis(pesewas)}</span>
}

export function StockBadge({ variant }: { variant: CatalogVariant }) {
  if (!variant.orderable) return <Badge tone="neutral">Sold out</Badge>
  if (variant.track_stock && (variant.stock_quantity ?? 0) <= 5) {
    return <Badge tone="warning">Only {variant.stock_quantity} left</Badge>
  }
  return null
}

/** Adds a variant to the cart with clear, short-lived confirmation. */
export function AddToCartButton({
  variant,
  quantity = 1,
  label = 'Add to cart',
  openCart = false,
  onAdded,
  buttonVariant = 'brand',
  ...buttonProps
}: {
  variant: CatalogVariant
  quantity?: number
  label?: string
  openCart?: boolean
  onAdded?: () => void
  /** Visual style; defaults to the active brand colour (set by the nearest data-brand scope). */
  buttonVariant?: ButtonVariant
} & Omit<ButtonProps, 'onClick' | 'variant'>) {
  const { add, setDrawerOpen, quantityOf, maxQuantity } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const inCart = quantityOf(variant.id)
  const atLimit = inCart >= maxQuantity

  return (
    <Button
      {...buttonProps}
      variant={buttonVariant}
      disabled={!variant.orderable || atLimit || buttonProps.disabled}
      onClick={() => {
        add(variant.id, quantity)
        setJustAdded(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setJustAdded(false), 1600)
        toast.success(`${variant.displayName} added to your cart`, {
          action: { label: 'View cart', onClick: () => setDrawerOpen(true) },
        })
        if (openCart) setDrawerOpen(true)
        onAdded?.()
      }}
      leadingIcon={justAdded ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}
    >
      {!variant.orderable ? 'Sold out' : atLimit ? 'Limit reached' : justAdded ? 'Added' : label}
    </Button>
  )
}

export function containerLabel(productType: CatalogVariant['productType']) {
  return productType === 'DRINK' ? 'Bottle' : productType === 'FROZEN_DESSERT' ? 'Tub' : 'Each'
}

/** Accessible radio-card group for choosing a size or flavour. */
export function VariantPicker({
  variants,
  value,
  onChange,
  label,
  className,
}: {
  variants: CatalogVariant[]
  value: string
  onChange: (variantId: string) => void
  label: string
  className?: string
}) {
  return (
    <fieldset className={cn('space-y-2.5', className)}>
      <legend className="mb-2.5 text-sm font-semibold text-ink">{label}</legend>
      <div className="grid grid-cols-2 gap-2.5">
        {variants.map((variant) => {
          const selected = variant.id === value
          return (
            <label
              key={variant.id}
              className={cn(
                'relative flex cursor-pointer flex-col gap-0.5 rounded-2xl border-2 px-4 py-3 transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                selected ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong',
                !variant.orderable && 'opacity-60',
              )}
            >
              <input
                type="radio"
                name={label}
                value={variant.id}
                checked={selected}
                onChange={() => onChange(variant.id)}
                className="sr-only"
              />
              <span className="font-display text-lg font-bold text-ink">{variant.flavour ?? variant.size_label ?? variant.name}</span>
              <span className="flex items-center justify-between gap-2 text-sm text-ink-3">
                <span>{variant.flavour ? variant.size_label : containerLabel(variant.productType)}</span>
                <Price pesewas={variant.price_pesewas} className={cn('text-base', selected ? 'text-brand-text' : 'text-ink')} />
              </span>
              {!variant.orderable && <span className="text-xs font-semibold text-ink-3">Sold out</span>}
              {selected && (
                <span className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-brand text-brand-ink">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
