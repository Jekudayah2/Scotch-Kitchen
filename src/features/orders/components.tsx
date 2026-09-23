import { Check, CircleDot, MapPin, Navigation, StickyNote, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { useCart } from '@/features/cart/cart-provider'
import { LazyMap } from '@/features/maps/lazy-map'
import { ProductImage } from '@/features/products/components'
import { useCatalog } from '@/features/products/queries'
import type { Order, OrderEvent, OrderItem, OrderStatus, PaymentStatus } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatDateTime, formatTime } from '@/utils/dates'
import { formatAccuracy, formatCoordinates, isValidLatLng } from '@/utils/geo'
import { formatCedis } from '@/utils/money'
import { buildTimeline, PAYMENT_META, paymentSummary, STATUS_META } from './status'

export function OrderStatusBadge({ status, audience = 'customer', size }: { status: OrderStatus; audience?: 'customer' | 'staff'; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <Badge tone={meta.tone} size={size}>
      <Icon aria-hidden="true" />
      {audience === 'customer' ? meta.customerLabel : meta.label}
    </Badge>
  )
}

export function PaymentStatusBadge({ status, size }: { status: PaymentStatus; size?: 'sm' | 'md' }) {
  const meta = PAYMENT_META[status]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

export function OrderTimeline({ order, events }: { order: Order; events: OrderEvent[] }) {
  const steps = buildTimeline(order, events)
  return (
    <ol className="relative space-y-0" aria-label="Order progress">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className={cn('absolute top-8 bottom-0 left-[15px] w-0.5', step.state === 'done' ? 'bg-success' : 'border-l-2 border-dashed border-line-strong')}
              />
            )}
            <span
              className={cn(
                'relative z-10 grid size-8 shrink-0 place-items-center rounded-full',
                step.state === 'done' && 'bg-success text-white',
                step.state === 'current' && 'bg-primary text-primary-ink ring-4 ring-primary-soft',
                step.state === 'upcoming' && 'bg-surface-2 text-ink-3 ring-1 ring-line',
                step.state === 'cancelled' && 'bg-danger-soft text-danger-text',
              )}
            >
              {step.state === 'done' ? (
                <Check className="size-4" aria-hidden="true" />
              ) : step.state === 'cancelled' ? (
                <XCircle className="size-4" aria-hidden="true" />
              ) : (
                <CircleDot className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn('font-semibold', step.state === 'upcoming' ? 'text-ink-3' : 'text-ink')}>
                {step.label}
                {step.state === 'current' && <span className="sr-only"> (current step)</span>}
              </p>
              {step.at && <p className="text-sm text-ink-3">{formatDateTime(step.at)}</p>}
              {step.note && <p className="mt-1 text-sm text-ink-2">{step.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function OrderItemsList({ items, compact = false }: { items: OrderItem[]; compact?: boolean }) {
  return (
    <ul className={cn('divide-y divide-line', compact ? '' : '-my-3')}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3.5 py-3">
          <ProductImage
            image={item.image_url ? { url: item.image_url, alt_text: `${item.product_name} ${item.variant_name}` } : null}
            className={cn('shrink-0 rounded-2xl ring-1 ring-line', compact ? 'size-12' : 'size-16')}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">
              {item.product_name} · {item.variant_name}
            </p>
            <p className="text-sm text-ink-3">
              {item.quantity} × {formatCedis(item.unit_price_pesewas)}
              {item.size_label && item.flavour ? ` · ${item.size_label}` : ''}
            </p>
          </div>
          <p className="tabular font-semibold text-ink">{formatCedis(item.line_total_pesewas)}</p>
        </li>
      ))}
    </ul>
  )
}

export function PaymentSummaryCard({ order }: { order: Order }) {
  const money = paymentSummary(order)
  const quotePending = order.delivery_fee_status === 'QUOTE_PENDING'
  return (
    <dl className="space-y-2.5 text-sm">
      <Row label="Items" value={formatCedis(order.subtotal_pesewas)} />
      <Row label="Delivery fee" value={quotePending ? 'To be confirmed' : formatCedis(order.delivery_fee_pesewas)} />
      <Row label="Order total (charged)" value={formatCedis(money.originalCharge)} strong />
      <Row label="Paid via Paystack" value={formatCedis(money.paid)} />
      {money.balance > 0 && (
        <Row
          label="Delivery balance"
          value={`${formatCedis(money.balance)}${money.balanceCollected ? ' · collected' : ' · due on delivery'}`}
          hint="Added after payment. Your original payment is unchanged."
        />
      )}
      <div className="mt-1 flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-3">
        <dt className="font-semibold text-ink">Outstanding</dt>
        <dd className={cn('tabular font-display text-xl font-bold', money.outstanding > 0 ? 'text-warning-text' : 'text-success-text')}>
          {formatCedis(money.outstanding)}
        </dd>
      </div>
    </dl>
  )
}

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className={cn(strong ? 'font-semibold text-ink' : 'text-ink-2')}>{label}</dt>
        <dd className={cn('tabular text-right', strong ? 'font-bold text-ink' : 'font-semibold text-ink')}>{value}</dd>
      </div>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

export function DeliveryDestination({ order, showMap = true }: { order: Order; showMap?: boolean }) {
  const point = { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
  const valid = isValidLatLng(point)
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="flex items-start gap-2 font-semibold text-ink">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden="true" />
          {order.delivery_address}
        </p>
        {order.delivery_landmark && <p className="pl-6 text-sm text-ink-2">Landmark: {order.delivery_landmark}</p>}
        {order.delivery_instructions && (
          <p className="flex items-start gap-2 pl-0 text-sm text-ink-2">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
            {order.delivery_instructions}
          </p>
        )}
        {valid && (
          <p className="flex items-center gap-2 font-mono text-xs text-ink-3">
            <Navigation className="size-3.5" aria-hidden="true" />
            {formatCoordinates(point)} · {formatAccuracy(order.delivery_location_accuracy)}
          </p>
        )}
      </div>
      {showMap && valid && (
        <LazyMap
          className="h-56 w-full ring-1 ring-line"
          ariaLabel="Delivery destination map"
          initialCenter={point}
          initialZoom={16}
          markers={[{ id: 'destination', position: point, kind: 'confirmed', label: `Delivery destination: ${order.delivery_address}` }]}
        />
      )}
    </div>
  )
}

export function lastUpdate(order: Order) {
  return `Updated ${formatTime(order.updated_at)}`
}

/** Re-adds a past order's items at TODAY's prices, skipping anything unavailable. */
export function useOrderAgain() {
  const cart = useCart()
  const catalog = useCatalog()
  const navigate = useNavigate()
  return (items: OrderItem[]) => {
    let added = 0
    let skipped = 0
    for (const item of items) {
      const variant = item.variant_id ? catalog.data?.variantById.get(item.variant_id) : undefined
      if (variant?.orderable) {
        cart.add(variant.id, item.quantity)
        added += 1
      } else skipped += 1
    }
    if (added === 0) {
      toast.error('Those items aren’t available right now.')
      return
    }
    toast.success(skipped ? `Added ${added} item${added > 1 ? 's' : ''}. ${skipped} ${skipped > 1 ? 'aren’t' : 'isn’t'} available right now.` : 'Added to your cart at today’s prices.')
    navigate('/cart')
  }
}
