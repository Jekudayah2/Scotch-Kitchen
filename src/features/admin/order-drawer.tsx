import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Bike, Check, ChefHat, CircleDollarSign, Clock3, Mail, PackageCheck, Phone, Save, Truck, UserMinus, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Sheet } from '@/components/ui/dialog'
import { ErrorState, Notice, Skeleton } from '@/components/ui/feedback'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field'
import { DeliveryDestination, OrderItemsList, OrderStatusBadge, PaymentStatusBadge, PaymentSummaryCard } from '@/features/orders/components'
import { ORDER_TRANSITIONS, STATUS_META } from '@/features/orders/status'
import type { OrderStatus } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatDateTime, formatRelative } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'
import { formatCedis, parseCedisInput } from '@/utils/money'
import { adminKeys, adminOrderActions, useAdminOrder, useAdminRiders, type AdminOrderDetail } from './api'

/** Staff actions the status buttons may offer (payment states and assignment have their own flows). */
const ACTION_COPY: Partial<Record<OrderStatus, { label: string; icon: typeof ChefHat }>> = {
  PREPARING: { label: 'Start preparing', icon: ChefHat },
  READY: { label: 'Mark ready', icon: PackageCheck },
  OUT_FOR_DELIVERY: { label: 'Mark out for delivery', icon: Truck },
  DELIVERED: { label: 'Mark delivered', icon: Check },
}

