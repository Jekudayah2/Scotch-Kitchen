import { ArrowRight, RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import type { OrderWithItems } from '@/features/orders/api'
import { OrderStatusBadge, PaymentStatusBadge, useOrderAgain } from '@/features/orders/components'
import { isActiveOrder, paymentSummary } from '@/features/orders/status'
import { ProductImage } from '@/features/products/components'
import { formatDateTime } from '@/utils/dates'
import { formatCedis } from '@/utils/money'

/** One order in the customer's list: status, what was ordered, what it cost, what to do next. */
export function OrderCard({ order }: { order: OrderWithItems }) {
  const orderAgain = useOrderAgain()
  const active = isActiveOrder(order)
  const money = paymentSummary(order)
  const items = order.order_items
  const lead = items.slice(0, 2).map((i) => `${i.product_name} · ${i.variant_name} ×${i.quantity}`)
  const more = items.length - lead.length

  return (
    <article className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`/track-order/${order.order_reference}`}
            className="rounded-md font-mono text-base font-bold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {order.order_reference}
          </Link>
          <p className="text-sm text-ink-3">{formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <OrderStatusBadge status={order.order_status} size="sm" />
          {order.payment_status !== 'PAID' && order.order_status !== 'CANCELLED' && <PaymentStatusBadge status={order.payment_status} size="sm" />}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex shrink-0 -space-x-3">
          {items.slice(0, 3).map((item) => (
            <ProductImage
              key={item.id}
              image={item.image_url ? { url: item.image_url, alt_text: '' } : null}
              className="size-11 rounded-full ring-2 ring-surface"
            />
          ))}
        </div>
        <p className="min-w-0 flex-1 text-sm text-ink-2">
          {lead.join(', ')}
          {more > 0 && <span className="text-ink-3"> and {more} more</span>}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-ink-3">
          Total <span className="tabular font-display text-lg font-bold text-ink">{formatCedis(money.grandTotal)}</span>
          {money.outstanding > 0 && <span className="ml-2 font-semibold text-warning-text">{formatCedis(money.outstanding)} to pay</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {!active && items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => orderAgain(items)} leadingIcon={<RotateCcw aria-hidden="true" />}>
              Order again
            </Button>
          )}
          <Button asChild size="sm" variant={active ? 'primary' : 'secondary'} trailingIcon={<ArrowRight aria-hidden="true" />}>
            <Link to={`/track-order/${order.order_reference}`}>{active ? 'Track' : 'View'}</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
