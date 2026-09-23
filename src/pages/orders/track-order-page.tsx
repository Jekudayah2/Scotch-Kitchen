import { useQuery } from '@tanstack/react-query'
import { ArrowRight, PackageSearch, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState, Notice, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/features/auth/auth-provider'
import { fetchMyOrders, orderKeys, trackOrderPublic, type PublicTracking } from '@/features/orders/api'
import { OrderStatusBadge } from '@/features/orders/components'
import { isActiveOrder, STATUS_META } from '@/features/orders/status'
import { SectionHeader } from '@/features/storefront/section-header'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { LIVE_REFETCH_MS } from '@/hooks/use-realtime'
import { formatDateTime, formatRelative } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'

function MyActiveOrders({ userId }: { userId: string }) {
  const orders = useQuery({
    queryKey: orderKeys.mine(userId),
    queryFn: () => fetchMyOrders(userId),
    refetchInterval: LIVE_REFETCH_MS,
  })
  const active = (orders.data ?? []).filter(isActiveOrder)

  if (orders.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    )
  }
  if (orders.isError) return <ErrorState compact error={orders.error} onRetry={() => void orders.refetch()} />
  if (active.length === 0) {
    return (
      <Card className="p-6">
        <p className="font-semibold text-ink">No active orders right now.</p>
        <p className="mt-1 text-sm text-ink-3">
          Past orders are in{' '}
          <Link to="/account/orders" className="font-semibold text-primary-text hover:underline">
            My Orders
          </Link>
          .
        </p>
      </Card>
    )
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {active.map((order) => {
        const Icon = STATUS_META[order.order_status].icon
        return (
          <li key={order.id}>
            <Link
              to={`/track-order/${order.order_reference}`}
              className="group flex h-full flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-soft transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-ink">{order.order_reference}</p>
                  <p className="text-xs text-ink-3">Placed {formatRelative(order.created_at)}</p>
                </div>
                <OrderStatusBadge status={order.order_status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary-soft text-primary-text">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm text-ink-2">{STATUS_META[order.order_status].description}</p>
              </div>
              <p className="mt-auto flex items-center justify-between text-sm font-semibold text-ink">
                <span className="truncate">{order.items_summary}</span>
                <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function PublicResult({ result }: { result: PublicTracking }) {
  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-bold text-ink">{result.order_reference}</p>
          <p className="text-sm text-ink-3">Placed {formatDateTime(result.created_at)}</p>
        </div>
        <OrderStatusBadge status={result.order_status} />
      </div>
      <p className="text-ink-2">{STATUS_META[result.order_status].description}</p>
      <ul className="space-y-1 text-sm text-ink-2">
        {result.items.map((item, i) => (
          <li key={i}>
            {item.quantity} × {item.product_name} {item.variant_name}
          </li>
        ))}
      </ul>
      <ol className="space-y-2 border-t border-line pt-4 text-sm">
        {result.timeline
          .filter((t) => t.to_status)
          .map((t, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="font-medium text-ink">{t.to_status ? STATUS_META[t.to_status].customerLabel : t.event}</span>
              <span className="text-ink-3">{formatDateTime(t.created_at)}</span>
            </li>
          ))}
      </ol>
      <Notice tone="neutral">
        For your delivery address, payment details and live updates, sign in to the account that placed the order.
      </Notice>
    </Card>
  )
}

export default function TrackOrderPage() {
  useDocumentTitle('Track your order')
  const { status, user } = useAuth()
  const [reference, setReference] = useState('')
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PublicTracking | null>(null)

  const lookup = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setResult(null)
    if (!/^SK-?[A-Za-z0-9]{6,10}$/.test(reference.trim())) {
      setError('Enter the order reference from your confirmation, e.g. SK-7KQ4MX.')
      return
    }
    setPending(true)
    try {
      const ref = reference.trim().toUpperCase().replace(/^SK-?/, 'SK-')
      const found = await trackOrderPublic(ref, phone)
      if (!found) setError('We couldn’t find an order with that reference and phone number.')
      else setResult(found)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="container-page py-10 lg:py-14">
      <SectionHeader as="h1" eyebrow="Order tracking" title="Track your order" description="Follow your order from the kitchen to your pin." />

      {status === 'signed_in' && user && (
        <section className="mt-10 space-y-4" aria-labelledby="active-title">
          <h2 id="active-title" className="font-display text-xl font-bold text-ink">
            Your active orders
          </h2>
          <MyActiveOrders userId={user.id} />
        </section>
      )}

      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr]" aria-labelledby="lookup-title">
        <Card className="space-y-5 p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-text">
              <PackageSearch className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="lookup-title" className="font-display text-xl font-bold text-ink">
                Look up an order
              </h2>
              <p className="text-sm text-ink-3">Use the reference and the phone number given at checkout.</p>
            </div>
          </div>
          <form onSubmit={(e) => void lookup(e)} noValidate className="space-y-4">
            <Field label="Order reference">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="SK-7KQ4MX" autoCapitalize="characters" className="font-mono" />
            </Field>
            <Field label="Phone number used at checkout">
              <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 123 4567" />
            </Field>
            {error && <Notice tone="warning">{error}</Notice>}
            <Button type="submit" size="lg" loading={pending} leadingIcon={<Search aria-hidden="true" />}>
              Track order
            </Button>
          </form>
          {status !== 'signed_in' && (
            <p className="text-sm text-ink-3">
              Ordered with an account?{' '}
              <Link to="/sign-in?next=%2Ftrack-order" className="font-semibold text-primary-text hover:underline">
                Sign in
              </Link>{' '}
              to see every order in one place.
            </p>
          )}
        </Card>
        {result ? (
          <PublicResult result={result} />
        ) : (
          <div className="hidden rounded-4xl border border-dashed border-line-strong p-8 lg:grid lg:place-items-center">
            <p className="max-w-xs text-center text-sm text-ink-3">
              Your order’s progress appears here. For privacy, lookups never show addresses, names or amounts.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
