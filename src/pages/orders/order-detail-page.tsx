import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CreditCard, PackageX, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/feedback'
import { Field, Textarea } from '@/components/ui/field'
import { cancelMyOrder, fetchOrderByReference, orderKeys } from '@/features/orders/api'
import {
  DeliveryDestination,
  OrderItemsList,
  OrderStatusBadge,
  OrderTimeline,
  PaymentStatusBadge,
  PaymentSummaryCard,
  useOrderAgain,
} from '@/features/orders/components'
import { STATUS_META } from '@/features/orders/status'
import { initializePayment, redirectToPaystack } from '@/features/payments/api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { LIVE_REFETCH_MS, useRealtimeInvalidation } from '@/hooks/use-realtime'
import { formatDateTime } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'

export default function OrderDetailPage() {
  const { reference = '' } = useParams()
  const [params] = useSearchParams()
  const ref = reference.toUpperCase()
  useDocumentTitle(`Order ${ref}`)
  const queryClient = useQueryClient()
  const orderAgain = useOrderAgain()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const order = useQuery({
    queryKey: orderKeys.detail(ref),
    queryFn: () => fetchOrderByReference(ref),
    refetchInterval: (query) => {
      const status = query.state.data?.order_status
      return status && status !== 'DELIVERED' && status !== 'CANCELLED' ? LIVE_REFETCH_MS : false
    },
  })
  const data = order.data

  useRealtimeInvalidation({
    channel: `order:${data?.id ?? 'pending'}`,
    table: 'orders',
    filter: data ? `id=eq.${data.id}` : undefined,
    invalidate: [orderKeys.detail(ref), orderKeys.all],
    enabled: Boolean(data),
  })

  const cancel = useMutation({
    mutationFn: () => cancelMyOrder(data?.id as string, reason.trim() || undefined),
    onSuccess: () => {
      toast.success('Your order was cancelled.')
      setCancelOpen(false)
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
    onError: (error) => toast.error(friendlyError(error)),
  })

  if (order.isPending) return <PageLoader label="Loading your order" />
  if (order.isError) return <ErrorState className="min-h-[60vh]" error={order.error} onRetry={() => void order.refetch()} />
  if (!data) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={PackageX}
        title="We couldn’t find that order"
        description="It may belong to another account. Sign in with the account that placed it, or look it up with its reference and phone number."
        action={
          <Button asChild>
            <Link to="/track-order">Look up an order</Link>
          </Button>
        }
      />
    )
  }

  const meta = STATUS_META[data.order_status]
  const Icon = meta.icon
  const awaitingPayment = data.order_status === 'PENDING' && data.payment_status !== 'PAID' && !data.archived_at
  const closed = data.order_status === 'DELIVERED' || data.order_status === 'CANCELLED'

  const pay = async () => {
    setPaying(true)
    setPayError(null)
    try {
      const payment = await initializePayment(data.id)
      redirectToPaystack(payment.authorization_url)
    } catch (error) {
      setPayError(friendlyError(error))
      setPaying(false)
    }
  }

  return (
    <div className="container-page py-8 lg:py-12">
      <Link to="/account/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        My orders
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-primary-text">Order</p>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight text-ink sm:text-4xl">{data.order_reference}</h1>
          <p className="mt-2 text-sm text-ink-3">Placed {formatDateTime(data.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={data.order_status} />
          <PaymentStatusBadge status={data.payment_status} />
        </div>
      </header>

      {params.get('payment') === 'unavailable' && (
        <Notice tone="warning" className="mt-6">
          Online payment isn’t available right now. Your order is saved; try paying again shortly.
        </Notice>
      )}
      {data.archived_at && (
        <Notice tone="neutral" className="mt-6">
          This order has been archived by the kitchen. Its details are kept for your records.
        </Notice>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 bg-primary-soft/60 px-6 py-5 dark:bg-primary-soft">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-ink">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-xl font-bold text-ink">{meta.customerLabel}</p>
                <p className="text-sm text-ink-2">{meta.description}</p>
              </div>
            </div>
            <CardContent>
              <OrderTimeline order={data} events={data.order_status_history} />
            </CardContent>
          </Card>

          {(awaitingPayment || closed) && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3">
                {awaitingPayment && (
                  <>
                    <Button onClick={() => void pay()} loading={paying} leadingIcon={<CreditCard aria-hidden="true" />}>
                      Complete payment
                    </Button>
                    <Button variant="ghost" onClick={() => setCancelOpen(true)} leadingIcon={<XCircle aria-hidden="true" />}>
                      Cancel order
                    </Button>
                  </>
                )}
                {closed && (
                  <Button variant="secondary" onClick={() => orderAgain(data.order_items)} leadingIcon={<RotateCcw aria-hidden="true" />}>
                    Order again
                  </Button>
                )}
                {payError && <p className="w-full text-sm text-danger-text">{payError}</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderItemsList items={data.order_items} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentSummaryCard order={data} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-ink-3">
                For {data.contact_name} · {data.contact_phone}
              </p>
              <DeliveryDestination order={data} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this order?"
        description="You haven’t paid yet, so nothing will be charged."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      >
        <Field label="Reason" optional>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
        </Field>
      </ConfirmDialog>
    </div>
  )
}
