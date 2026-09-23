import { ArrowRight, Bike, CreditCard, Leaf, MapPin, MapPinned, Radio, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { store } from '@/config/store'
import type { CatalogVariant } from '@/features/products/catalog'
import { useStoreSettings } from '@/features/products/queries'
import { QuickAddTile } from '@/features/products/variant-card'
import { formatCedis } from '@/utils/money'
import { Reveal } from './motion'
import { SectionHeader } from './section-header'

// ---------------------------------------------------------------------------
// Why SCOTCH's Kitchen: three promises the product actually keeps.
// ---------------------------------------------------------------------------
const REASONS = [
  {
    icon: Leaf,
    title: 'Fresh products',
    body: 'Made by SCOTCH’s Kitchen: a Ghanaian hibiscus recipe for ZOBOPOP and real milk for Creamypop.',
  },
  {
    icon: ShoppingBag,
    title: 'Easy ordering',
    body: 'Pick your drinks and treats, drop your delivery pin and pay securely with Paystack in a few taps.',
  },
  {
    icon: Bike,
    title: 'Reliable delivery',
    body: 'Your order goes to the exact pin you drop, and you can follow every step until it’s delivered.',
  },
]

export function WhySection() {
  return (
    <section aria-labelledby="why-title" className="container-page py-16 sm:py-20 lg:py-28">
      <Reveal>
        <SectionHeader id="why-title" eyebrow="Why SCOTCH’s Kitchen" title="Fresh, easy, delivered." />
      </Reveal>
      <ul className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14 lg:gap-5">
        {REASONS.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 0.07} className="h-full">
              <div className="flex h-full flex-col rounded-card border border-line bg-surface p-6 sm:p-7">
                <span className="grid size-12 place-items-center rounded-control bg-primary-soft text-primary-text">
                  <Icon className="size-5.5" aria-hidden="true" />
                </span>
                <h3 className="mt-6 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">{title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Order CTA: every product one tap from the bag.
// ---------------------------------------------------------------------------
export function OrderBand({ variants, loading }: { variants: CatalogVariant[]; loading: boolean }) {
  return (
    <section aria-labelledby="order-band-title" className="container-page pb-16 sm:pb-20 lg:pb-28">
      <div className="rounded-media border border-line bg-surface-2 p-5 sm:p-8 lg:p-10">
        <Reveal>
          <SectionHeader
            id="order-band-title"
            eyebrow="Order"
            title="Ready when you are."
            description="Add your favourites here, or open the full order page."
            action={
              <Button asChild size="lg" variant="secondary" trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link to="/order">Go to Order</Link>
              </Button>
            }
          />
        </Reveal>
        <ul className="mt-8 grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {loading
            ? [0, 1, 2, 3].map((i) => (
                <li key={i}>
                  <Skeleton className="h-64 rounded-card" />
                </li>
              ))
            : variants.map((variant, i) => (
                <li key={variant.id}>
                  <Reveal delay={i * 0.05} className="h-full">
                    <QuickAddTile variant={variant} />
                  </Reveal>
                </li>
              ))}
        </ul>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Delivery: how it works, and how the fee is set (straight from store settings).
// ---------------------------------------------------------------------------
const STEPS = [
  { icon: MapPin, title: 'Drop your pin', body: 'Use your location, search for a place or tap the map, then add a landmark so your rider finds you.' },
  { icon: CreditCard, title: 'Pay securely', body: 'Checkout runs through Paystack. Your order is confirmed only after Paystack confirms the payment.' },
  { icon: Radio, title: 'Track to your door', body: 'Follow your order live, from preparing to on the way to delivered.' },
]

function DeliveryFeeCopy() {
  const settings = useStoreSettings()
  if (settings.isPending) return <Skeleton className="mt-5 h-12 w-full max-w-md" />
  const data = settings.data
  if (data?.delivery_fee_mode === 'FLAT' && data.flat_delivery_fee_pesewas !== null) {
    return (
      <p className="mt-5 max-w-md leading-relaxed text-ink-2">
        Delivery is <strong className="tabular font-semibold text-ink">{formatCedis(data.flat_delivery_fee_pesewas)}</strong> per order, shown at
        checkout before you pay.
      </p>
    )
  }
  return (
    <p className="mt-5 max-w-md leading-relaxed text-ink-2">
      Your delivery fee is confirmed for your exact pin after you order. If it’s set after you’ve paid, you settle it with your rider on delivery.
    </p>
  )
}

export function DeliverySection() {
  return (
    <section aria-labelledby="delivery-title" className="border-t border-line bg-surface-2/60">
      <div className="container-page grid gap-12 py-16 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-28">
        <Reveal>
          <p className="eyebrow text-primary-text">Delivery</p>
          <h2 id="delivery-title" className="display-lg mt-3 text-ink">
            From our kitchen to your pin.
          </h2>
          {store.areaLabel && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-control bg-surface px-3 py-2 text-sm font-semibold text-ink-2 ring-1 ring-line">
              <MapPinned className="size-4 text-primary-text" aria-hidden="true" />
              Delivering around {store.areaLabel}
            </p>
          )}
          <DeliveryFeeCopy />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <Link to="/order">Order Now</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/track-order">Track an order</Link>
            </Button>
          </div>
        </Reveal>

        <ol className="grid gap-3 sm:gap-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 0.07}>
                <div className="flex gap-5 rounded-card border border-line bg-surface p-5 sm:p-6">
                  <span className="tabular condensed font-display text-4xl leading-none font-extrabold text-primary-text" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-[-0.02em] text-ink">
                      <Icon className="size-5 text-ink-3" aria-hidden="true" />
                      {title}
                    </h3>
                    <p className="mt-1.5 leading-relaxed text-ink-2">{body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
