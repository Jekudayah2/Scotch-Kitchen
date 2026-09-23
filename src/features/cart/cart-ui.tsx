import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { QuantitySelector } from '@/components/ui/controls'
import { Sheet } from '@/components/ui/dialog'
import { Notice, Skeleton } from '@/components/ui/feedback'
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
      className={cn('relative text-ink-2 hover:translate-y-0', className)}
      onClick={() => setDrawerOpen(true)}
      aria-label={itemCount ? `Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Open cart, empty'}
    >
      <ShoppingBag aria-hidden="true" />
      {itemCount > 0 && (
        <span
          key={itemCount}
          className="tabular absolute -top-0.5 -right-0.5 grid h-5 min-w-5 animate-bump place-items-center rounded-full bg-red px-1 text-[0.68rem] font-bold text-white ring-2 ring-canvas motion-reduce:animate-none"
        >
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
        brandName={variant?.brand.name}
        className={cn('shrink-0 rounded-[0.9rem] ring-1 ring-line', compact ? 'size-20' : 'size-24')}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{name}</p>
            <p className="text-sm text-ink-3">
              {variant
                ? [variant.flavour ? variant.size_label : null, `${formatCedis(variant.price_pesewas)} each`].filter(Boolean).join(' · ')
                : 'Removed from the menu'}
            </p>
          </div>
          <p className="tabular shrink-0 font-display text-[1.05rem] font-bold text-ink">{item.available ? formatCedis(item.lineTotal) : '—'}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          {item.available ? (
            <QuantitySelector
              size="sm"
              value={line.quantity}
              max={maxQuantity}
              onChange={(q) => setQuantity(line.variantId, q)}
              label={`Quantity of ${name}`}
            />
          ) : (
            <span className="text-sm font-semibold text-warning-text">{variant ? 'Sold out right now' : 'No longer available'}</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => remove(line.variantId)} aria-label={`Remove ${name}`} className="text-ink-3" leadingIcon={<Trash2 aria-hidden="true" />}>
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
      Your delivery fee is confirmed for your exact pin after you order. If it’s set after you pay, it’s collected on delivery.
    </p>
  )
}

/** "Your kitchen bag is empty." */
export function EmptyBag({ onBrowse, showAction = true }: { onBrowse?: () => void; showAction?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-[1.25rem] bg-primary-soft text-primary-text">
        <ShoppingBag className="size-7" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="font-display text-xl font-bold text-ink">Your kitchen bag is empty.</p>
        <p className="text-ink-3">Add something refreshing.</p>
      </div>
      {showAction && (
        <Button
          onClick={() => {
            onBrowse?.()
            navigate('/order')
          }}
        >
          Browse Products
        </Button>
      )}
    </div>
  )
}

export function CartContents({ onNavigate, emptyAction = true }: { onNavigate?: () => void; emptyAction?: boolean }) {
  const cart = useCart()

  if (cart.isLoading && cart.lines.length > 0) {
    return (
      <div className="space-y-5 p-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3.5">
            <Skeleton className="size-20 rounded-[0.9rem]" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-3 h-10 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (cart.lines.length === 0) return <EmptyBag onBrowse={onNavigate} showAction={emptyAction} />

  return (
    <div className="space-y-5 p-5 sm:p-6">
      {cart.hasUnavailable && (
        <Notice tone="warning" title="Some items can’t be ordered right now">
          They’re left out of your total. Remove them to tidy up your bag.
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
        <span className="tabular font-display text-2xl font-bold text-ink">{formatCedis(subtotal)}</span>
      </div>
      <DeliveryFeeNote />
    </div>
  )
}

/** Desktop slide-over / mobile bottom sheet. */
export function CartDrawer() {
  const cart = useCart()
  const navigate = useNavigate()
  const close = () => cart.setDrawerOpen(false)
  return (
    <Sheet
      open={cart.drawerOpen}
      onOpenChange={cart.setDrawerOpen}
      glass
      title="Your kitchen bag"
      description={cart.itemCount ? `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'}` : undefined}
      footer={
        cart.lines.length > 0 ? (
          <div className="space-y-3 pb-1">
            <CartTotals />
            <Button
              size="lg"
              className="w-full"
              disabled={cart.itemCount === 0}
              trailingIcon={<ArrowRight aria-hidden="true" />}
              onClick={() => {
                close()
                navigate('/checkout')
              }}
            >
              Continue to Checkout
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                close()
                navigate('/cart')
              }}
            >
              View full cart
            </Button>
          </div>
        ) : undefined
      }
    >
      <CartContents onNavigate={close} />
    </Sheet>
  )
}

const SUMMARY_HIDDEN_ON = ['/order', '/cart', '/checkout']

/** Floating order summary (desktop only, only when the bag has items). */
export function FloatingOrderSummary() {
  const { itemCount, subtotal, items, setDrawerOpen } = useCart()
  const { pathname } = useLocation()
  if (!itemCount || SUMMARY_HIDDEN_ON.some((p) => pathname.startsWith(p))) return null
  const thumbs = items.filter((i) => i.available && i.variant).slice(0, 3)

  return (
    <div className="glass fixed right-6 bottom-6 z-30 hidden animate-rise-in items-center gap-4 rounded-[1.25rem] py-2.5 pr-2.5 pl-3 shadow-float lg:flex">
      <div className="flex -space-x-3">
        {thumbs.map(({ variant, line }) =>
          variant ? (
            <ProductImage key={line.variantId} image={variant.image} brandSlug={variant.brand.slug} className="size-10 rounded-full ring-2 ring-surface" />
          ) : null,
        )}
      </div>
      <button type="button" onClick={() => setDrawerOpen(true)} className="text-left focus-visible:outline-2 focus-visible:outline-ring">
        <span className="block text-sm font-bold text-ink">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} in your bag
        </span>
        <span className="tabular block text-xs font-semibold text-ink-3">Subtotal {formatCedis(subtotal)}</span>
      </button>
      <Button asChild size="md" trailingIcon={<ArrowRight aria-hidden="true" />}>
        <Link to="/checkout">Checkout</Link>
      </Button>
    </div>
  )
}
