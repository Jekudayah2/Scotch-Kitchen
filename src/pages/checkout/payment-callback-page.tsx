import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Clock3, Copy, LoaderCircle, MapPin, RotateCw, ShieldAlert, XCircle } from 'lucide-react'
import { m } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { fetchOrderByReference, orderKeys } from '@/features/orders/api'
import { OrderItemsList, OrderStatusBadge } from '@/features/orders/components'
import { paymentSummary } from '@/features/orders/status'
import { initializePayment, redirectToPaystack, verifyPayment, type VerifyPaymentResult } from '@/features/payments/api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { duration, ease } from '@/lib/motion'
import { cn } from '@/utils/cn'
import { friendlyError } from '@/utils/errors'
import { formatCedis } from '@/utils/money'

const MAX_AUTO_CHECKS = 4

/** Animated tick for the confirmation moment (a plain tick for reduced motion). */
function SuccessMark() {
  return (
    <m.span
      className="grid size-16 place-items-center rounded-full bg-success text-white shadow-[0_12px_30px_-12px_var(--success)]"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <m.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: ease.out, delay: 0.15 }} />
      </svg>
    </m.span>
  )
}

function CopyReference({ reference }: { reference: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(reference)
          .then(() => toast.success('Order reference copied'))
          .catch(() => undefined)
      }}
      className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface-2 px-3.5 font-mono text-sm font-semibold text-ink transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-label={`Order reference ${reference}. Copy`}
    >
      {reference}
      <Copy className="size-3.5 text-ink-3" aria-hidden="true" />
    </button>
  )
}

