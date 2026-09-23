import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, Bike, Check, ChevronRight, Navigation, Phone } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/controls'
import { ConfirmDialog } from '@/components/ui/dialog'
import { OrderStatusBadge } from '@/features/orders/components'
import { paymentSummary } from '@/features/orders/status'
import type { RiderAvailability } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'
import { formatCedis } from '@/utils/money'
import { directionsUrl, riderActions, riderKeys, useMyRiderProfile, type RiderDelivery } from './api'

export function useRiderMutation<T>(fn: (arg: T) => Promise<unknown>, success: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: riderKeys.all })
    },
    onError: (error) => toast.error(friendlyError(error)),
  })
}

export function AvailabilityControl({ className }: { className?: string }) {
  const profile = useMyRiderProfile()
  const change = useRiderMutation((value: RiderAvailability) => riderActions.setAvailability(value), 'Availability updated.')
  return (
    <SegmentedControl
      className={cn('w-full [&>*]:flex-1', className)}
      label="Your availability"
      value={(profile.data?.availability ?? 'OFFLINE') as RiderAvailability}
      onChange={(v) => change.mutate(v)}
      options={[
        { value: 'AVAILABLE', label: 'Available' },
        { value: 'BUSY', label: 'Busy' },
        { value: 'OFFLINE', label: 'Offline' },
      ]}
    />
  )
}

/** Balance still to collect on delivery (never the amount already paid online). */
export function balanceDue(order: RiderDelivery) {
  return paymentSummary(order).balance > 0 && !order.delivery_balance_collected_at ? order.delivery_balance_pesewas : 0
}

/** The next physical step for the rider, as big thumb-sized buttons. */
export function DeliveryActions({ order, compact = false }: { order: RiderDelivery; compact?: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const start = useRiderMutation(() => riderActions.start(order.id), 'Delivery started. Safe riding!')
  const delivered = useRiderMutation(() => riderActions.delivered(order.id), 'Marked as delivered. Nice work!')
  const collect = useRiderMutation(() => riderActions.collectBalance(order.id), 'Balance marked as collected.')
  const due = balanceDue(order)
  const size = compact ? 'md' : 'lg'

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" size={size} leadingIcon={<Navigation aria-hidden="true" />}>
          <a href={directionsUrl(order)} target="_blank" rel="noreferrer">
            Directions
          </a>
        </Button>
        <Button asChild variant="secondary" size={size} leadingIcon={<Phone aria-hidden="true" />}>
          <a href={`tel:${order.contact_phone.replace(/\s/g, '')}`}>Call</a>
        </Button>
      </div>
      {order.order_status === 'ASSIGNED' && (
        <Button size={size} className="w-full" onClick={() => start.mutate(undefined)} loading={start.isPending} leadingIcon={<Bike aria-hidden="true" />}>
          Picked up: start delivery
        </Button>
      )}
      {(order.order_status === 'PREPARING' || order.order_status === 'READY') && (
        <p className="rounded-[0.8rem] bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink-2">
          {order.order_status === 'PREPARING' ? 'Still in the kitchen. You’ll be able to start once it’s ready.' : 'Ready at the kitchen.'}
        </p>
      )}
      {due > 0 && order.order_status === 'OUT_FOR_DELIVERY' && (
        <Button size={size} variant="soft" className="w-full" onClick={() => collect.mutate(undefined)} loading={collect.isPending} leadingIcon={<Banknote aria-hidden="true" />}>
          Collected {formatCedis(due)} balance
        </Button>
      )}
      {order.order_status === 'OUT_FOR_DELIVERY' && (
        <Button size={size} className="w-full" onClick={() => setConfirming(true)} leadingIcon={<Check aria-hidden="true" />}>
          Mark delivered
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delivered ${order.order_reference}?`}
        description={
          due > 0
            ? `Check you’ve handed everything to ${order.contact_name.split(' ')[0]} and collected the ${formatCedis(due)} delivery balance.`
            : `Check you’ve handed everything to ${order.contact_name.split(' ')[0]}.`
        }
        confirmLabel="Yes, delivered"
        loading={delivered.isPending}
        onConfirm={() => delivered.mutate(undefined, { onSuccess: () => setConfirming(false) })}
      />
    </div>
  )
}

export function DeliveryCard({ order, highlight = false }: { order: RiderDelivery; highlight?: boolean }) {
  const due = balanceDue(order)
  const items = order.order_items.reduce((n, i) => n + i.quantity, 0)
  return (
    <article className={cn('rounded-card border bg-surface p-4 shadow-soft', highlight ? 'border-primary/50 ring-2 ring-primary/15' : 'border-line')}>
      <Link
        to={`/rider/deliveries/${order.id}`}
        className="flex items-start justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold text-ink">{order.order_reference}</span>
            <OrderStatusBadge status={order.order_status} audience="staff" size="sm" />
          </div>
          <p className="mt-1.5 font-display text-lg leading-snug font-bold text-ink">{order.delivery_area || order.delivery_address}</p>
          {order.delivery_area && <p className="truncate text-sm text-ink-2">{order.delivery_address}</p>}
          {order.delivery_landmark && <p className="truncate text-sm text-ink-3">Landmark: {order.delivery_landmark}</p>}
          <p className="mt-2 text-sm text-ink-3">
            {order.contact_name.split(' ')[0]} · {items} {items === 1 ? 'item' : 'items'} · assigned {formatRelative(order.assigned_at)}
          </p>
          {due > 0 && <p className="mt-1 text-sm font-bold text-warning-text">Collect {formatCedis(due)} on delivery</p>}
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-ink-3" aria-hidden="true" />
      </Link>
      <div className="mt-4">
        <DeliveryActions order={order} compact />
      </div>
    </article>
  )
}
