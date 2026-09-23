import { Check, ShoppingBag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/brand/brand-marks'
import { Badge } from '@/components/ui/badge'
import { Button, type ButtonProps, type ButtonVariant } from '@/components/ui/button'
import { useCart } from '@/features/cart/cart-provider'
import type { ProductImage as ProductImageRow } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'
import type { CatalogVariant } from './catalog'

/**
 * Official product photography from the database (Supabase Storage or the
 * bundled originals). Without a photo it shows a quiet branded placeholder,
 * never a fabricated product image.
 */
export function ProductImage({
  image,
  brandSlug,
  brandName,
  className,
  imgClassName,
  priority = false,
  sizes,
}: {
  image: Pick<ProductImageRow, 'url' | 'alt_text'> | null | undefined
  brandSlug?: string
  brandName?: string
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
        <div className="absolute inset-0 grid place-items-center" role="img" aria-label={brandName ? `${brandName} photo coming soon` : 'Photo coming soon'}>
          {brandSlug ? <BrandMark slug={brandSlug} name={brandName ?? brandSlug} /> : null}
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

/** Only shown when it matters: sold out, or genuinely low tracked stock. */
export function StockBadge({ variant }: { variant: CatalogVariant }) {
  if (!variant.orderable) return <Badge tone="neutral">Sold out</Badge>
  if (variant.track_stock && (variant.stock_quantity ?? 0) <= 5) {
    return <Badge tone="warning">Only {variant.stock_quantity} left</Badge>
  }
  return null
}

export function containerLabel(productType: CatalogVariant['productType']) {
  return productType === 'DRINK' ? 'Bottle' : productType === 'FROZEN_DESSERT' ? 'Tub' : 'Each'
}

/** Adds a variant with immediate, short feedback. The label shows the live total. */
export function AddToCartButton({
  variant,
  quantity = 1,
  label = 'Add to cart',
  showTotal = true,
  openCart = false,
  onAdded,
  buttonVariant = 'brand',
  ...buttonProps
}: {
  variant: CatalogVariant
  quantity?: number
  label?: string
  showTotal?: boolean
  openCart?: boolean
  onAdded?: () => void
  buttonVariant?: ButtonVariant
} & Omit<ButtonProps, 'onClick' | 'variant'>) {
  const { add, setDrawerOpen, quantityOf, maxQuantity } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const atLimit = quantityOf(variant.id) >= maxQuantity
  const total = variant.price_pesewas * quantity

  return (
    <Button
      {...buttonProps}
      variant={buttonVariant}
      disabled={!variant.orderable || atLimit || buttonProps.disabled}
      onClick={() => {
        add(variant.id, quantity)
        setJustAdded(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setJustAdded(false), 1500)
        toast.success(`${quantity} × ${variant.displayName} added`, {
          action: { label: 'View bag', onClick: () => setDrawerOpen(true) },
          duration: 2600,
        })
        if (openCart) setDrawerOpen(true)
        onAdded?.()
      }}
      leadingIcon={justAdded ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}
    >
      {!variant.orderable ? (
        'Sold out'
      ) : atLimit ? (
        'Limit reached'
      ) : justAdded ? (
        'Added'
      ) : (
        <>
          {label}
          {showTotal && <span className="tabular opacity-80">· {formatCedis(total)}</span>}
        </>
      )}
    </Button>
  )
}

/**
 * Size or flavour selector as radio cards. The selected option gets a clear
 * border, stronger text, a check indicator and a little elevation.
 */
export function VariantSelector({
  variants,
  value,
  onChange,
  label,
  className,
  showImages = false,
}: {
  variants: CatalogVariant[]
  value: string
  onChange: (variantId: string) => void
  label: string
  className?: string
  showImages?: boolean
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-3 text-sm font-semibold text-ink-2">{label}</legend>
      <div className={cn('grid gap-3', variants.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {variants.map((variant) => {
          const selected = variant.id === value
          const title = variant.flavour ?? variant.size_label ?? variant.name
          const detail = variant.flavour ? variant.size_label : containerLabel(variant.productType)
          return (
            <label
              key={variant.id}
              className={cn(
                'group relative flex cursor-pointer items-center gap-3 rounded-[1rem] border-2 p-3 transition-[border-color,box-shadow,transform,background-color] duration-200',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                selected
                  ? '-translate-y-0.5 border-brand bg-surface shadow-lift motion-reduce:translate-y-0'
                  : 'border-line bg-surface/60 hover:border-line-strong',
                !variant.orderable && 'opacity-60',
              )}
            >
              <input type="radio" name={label} value={variant.id} checked={selected} onChange={() => onChange(variant.id)} className="sr-only" />
              {showImages && (
                <ProductImage image={variant.image} brandSlug={variant.brand.slug} brandName={variant.brand.name} className="size-10 shrink-0 rounded-[0.7rem] sm:size-14 sm:rounded-[0.8rem]" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate font-display text-base leading-tight sm:text-lg', selected ? 'font-extrabold text-ink' : 'font-bold text-ink-2')}>{title}</span>
                <span className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-sm text-ink-3">
                  <span className="truncate">{detail}</span>
                  <Price pesewas={variant.price_pesewas} className={cn('text-[0.95rem]', selected ? 'text-brand-text' : 'text-ink-2')} />
                </span>
                {!variant.orderable && <span className="text-xs font-semibold text-ink-3">Sold out</span>}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-brand text-brand-ink shadow-soft transition-[opacity,transform] duration-200',
                  selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