/** "Your order is confirmed." Everything shown comes from the saved order, never from the redirect. */
function OrderConfirmed({ reference }: { reference: string }) {
  const order = useQuery({ queryKey: orderKeys.detail(reference), queryFn: () => fetchOrderByReference(reference) })
  const data = order.data
  const money = data ? paymentSummary(data) : null

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <SuccessMark />
        <h1 className="display-md text-ink">Your order is confirmed.</h1>
        <p className="max-w-md text-ink-2">Paystack confirmed your payment and the kitchen has your order. You can follow every step from here.</p>
        <CopyReference reference={reference} />
      </div>

      {order.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading your order">
          <Skeleton className="h-16 rounded-[1rem]" />
          <Skeleton className="h-16 rounded-[1rem]" />
          <Skeleton className="h-24 rounded-[1rem]" />
        </div>
      ) : data && money ? (
        <div className="space-y-5 text-left">
          <div className="rounded-[1rem] border border-line p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="eyebrow text-ink-3">Your items</p>
              <OrderStatusBadge status={data.order_status} size="sm" />
            </div>
            <OrderItemsList items={data.order_items} compact />
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Paid</dt>
                <dd className="tabular font-display text-lg font-bold text-ink">{formatCedis(money.paid)}</dd>
              </div>
              {data.delivery_fee_status === 'QUOTE_PENDING' && (
                <p className="text-xs text-ink-3">Your delivery fee is confirmed for your pin next. If it’s added now, you settle it with your rider.</p>
              )}
              {money.balance > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">Delivery balance (on delivery)</dt>
                  <dd className="tabular font-semibold text-ink">{formatCedis(money.balance)}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="flex gap-3 rounded-[1rem] border border-line p-4 sm:p-5">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden="true" />
            <div className="min-w-0">
              <p className="eyebrow text-ink-3">Delivering to</p>
              <p className="mt-1 font-semibold text-ink">{data.delivery_address}</p>
              {data.delivery_landmark && <p className="text-sm text-ink-2">Landmark: {data.delivery_landmark}</p>}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
          <Link to={`/track-order/${reference}`}>Track My Order</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/order">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * Paystack redirects here with ?reference=… The page asks our server to verify
 * the transaction with Paystack. The browser's view of "success" is never used
 * to mark anything paid.
 */
export default function PaymentCallbackPage() {
  const [params] = useSearchParams()
  const reference = params.get('reference') ?? params.get('trxref') ?? ''
  const queryClient = useQueryClient()
  const [attempt, setAttempt] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const verification = useQuery({
    queryKey: ['payment-verification', reference, attempt],
    queryFn: () => verifyPayment(reference),
    enabled: reference.length > 0,
    retry: 1,
    staleTime: Infinity,
  })
  const result: VerifyPaymentResult | undefined = verification.data
  useDocumentTitle(result?.status === 'PAID' ? 'Order confirmed' : 'Confirming payment')

  // Paystack sometimes needs a few seconds; re-check automatically a few times.
  useEffect(() => {
    if (result?.status !== 'PENDING' || attempt >= MAX_AUTO_CHECKS) return
    const timer = window.setTimeout(() => setAttempt((a) => a + 1), 3000)
    return () => window.clearTimeout(timer)
  }, [result?.status, attempt])

  useEffect(() => {
    if (result?.status === 'PAID') void queryClient.invalidateQueries({ queryKey: orderKeys.all })
  }, [result?.status, queryClient])

  const tryAgain = async () => {
    if (!result?.order_id) return
    setRetrying(true)
    setRetryError(null)
    try {
      const payment = await initializePayment(result.order_id)
      redirectToPaystack(payment.authorization_url)
    } catch (error) {
      setRetryError(friendlyError(error))
      setRetrying(false)
    }
  }

  let body: ReactNode
  if (!reference) {
    body = (
      <State icon={ShieldAlert} tone="warning" title="No payment to confirm" text="This page opens after paying with Paystack.">
        <Button asChild>
          <Link to="/account/orders">Go to My Orders</Link>
        </Button>
      </State>
    )
  } else if (verification.isPending || (verification.isFetching && !result)) {
    body = <State icon={LoaderCircle} spin title="Confirming your payment" text="We’re checking with Paystack. This usually takes a moment." />
  } else if (verification.isError) {
    body = (
      <State icon={ShieldAlert} tone="warning" title="We couldn’t confirm your payment yet" text={friendlyError(verification.error)}>
        <Button onClick={() => setAttempt((a) => a + 1)} leadingIcon={<RotateCw aria-hidden="true" />}>
          Check Again
        </Button>
        <Button asChild variant="secondary">
          <Link to="/account/orders">My Orders</Link>
        </Button>
      </State>
    )
  } else if (result?.status === 'PAID' && result.order_reference) {
    body = <OrderConfirmed reference={result.order_reference} />
  } else if (result?.status === 'PAID') {
    body = (
      <State icon={Check} tone="success" title="Your order is confirmed." text="Paystack confirmed your payment. Your order is in My Orders.">
        <Button asChild>
          <Link to="/account/orders">My Orders</Link>
        </Button>
      </State>
    )
  } else if (result?.status === 'PENDING') {
    body = (
      <State
        icon={Clock3}
        tone="info"
        title="Waiting for Paystack"
        text="Your payment hasn’t been confirmed yet. If you completed it, this updates automatically. You won’t be charged twice."
      >
        <Button onClick={() => setAttempt((a) => a + 1)} loading={verification.isFetching} leadingIcon={<RotateCw aria-hidden="true" />}>
          Check Again
        </Button>
        {result.order_reference && (
          <Button asChild variant="secondary">
            <Link to={`/track-order/${result.order_reference}`}>View Order</Link>
          </Button>
        )}
      </State>
    )
  } else if (result?.status === 'MISMATCH') {
    body = (
      <State
        icon={ShieldAlert}
        tone="warning"
        title="We’re reviewing this payment"
        text="Paystack reported a different amount from your order total, so the kitchen will check it before starting. We’ll update your order page."
      >
        {result.order_reference && (
          <Button asChild>
            <Link to={`/track-order/${result.order_reference}`}>View Order</Link>
          </Button>
        )}
      </State>
    )
  } else {
    body = (
      <State
        icon={XCircle}
        tone="danger"
        title={result?.status === 'ABANDONED' ? 'Payment cancelled' : 'Payment didn’t go through'}
        text="No money was taken for this attempt. Your order is saved, so you can try paying again."
      >
        <Button onClick={() => void tryAgain()} loading={retrying}>
          Try Paying Again
        </Button>
        {result?.order_reference && (
          <Button asChild variant="secondary">
            <Link to={`/track-order/${result.order_reference}`}>View Order</Link>
          </Button>
        )}
        {retryError && <p className="w-full text-sm text-danger-text">{retryError}</p>}
      </State>
    )
  }

  return (
    <div className="container-page flex min-h-[70vh] items-start justify-center py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-xl rounded-card border border-line bg-surface p-6 shadow-soft sm:p-10">{body}</div>
    </div>
  )
}

function State({
  icon: Icon,
  title,
  text,
  tone = 'neutral',
  spin = false,
  children,
}: {
  icon: typeof Check
  title: string
  text: string
  tone?: 'success' | 'danger' | 'warning' | 'info' | 'neutral'
  spin?: boolean
  children?: ReactNode
}) {
  const tones = {
    success: 'bg-success-soft text-success-text',
    danger: 'bg-danger-soft text-danger-text',
    warning: 'bg-warning-soft text-warning-text',
    info: 'bg-info-soft text-info-text',
    neutral: 'bg-surface-2 text-ink-2',
  }
  return (
    <div className="flex flex-col items-center gap-5 text-center" aria-live="polite">
      <span className={cn('grid size-16 place-items-center rounded-full', tones[tone])}>
        <Icon className={cn('size-8', spin && 'animate-spin')} aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="text-ink-2">{text}</p>
      </div>
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}
