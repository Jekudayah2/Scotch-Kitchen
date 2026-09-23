import { ArrowRight, Snowflake } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { QuantitySelector } from '@/components/ui/controls'
import { useCart } from '@/features/cart/cart-provider'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'
import type { CatalogProduct, CatalogVariant } from './catalog'
import { AddToCartButton, containerLabel, StockBadge, VariantSelector } from './components'

/**
 * Buying block for a product page: size or flavour, quantity, the live total
 * on the Add button, and Order Now (adds, then goes straight to checkout).
 * Prices and availability come from the catalog (the database), never props.
 */
export function PurchasePanel({
  product,
  variant,
  onVariantChange,
  selectorLabel,
  showVariantImages = false,
  className,
}: {
  product: CatalogProduct
  variant: CatalogVariant
  onVariantChange: (variantId: string) => void
  selectorLabel: string
  showVariantImages?: boolean
  className?: string
}) {
  const [quantity, setQuantity] = useState(1)
  const { add, quantityOf, maxQuantity } = useCart()
  const navigate = useNavigate()
  const room = Math.max(0, maxQuantity - quantityOf(variant.id))
  const canOrder = variant.orderable && room > 0
  // Never offer more than the bag can still take for this item.
  const qty = Math.min(quantity, Math.max(room, 1))
  const unit = containerLabel(variant.productType)

  return (
    <div className={cn('space-y-6', className)}>
      {product.variants.length > 1 && (
        <VariantSelector
          label={selectorLabel}
          variants={product.variants}
          value={variant.id}
          onChange={(id) => {
            onVariantChange(id)
            setQuantity(1)
          }}
          showImages={showVariantImages}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-2">Quantity</p>
          <p className="tabular mt-0.5 text-sm text-ink-3">
            {formatCedis(variant.price_pesewas)} {unit === 'Each' ? 'each' : `per ${unit.toLowerCase()}`}
          </p>
        </div>
        <QuantitySelector
          value={qty}
          onChange={setQuantity}
          max={Math.max(room, 1)}
          label={`Quantity of ${variant.displayName}`}
          disabled={!canOrder}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
        <AddToCartButton variant={variant} quantity={qty} label="Add to Cart" size="xl" onAdded={() => setQuantity(1)} />
        <Button
          size="xl"
          variant="secondary"
          disabled={!canOrder}
          trailingIcon={<ArrowRight aria-hidden="true" />}
          onClick={() => {
            add(variant.id, qty)
            navigate('/checkout')
          }}
        >
          Order Now
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-3">
        <StockBadge variant={variant} />
        {product.storage_note && (
          <span className="inline-flex items-center gap-1.5">
            <Snowflake className="size-4" aria-hidden="true" />
            {product.storage_note}
          </span>
        )}
        {room === 0 && variant.orderable && <span>You have the most we can take per order in your bag.</span>}
      </div>
    </div>
  )
}
