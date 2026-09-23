import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { KitchenMonogram } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { QuantityStepper } from '@/components/ui/controls'
import { Sheet } from '@/components/ui/dialog'
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback'
import { ProductImage } from '@/features/products/components'
import { useStoreSettings } from '@/features/products/queries'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'
import type { ResolvedCartItem } from './cart-logic'
import { useCart } from './cart-provider'

export function CartButton({ className }: { className?: string }) {
  const { itemCount, setDrawerOpen } = useCart()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('relative text-ink-2', className)}
      onClick={() => setDrawerOpen(true)}
      aria-label={itemCount ? `Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Open cart, empty'}
    >
      <ShoppingBag aria-hidden="true" />
      {itemCount > 0 && (
        <span className="tabular absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.68rem] font-bold text-primary-ink ring-2 ring-canvas">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Button>
  )
}

export function CartLineItem({ item, compact = false }: { item: ResolvedCartItem; compact?: boolean }) {
  const { setQuantity, remove, maxQuantity } = useCart()
  const { variant, line } = item
  const name = variant?.displayName ?? 'Item no longer available'
  return (
    <li className={cn('flex gap-3.5', !item.available && 'opacity-80')}>
      <ProductImage
        image={variant?.image}
        brandSlug={variant?.brand.slug}
        className={cn('shrink-0 rounded-2xl ring-1 ring-line', compact ? 'size-18' : 'size-22')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{name}</p>
            <p className="text-sm text-ink-3">
              {variant ? [variant.flavour ? variant.size_label : null, formatCedis(variant.price_pesewas) + ' each'].filter(Boolean).join(' · ') : 'Removed from the menu'}
            </p>
          </div>
          <p className="tabular shrink-0 font-display font-bold text-ink">{item.available ? formatCedis(item.lineTotal) : '—'}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          {item.available ? (
            <QuantityStepper
              size="sm"
              value={line.quantity}
              max={maxQuantity}
              onChange={(q) => setQuantity(line.variantId, q)}
              label={`Quantity of ${name}`}
            />
          ) : (
            <span className="text-sm font-semibold text-warning-text">{variant ? 'Sold out right now' : 'No longer available'}</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => remove(line.variantId)} aria-label={`Remove ${name}`} className="text-ink-3">
            <Trash2 aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Remove</span>
          </Button>
        </div>
      </div>
    </li>
  )
}

export function DeliveryFeeNote({ className }: { className?: string }) {
  const settings = useStoreSettings()
  if (!settings.data) return null
  if (settings.data.delivery_fee_mode === 'FLAT' && settings.data.flat_delivery_fee_pesewas !== null) {
    return <p className={cn('text-sm text-ink-3', className)}>Delivery: {formatCedis(settings.data.flat_delivery_fee_pesewas)} per order, added at checkout.</p>
  }
  return (
    <p className={cn('text-sm text-ink-3', className)}>
      Delivery fee is confirmed for your exact location after you order. Anything added after payment is collected on delivery.
    </p>
  )
}

export function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const cart = useCart()
  const navigate = useNavigate()

  if (cart.isLoading && cart.lines.length > 0) {
    return (
      <div className="space-y-4 p-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3.5">
            <Skeleton className="size-22 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="ZOBOPOP and Creamypop are a tap away."
        action={
          <Button
            onClick={() => {
              onNavigate?.()
              navigate('/order')
            }}
          >
            Browse the menu
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-5 p-5 sm:p-6">
      {cart.hasUnavailable && (
        <Notice tone="warning" title="Some items can’t be ordered right now">
          They’re left out of your total. Remove them to tidy up your cart.
        </Notice>
      )}
      <ul className="space-y-5">
        {cart.items.map((item) => (
          <CartLineItem key={item.line.variantId} item={item} compact />
        ))}
      </ul>
    </div>
  )
}

export function CartTotals({ className }: { className?: string }) {
  const { subtotal, itemCount } = useCart()
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink-2">
          Subtotal · {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="tabular font-display text-xl font-bold text-ink">{formatCedis(subtotal)}</span>
      </div>
      <DeliveryFeeNote />
    </div>
  )
}

export function CartDrawer() {
  const cart = useCart()
  const navigate = useNavigate()
  const close = () => cart.setDrawerOpen(false)
  return (
    <Sheet
      open={cart.drawerOpen}
      onOpenChange={cart.setDrawerOpen}
      title="Your cart"
      description={cart.itemCount ? `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'} from SCOTCH’s Kitchen` : undefined}
      footer={
        cart.lines.length > 0 ? (
          <div className="space-y-3 pb-1">
            <CartTotals />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  close()
                  navigate('/cart')
                }}
              >
                View cart
              </Button>
              <Button
                disabled={cart.itemCount === 0}
                trailingIcon={<ArrowRight aria-hidden="true" />}
                onClick={() => {
                  close()
                  navigate('/checkout')
                }}
              >
                Checkout
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <CartContents onNavigate={close} />
    </Sheet>
  )
}

const PILL_HIDDEN_ON = ['/order', '/cart', '/checkout']

/** Desktop floating order pill (bottom centre), after the Pizzaman Chickenman pattern. */
export function FloatingOrderPill() {
  const { itemCount, subtotal, setDrawerOpen } = useCart()
  const { pathname } = useLocation()
  if (PILL_HIDDEN_ON.some((p) => pathname.startsWith(p))) return null

  const content = (
    <>
      <KitchenMonogram className="size-10 rounded-full" />
      <span className="flex flex-col items-start pr-2 leading-tight">
        <span className="font-display text-[1.02rem] font-bold text-ink">{itemCount ? 'View your cart' : 'Order now'}</span>
        <span className="tabular text-xs font-medium text-ink-3">
          {itemCount ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${formatCedis(subtotal)}` : 'ZOBOPOP & Creamypop'}
        </span>
      </span>
      <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-ink transition-transform group-hover:translate-x-0.5">
        <ArrowRight className="size-5" aria-hidden="true" />
      </span>
    </>
  )

  const classes =
    'group glass fixed bottom-6 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-1.5 shadow-float transition-shadow hover:shadow-lift lg:flex focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'

  return itemCount ? (
    <button type="button" className={classes} onClick={() => setDrawerOpen(true)}>
      {content}
    </button>
  ) : (
    <Link to="/order" className={classes}>
      {content}
    </Link>
  )
}

/** Mobile sticky "view cart" bar that sits above the bottom navigation. */
export function MobileCartBar() {
  const { itemCount, subtotal } = useCart()
  if (!itemCount) return null
  return (
    <div className="fixed inset-x-0 bottom-[4.6rem] z-30 px-3 lg:hidden">
      <Link
        to="/cart"
        className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 rounded-full bg-ink pr-2 pl-5 text-canvas shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="tabular text-sm font-semibold">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatCedis(subtotal)}
        </span>
        <span className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-ink">
          View cart <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  )
}
