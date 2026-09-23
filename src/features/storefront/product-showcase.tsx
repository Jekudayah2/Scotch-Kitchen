import { ArrowRight, Snowflake, ThermometerSnowflake } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { QuantityStepper } from '@/components/ui/controls'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogProduct } from '@/features/products/catalog'
import { AddToCartButton, ProductImage, VariantPicker } from '@/features/products/components'
import { cn } from '@/utils/cn'

/** Product card with size/flavour choice, quantity and add-to-cart. */
export function ProductShowcase({
  product,
  imageAspect = 'aspect-[4/5]',
  pickerLabel,
  showOrderLink = true,
  className,
  priority = false,
}: {
  product: CatalogProduct
  imageAspect?: string
  pickerLabel?: string
  showOrderLink?: boolean
  className?: string
  priority?: boolean
}) {
  const firstOrderable = product.variants.find((v) => v.orderable) ?? product.variants[0]
  const [variantId, setVariantId] = useState(firstOrderable?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const { maxQuantity } = useCart()
  const variant = product.variants.find((v) => v.id === variantId) ?? firstOrderable
  if (!variant) return null

  const isFrozen = product.product_type === 'FROZEN_DESSERT'
  const StorageIcon = isFrozen ? Snowflake : ThermometerSnowflake
  const label = pickerLabel ?? (product.variants.some((v) => v.flavour) ? 'Choose a flavour' : 'Choose a size')

  return (
    <article className={cn('grid gap-6 md:grid-cols-[1fr_1.05fr] md:items-center md:gap-8', className)} data-brand={product.brand.slug}>
      <ProductImage
        image={variant.image ?? product.primaryImage}
        brandSlug={product.brand.slug}
        className={cn('rounded-4xl shadow-lift ring-1 ring-line', imageAspect)}
        priority={priority}
        sizes="(min-width: 768px) 40vw, 100vw"
      />
      <div className="space-y-5">
        <div className="space-y-2">
          <h3 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-brand-text sm:text-4xl">{product.name}</h3>
          {product.subtitle && <p className="text-lg font-semibold text-ink">{product.subtitle}</p>}
          {product.description && <p className="leading-relaxed text-ink-2">{product.description}</p>}
        </div>

        {product.variants.length > 1 ? (
          <VariantPicker
            label={label}
            variants={product.variants}
            value={variant.id}
            onChange={(id) => {
              setVariantId(id)
              setQuantity(1)
            }}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} label={`Quantity of ${variant.displayName}`} />
          <AddToCartButton variant={variant} quantity={quantity} size="lg" />
          {showOrderLink && (
            <Button asChild variant="ghost" size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <Link to="/order">Order now</Link>
            </Button>
          )}
        </div>

        {product.storage_note && (
          <p className="flex items-center gap-2 text-sm font-medium text-ink-3">
            <StorageIcon className="size-4" aria-hidden="true" />
            {product.storage_note}
          </p>
        )}
      </div>
    </article>
  )
}
