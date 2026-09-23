import { ArrowLeft, MapPin, PackageX, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/field'
import { isStoreLocationConfigured, store } from '@/config/store'
import { LazyMap, type MapMarkerSpec } from '@/features/maps/lazy-map'
import { OrderItemsList, OrderStatusBadge } from '@/features/orders/components'
import { useStoreSettings } from '@/features/products/queries'
import { riderActions, useRiderDelivery, type RiderDelivery } from '@/features/rider/api'
import { balanceDue, DeliveryActions, useRiderMutation } from '@/features/rider/components'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatDateTime } from '@/utils/dates'
import { formatAccuracy, formatCoordinates, isValidLatLng } from '@/utils/geo'
import { formatCedis, parseCedisInput } from '@/utils/money'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="eyebrow mb-3 text-ink-3">{title}</h2>
      {children}
    </section>
  )
}

/** Riders may propose (or, if the kitchen allows, set) a delivery fee from the road. */
function FeeForm({ order }: { order: RiderDelivery }) {
  const settings = useStoreSettings()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const permission = settings.data?.rider_fee_permission ?? 'NONE'
  const paid = order.payment_status === 'PAID'
  const submit = useRiderMutation(
    (p: number) => riderActions.setCharge(order.id, p, note),
    permission === 'SET' ? (paid ? 'Delivery balance set.' : 'Delivery fee set.') : 'Sent to the kitchen for approval.',
  )
  const pesewas = parseCedisInput(amount)
  if (permission === 'NONE' || order.order_status === 'DELIVERED' || order.order_status === 'CANCELLED') return null
  return (
    <Section title={permission === 'SET' ? 'Delivery fee' : 'Propose a delivery fee'}>
      <p className="mb-3 text-sm text-ink-3">
        {paid ? 'The order is paid, so this becomes a balance you collect on delivery.' : 'This is added to what the customer pays.'}
        {permission === 'PROPOSE' && ' The kitchen approves it first.'}
      </p>
      <form
        className="grid grid-cols-[7rem_1fr] gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (pesewas !== null) submit.mutate(pesewas, { onSuccess: () => (setAmount(''), setNote('')) })
        }}
      >
        <Input inputMode="decimal" aria-label="Amount in cedis" placeholder="GH₵ 0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input aria-label="Reason (optional)" placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        <Button type="submit" variant="secondary" className="col-span-2" disabled={pesewas === null} loading={submit.isPending}>
          {permission === 'SET' ? 'Save fee' : 'Send proposal'}
        </Button>
      </form>
    </Section>
  )
}

export default function RiderDeliveryPage() {
  const { id = '' } = useParams()
  const delivery = useRiderDelivery(id)
  const order = delivery.data
  useDocumentTitle(order ? `Delivery ${order.order_reference}` : 'Delivery')

  if (delivery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading delivery">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    )
  }
  if (delivery.isError) return <ErrorState error={delivery.error} onRetry={() => void delivery.refetch()} />
  if (!order) {
    return (
      <EmptyState
        icon={PackageX}
        title="This delivery isn’t available"
        description="It may have been given to another rider, or it was completed more than a day ago."
        action={
          <Button asChild variant="secondary">
            <Link to="/rider/deliveries">My deliveries</Link>
          </Button>
        }
      />
    )
  }

  const point = { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
  const markers: MapMarkerSpec[] = [
    ...(isStoreLocationConfigured && store.location ? [{ id: 'store', kind: 'store' as const, position: store.location, label: `${store.name} kitchen` }] : []),
    ...(isValidLatLng(point) ? [{ id: 'destination', kind: 'confirmed' as const, position: point, label: `Delivery destination: ${order.delivery_address}` }] : []),
  ]
  const due = balanceDue(order)

  return (
    <div className="space-y-4">
      <Link to="/rider/deliveries" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Deliveries
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-2xl font-bold text-ink">{order.order_reference}</h1>
        <OrderStatusBadge status={order.order_status} audience="staff" />
      </div>

      {isValidLatLng(point) && (
        <LazyMap
          className="h-64 w-full ring-1 ring-line sm:h-80"
          ariaLabel="Map of the delivery destination"
          markers={markers}
          initialCenter={point}
          initialZoom={16}
          fitKey={markers.length > 1 ? 'both' : undefined}
        />
      )}

      <DeliveryActions order={order} />

      <Section title="Deliver to">
        <p className="flex items-start gap-2 font-display text-lg leading-snug font-bold text-ink">
          <MapPin className="mt-1 size-4.5 shrink-0 text-primary-text" aria-hidden="true" />
          {order.delivery_address}
        </p>
        {order.delivery_landmark && <p className="mt-1 pl-6.5 text-ink-2">Landmark: {order.delivery_landmark}</p>}
        {order.delivery_instructions && (
          <p className="mt-2 flex items-start gap-2 rounded-[0.8rem] bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-text">
            <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {order.delivery_instructions}
          </p>
        )}
        {isValidLatLng(point) && (
          <p className="mt-2 font-mono text-xs text-ink-3">
            {formatCoordinates(point)} · {formatAccuracy(order.delivery_location_accuracy)}
          </p>
        )}
        <p className="mt-3 text-sm text-ink-2">
          For <span className="font-semibold text-ink">{order.contact_name}</span> ·{' '}
          <a href={`tel:${order.contact_phone.replace(/\s/g, '')}`} className="font-semibold text-primary-text underline-offset-4 hover:underline">
            {order.contact_phone}
          </a>
        </p>
      </Section>

      <Section title="Money">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">Paid online</dt>
            <dd className="tabular font-semibold text-ink">{formatCedis(order.amount_paid_pesewas)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-2">
            <dt className="font-semibold text-ink">Collect on delivery</dt>
            <dd className={`tabular font-display text-xl font-extrabold ${due > 0 ? 'text-warning-text' : 'text-success-text'}`}>{due > 0 ? formatCedis(due) : 'Nothing'}</dd>
          </div>
          {order.delivery_balance_collected_at && <p className="text-xs text-ink-3">Balance collected {formatDateTime(order.delivery_balance_collected_at)}.</p>}
        </dl>
      </Section>

      <Section title="Hand over">
        <OrderItemsList items={order.order_items} compact />
      </Section>

      <FeeForm order={order} />
    </div>
  )
}
