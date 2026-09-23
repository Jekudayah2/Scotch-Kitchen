import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, LoaderCircle, RotateCw, ShieldAlert, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { orderKeys } from '@/features/orders/api'
import { initializePayment, redirectToPaystack, verifyPayment, type VerifyPaymentResult } from '@/features/payments/api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { friendlyError } from '@/utils/errors'

const MAX_AUTO_CHECKS = 4

/**
 * Paystack redirects here with ?reference=… The page asks our server to verify
 * the transaction with Paystack. The browser's view of "success" is never used
 * to mark anything paid.
 */
export default function PaymentCallbackPage() {
  useDocumentTitle('Confirming payment')
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

  let body
  if (!reference) {
    body = (
      <State icon={ShieldAlert} tone="warning" title="No payment to confirm" text="This page is reached from Paystack after paying.">
        <Button asChild>
          <Link to="/account/orders">Go to my orders</Link>
        </Button>
      </State>
    )
  } else if (verification.isPending || (verification.isFetching && !result)) {
    body = <State icon={LoaderCircle} spin title="Confirming your payment" text="We’re checking with Paystack. This usually takes a moment." />
  } else if (verification.isError) {
    body = (
      <State icon={ShieldAlert} tone="warning" title="We couldn’t confirm your payment yet" text={friendlyError(verification.error)}>
        <Button onClick={() => setAttempt((a) => a + 1)} leadingIcon={<RotateCw aria-hidden="true" />}>
          Check again
        </Button>
        <Button asChild variant="secondary">
          <Link to="/account/orders">My orders</Link>
        </Button>
      </State>
    )
  } else if (result?.status === 'PAID') {
    body = (
      <State
        icon={CheckCircle2}
        tone="success"
        title="Payment confirmed"
        text={`Thank you. Order ${result.order_reference ?? ''} is with the kitchen, and you can follow every step from your order page.`}
      >
        {result.order_reference && (
          <Button asChild size="lg">
            <Link to={`/track-order/${result.order_reference}`}>Track my order</Link>
          </Button>
        )}
        <Button asChild variant="secondary" size="lg">
          <Link to="/order">Back to the menu</Link>
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
          Check again
        </Button>
        {result.order_reference && (
          <Button asChild variant="secondary">
            <Link to={`/track-order/${result.order_reference}`}>View order</Link>
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
            <Link to={`/track-order/${result.order_reference}`}>View order</Link>
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
          Try paying again
        </Button>
        {result?.order_reference && (
          <Button asChild variant="secondary">
            <Link to={`/track-order/${result.order_reference}`}>View order</Link>
          </Button>
        )}
        {retryError && <p className="w-full text-sm text-danger-text">{retryError}</p>}
      </State>
    )
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-lg p-8 sm:p-10">{body}</Card>
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
  icon: typeof CheckCircle2
  title: string
  text: string
  tone?: 'success' | 'danger' | 'warning' | 'info' | 'neutral'
  spin?: boolean
  children?: React.ReactNode
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
      <span className={`grid size-16 place-items-center rounded-3xl ${tones[tone]}`}>
        <Icon className={`size-8 ${spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="text-ink-2">{text}</p>
      </div>
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}