function useOrderMutation<TArgs>(orderId: string, fn: (args: TArgs) => Promise<unknown>, success: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: adminKeys.all })
      void queryClient.invalidateQueries({ queryKey: adminKeys.order(orderId) })
    },
    onError: (error) => toast.error(friendlyError(error)),
  })
}

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="eyebrow text-ink-3">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function StatusActions({ order }: { order: AdminOrderDetail }) {
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const setStatus = useOrderMutation(order.id, (a: { status: OrderStatus; note?: string }) => adminOrderActions.setStatus(order.id, a.status, a.note), 'Order updated.')
  const next = ORDER_TRANSITIONS[order.order_status].filter((s) => ACTION_COPY[s] && !(order.order_status === 'ASSIGNED' && s === 'READY'))
  const canCancel = ORDER_TRANSITIONS[order.order_status].includes('CANCELLED')

  if (order.archived_at) return <Notice tone="neutral">This order is archived and read-only.</Notice>
  if (!next.length && !canCancel) return <p className="text-sm text-ink-3">No further steps. This order is {STATUS_META[order.order_status].label.toLowerCase()}.</p>

  return (
    <div className="flex flex-wrap gap-2">
      {order.order_status === 'PENDING' && (
        <p className="w-full text-sm text-ink-3">Waiting for payment. It moves to Paid automatically once Paystack confirms it.</p>
      )}
      {next.map((status) => {
        const { label, icon: Icon } = ACTION_COPY[status] as { label: string; icon: typeof ChefHat }
        return (
          <Button
            key={status}
            onClick={() => setStatus.mutate({ status })}
            loading={setStatus.isPending && setStatus.variables?.status === status}
            disabled={setStatus.isPending}
            leadingIcon={<Icon aria-hidden="true" />}
          >
            {label}
          </Button>
        )
      })}
      {canCancel && (
        <Button variant="danger-soft" onClick={() => setCancelling(true)} leadingIcon={<Ban aria-hidden="true" />}>
          Cancel order
        </Button>
      )}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${order.order_reference}?`}
        description="The customer sees this reason. Pending payment attempts are closed; refunds for paid orders are handled in Paystack."
        confirmLabel="Cancel order"
        tone="danger"
        loading={setStatus.isPending}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() =>
          setStatus.mutate(
            { status: 'CANCELLED', note: reason },
            {
              onSuccess: () => {
                setCancelling(false)
                setReason('')
              },
            },
          )
        }
      >
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Out of stock, customer asked to cancel" />
        </Field>
      </ConfirmDialog>
    </div>
  )
}

function RiderAssignment({ order }: { order: AdminOrderDetail }) {
  const riders = useAdminRiders()
  const [riderId, setRiderId] = useState('')
  const assign = useOrderMutation(order.id, (id: string) => adminOrderActions.assignRider(order.id, id), 'Rider assigned.')
  const unassign = useOrderMutation(order.id, () => adminOrderActions.unassignRider(order.id), 'Rider removed.')
  const assignable = ['PREPARING', 'READY', 'ASSIGNED'].includes(order.order_status) && !order.archived_at
  const current = riders.data?.find((r) => r.id === order.assigned_rider_id)

  return (
    <div className="space-y-3">
      {order.assigned_rider_id ? (
        <div className="flex items-center justify-between gap-3 rounded-[0.9rem] bg-surface-2 p-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{order.rider?.full_name ?? current?.full_name ?? 'Assigned rider'}</p>
            {(order.rider?.phone ?? current?.phone) && (
              <a href={`tel:${(order.rider?.phone ?? current?.phone ?? '').replace(/\s/g, '')}`} className="text-sm text-primary-text underline-offset-4 hover:underline">
                {order.rider?.phone ?? current?.phone}
              </a>
            )}
          </div>
          {assignable && order.order_status !== 'OUT_FOR_DELIVERY' && (
            <Button variant="ghost" size="sm" onClick={() => unassign.mutate(undefined)} loading={unassign.isPending} leadingIcon={<UserMinus aria-hidden="true" />}>
              Remove
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-3">No rider yet.</p>
      )}
      {assignable && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`rider-${order.id}`} className="sr-only">
            Choose a rider
          </label>
          <NativeSelect id={`rider-${order.id}`} value={riderId} onChange={(e) => setRiderId(e.target.value)} className="flex-1">
            <option value="">{riders.isPending ? 'Loading riders…' : 'Choose a rider'}</option>
            {(riders.data ?? [])
              .filter((r) => r.id !== order.assigned_rider_id)
              .map((r) => (
                <option key={r.id} value={r.id ?? ''} disabled={r.availability === 'OFFLINE'}>
                  {r.full_name ?? r.email} · {r.availability === 'AVAILABLE' ? 'Available' : r.availability === 'BUSY' ? `Busy (${r.active_deliveries ?? 0})` : 'Offline'}
                </option>
              ))}
          </NativeSelect>
          <Button onClick={() => riderId && assign.mutate(riderId, { onSuccess: () => setRiderId('') })} disabled={!riderId} loading={assign.isPending} leadingIcon={<Bike aria-hidden="true" />}>
            {order.assigned_rider_id ? 'Reassign' : 'Assign'}
          </Button>
        </div>
      )}
      {!assignable && !order.assigned_rider_id && order.order_status === 'PAID' && (
        <p className="text-xs text-ink-3">Riders can be assigned once the kitchen starts preparing.</p>
      )}
    </div>
  )
}

function DeliveryCharge({ order }: { order: AdminOrderDetail }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const paid = order.payment_status === 'PAID'
  const setCharge = useOrderMutation(order.id, (p: number) => adminOrderActions.setDeliveryCharge(order.id, p, note), paid ? 'Delivery balance saved.' : 'Delivery fee saved.')
  const collect = useOrderMutation(order.id, () => adminOrderActions.markBalanceCollected(order.id), 'Balance marked as collected.')
  const review = useOrderMutation(order.id, (a: { id: string; approve: boolean }) => adminOrderActions.reviewProposal(a.id, a.approve), 'Proposal reviewed.')
  const pesewas = parseCedisInput(amount)
  const closed = order.order_status === 'DELIVERED' || order.order_status === 'CANCELLED' || Boolean(order.archived_at)
  const proposals = order.delivery_fee_changes.filter((c) => c.status === 'PROPOSED')

  return (
    <div className="space-y-4">
      <PaymentSummaryCard order={order} />
      {proposals.map((p) => (
        <div key={p.id} className="rounded-[0.9rem] border border-warning/40 bg-warning-soft p-3 text-sm">
          <p className="font-semibold text-warning-text">
            Rider proposed a {p.kind === 'DELIVERY_BALANCE' ? 'delivery balance' : 'delivery fee'} of {formatCedis(p.amount_pesewas)}
          </p>
          {p.note && <p className="mt-0.5 text-ink-2">“{p.note}”</p>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => review.mutate({ id: p.id, approve: true })} loading={review.isPending} leadingIcon={<Check aria-hidden="true" />}>
              Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => review.mutate({ id: p.id, approve: false })} disabled={review.isPending} leadingIcon={<X aria-hidden="true" />}>
              Reject
            </Button>
          </div>
        </div>
      ))}
      {order.delivery_balance_pesewas > 0 && !order.delivery_balance_collected_at && order.order_status !== 'CANCELLED' && (
        <Button variant="secondary" onClick={() => collect.mutate(undefined)} loading={collect.isPending} leadingIcon={<CircleDollarSign aria-hidden="true" />}>
          Mark {formatCedis(order.delivery_balance_pesewas)} balance collected
        </Button>
      )}
      {!closed && (
        <form
          className="space-y-2 rounded-[0.9rem] bg-surface-2 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (pesewas !== null) setCharge.mutate(pesewas, { onSuccess: () => (setAmount(''), setNote('')) })
          }}
        >
          <p className="text-sm font-semibold text-ink">{paid ? 'Set delivery balance' : 'Set delivery fee'}</p>
          <p className="text-xs text-ink-3">
            {paid
              ? 'The order is paid, so this becomes a balance collected on delivery. The amount already paid never changes.'
              : 'Charged at checkout together with the items.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
            <Input inputMode="decimal" aria-label="Amount in cedis" placeholder="GH₵ 0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input aria-label="Note (optional)" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            <Button type="submit" variant="secondary" disabled={pesewas === null} loading={setCharge.isPending}>
              Save
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function Notes({ order }: { order: AdminOrderDetail }) {
  // The parent keys this by the saved notes, so a newer save from elsewhere resets the draft.
  const [value, setValue] = useState(order.notes)
  const save = useOrderMutation(order.id, (text: string) => adminOrderActions.setNotes(order.id, text), 'Notes saved.')
  return (
    <div className="space-y-2">
      <Textarea aria-label="Kitchen notes" value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={4000} placeholder="Only staff can see these notes." />
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => save.mutate(value)} disabled={value === order.notes} loading={save.isPending} leadingIcon={<Save aria-hidden="true" />}>
          Save notes
        </Button>
      </div>
    </div>
  )
}

function StaffTimeline({ order }: { order: AdminOrderDetail }) {
  return (
    <ol className="space-y-3">
      {[...order.order_status_history].reverse().map((e) => (
        <li key={e.id} className="flex gap-3 text-sm">
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.to_status ? 'bg-primary' : 'bg-line-strong')} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {e.to_status ? STATUS_META[e.to_status].label : e.event.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              {!e.is_customer_visible && (
                <Badge tone="outline" size="sm" className="ml-2 align-middle">
                  Staff only
                </Badge>
              )}
            </p>
            {e.note && <p className="text-ink-2">{e.note}</p>}
            <p className="text-xs text-ink-3">
              {formatDateTime(e.created_at)}
              {e.actor_role ? ` · ${e.actor_role.toLowerCase()}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The whole order on one screen: next step, money, rider, destination, history, notes. */
export function AdminOrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useAdminOrder(orderId)
  const data = order.data

  return (
    <Sheet
      open={orderId !== null}
      onOpenChange={(open) => !open && onClose()}
      side="right"
      width="xl"
      title={data ? data.order_reference : 'Order'}
      description={data ? `Placed ${formatDateTime(data.created_at)} · updated ${formatRelative(data.updated_at)}` : undefined}
    >
      {order.isPending ? (
        <div className="space-y-4 p-5" aria-busy="true" aria-label="Loading order">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      ) : order.isError ? (
        <ErrorState className="m-5" error={order.error} onRetry={() => void order.refetch()} />
      ) : data ? (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={data.order_status} audience="staff" />
            <PaymentStatusBadge status={data.payment_status} />
            {data.delivery_fee_status === 'QUOTE_PENDING' && (
              <Badge tone="warning">
                <Clock3 aria-hidden="true" />
                Fee to confirm
              </Badge>
            )}
            <span className="tabular ml-auto font-display text-2xl font-extrabold text-ink">{formatCedis(data.total_pesewas + data.delivery_balance_pesewas)}</span>
          </div>

          <Block title="Next step">
            <StatusActions order={data} />
          </Block>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Block title="Items">
              <OrderItemsList items={data.order_items} compact />
            </Block>
            <Block title="Money">
              <DeliveryCharge order={data} />
            </Block>
            <Block title="Customer">
              <p className="font-semibold text-ink">{data.contact_name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm" leadingIcon={<Phone aria-hidden="true" />}>
                  <a href={`tel:${data.contact_phone.replace(/\s/g, '')}`}>{data.contact_phone}</a>
                </Button>
                {data.customer?.email && (
                  <Button asChild variant="ghost" size="sm" leadingIcon={<Mail aria-hidden="true" />}>
                    <a href={`mailto:${data.customer.email}`}>{data.customer.email}</a>
                  </Button>
                )}
              </div>
            </Block>
            <Block title="Rider">
              <RiderAssignment order={data} />
            </Block>
          </div>

          <Block title="Delivery destination">
            <DeliveryDestination order={data} />
          </Block>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Block title="History">
              <StaffTimeline order={data} />
            </Block>
            <div className="space-y-4">
              <Block title="Kitchen notes">
                <Notes key={data.notes} order={data} />
              </Block>
              <Block title="Payment attempts">
                {data.payments.length === 0 ? (
                  <p className="text-sm text-ink-3">No payment attempts yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 rounded-[0.8rem] bg-surface-2 px-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs text-ink-2">{p.reference}</span>
                          <span className="text-xs text-ink-3">
                            {formatDateTime(p.created_at)}
                            {p.channel ? ` · ${p.channel}` : ''}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="tabular block font-semibold text-ink">{formatCedis(p.amount_received_pesewas ?? p.amount_pesewas)}</span>
                          <Badge tone={p.status === 'PAID' ? 'success' : p.status === 'PENDING' ? 'warning' : p.status === 'FAILED' ? 'danger' : 'neutral'} size="sm">
                            {p.status.toLowerCase()}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
