import { ChevronDown } from 'lucide-react'
import { ProductImage } from '@/features/products/components'
import type { ResolvedCartItem } from '@/features/cart/cart-logic'
import type { StoreSettings } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'

export function deliveryFeeFor(settings: StoreSettings | null | undefined) {
  if (settings?.delivery_fee_mode === 'FLAT' && settings.flat_delivery_fee_pesewas !== null) {
    return { mode: 'FLAT' as const, amount: settings.flat_delivery_fee_pesewas }
  }
  return { mode: 'QUOTE' as const, amount: 0 }
}

export function SummaryLines({ items, subtotal, settings }: { items: ResolvedCartItem[]; subtotal: number; settings: StoreSettings | null | undefined }) {
  const fee = deliveryFeeFor(settings)
  const available = items.filter((i) => i.available && i.variant)
  return (
    <div className="space-y-5">
      <ul className="space-y-4">
        {available.map(({ variant, line, lineTotal }) =>
          variant ? (
            <li key={line.variantId} className="flex items-center gap-3">
              <div className="relative">
                <ProductImage image={variant.image} brandSlug={variant.brand.slug} className="size-14 rounded-2xl ring-1 ring-line" />
                <span className="tabular absolute -top-1.5 -right-1.5 grid size-5.5 place-items-center rounded-full bg-ink text-[0.68rem] font-bold text-canvas">
                  {line.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{variant.displayName}</p>
                <p className="text-xs text-ink-3">
                  {line.quantity} × {formatCedis(variant.price_pesewas)}
                </p>
              </div>
              <p className="tabular text-sm font-bold text-ink">{formatCedis(lineTotal)}</p>
            </li>
          ) : null,
        )}
      </ul>
      <dl className="space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-2">Subtotal</dt>
          <dd className="tabular font-semibold text-ink">{formatCedis(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Delivery fee</dt>
          <dd className="tabular text-right font-semibold text-ink">{fee.mode === 'FLAT' ? formatCedis(fee.amount) : 'Confirmed after ordering'}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <dt className="font-semibold text-ink">{fee.mode === 'FLAT' ? 'Total' : 'Pay now'}</dt>
          <dd className="tabular font-display text-2xl font-bold text-ink">{formatCedis(subtotal + fee.amount)}</dd>
        </div>
      </dl>
      {fee.mode === 'QUOTE' && (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-2">
          The kitchen confirms your delivery fee for your exact pin. Because it’s set after you pay, it’s shown on your order as a delivery
          balance and collected on delivery. Your card or mobile money is only charged the amount above.
        </p>
      )}
    </div>
  )
}

/** Collapsible order summary for phones. */
export function MobileSummary(props: { items: ResolvedCartItem[]; subtotal: number; settings: StoreSettings | null | undefined; className?: string }) {
  return (
    <details className={cn('group rounded-3xl border border-line bg-surface shadow-soft lg:hidden', props.className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold text-ink">Order summary</span>
        <span className="flex items-center gap-2">
          <span className="tabular font-display font-bold text-ink">{formatCedis(props.subtotal + deliveryFeeFor(props.settings).amount)}</span>
          <ChevronDown className="size-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-line px-5 py-5">
        <SummaryLines items={props.items} subtotal={props.subtotal} settings={props.settings} />
      </div>
    </details>
  )
}
