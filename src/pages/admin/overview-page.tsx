import { ArrowRight, Banknote, Bike, CircleAlert, Clock3, PackageCheck, ReceiptText } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAdminOrders, useAdminOverview, type AdminOverview } from '@/features/admin/api'
import { AdminOrderDrawer } from '@/features/admin/order-drawer'
import { AdminPageHeader, StatCard } from '@/features/admin/ui'
import { useOrderParam } from '@/features/admin/use-order-param'
import { useAuth } from '@/features/auth/auth-provider'
import { OrderStatusBadge } from '@/features/orders/components'
import { STATUS_META } from '@/features/orders/status'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { AdminOrderRow, OrderStatus } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatRelative, formatTime } from '@/utils/dates'
import { formatCedis } from '@/utils/money'

const PIPELINE: Array<{ status: OrderStatus; key: keyof AdminOverview; filter: string; label: string }> = [
  { status: 'PENDING', key: 'pending', filter: 'unpaid', label: 'Awaiting payment' },
  { status: 'PAID', key: 'paid', filter: 'new', label: 'New' },
  { status: 'PREPARING', key: 'preparing', filter: 'preparing', label: 'Preparing' },
  { status: 'READY', key: 'ready', filter: 'ready', label: 'Ready' },
  { status: 'ASSIGNED', key: 'assigned', filter: 'assigned', label: 'Assigned' },
  { status: 'OUT_FOR_DELIVERY', key: 'out_for_delivery', filter: 'out', label: 'On the way' },
]

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Accra' }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

function OrderLine({ order, onOpen, meta }: { order: AdminOrderRow; onOpen: (id: string) => void; meta?: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => order.id && onOpen(order.id)}
        className="flex w-full items-center gap-3 rounded-[0.9rem] px-3 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-ink">{order.order_reference}</span>
            <span className="truncate text-sm text-ink-2">{order.contact_name}</span>
          </span>
          <span className="block truncate text-xs text-ink-3">{meta ?? order.items_summary}</span>
        </span>
        <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatCedis(order.total_pesewas)}</span>
        <OrderStatusBadge status={order.order_status as OrderStatus} audience="staff" size="sm" />
      </button>
    </li>
  )
}

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('rounded-card border border-line bg-surface p-4 sm:p-5', className)}>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function AdminOverviewPage() {
  useDocumentTitle('Admin overview')
  const auth = useAuth()
  const overview = useAdminOverview()
  const active = useAdminOrders({ filter: 'active', limit: 60 })
  const recent = useAdminOrders({ filter: 'all', limit: 8 })
  const { orderId, open, close } = useOrderParam()
  const data = overview.data

  const newOrders = (active.data ?? []).filter((o) => o.order_status === 'PAID').slice(0, 6)
  const quotes = (active.data ?? []).filter((o) => o.delivery_fee_status === 'QUOTE_PENDING').slice(0, 6)
  const onTheWay = (active.data ?? []).filter((o) => o.order_status === 'OUT_FOR_DELIVERY')

  return (
    <>
      <AdminPageHeader
        title={`${greeting()}${auth.firstName ? `, ${auth.firstName}` : ''}.`}
        description={data ? `Here’s the kitchen right now. Updated ${formatTime(data.generated_at)}.` : 'Here’s the kitchen right now.'}
        actions={
          <Button asChild trailingIcon={<ArrowRight aria-hidden="true" />}>
            <Link to="/admin/orders">Open orders</Link>
          </Button>
        }
      />

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Orders today" value={data?.orders_today} icon={ReceiptText} tone="primary" loading={!data} to="/admin/orders?filter=all" />
          <StatCard label="Revenue today" value={formatCedis(data?.revenue_today_pesewas ?? 0)} hint="Verified Paystack payments" icon={Banknote} tone="success" loading={!data} to="/admin/analytics" />
          <StatCard label="Delivered today" value={data?.delivered_today} icon={PackageCheck} tone="info" loading={!data} to="/admin/orders?filter=delivered" />
          <StatCard
            label="Fee proposals"
            value={data?.pending_fee_proposals}
            hint={data?.pending_fee_proposals ? 'Riders are waiting for a decision' : 'Nothing to review'}
            icon={CircleAlert}
            tone={data?.pending_fee_proposals ? 'warning' : 'neutral'}
            loading={!data}
            to="/admin/orders?filter=active"
          />
        </div>
      )}

      <section aria-label="Order pipeline" className="mt-6">
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ol className="grid min-w-[44rem] grid-cols-6 gap-2">
            {PIPELINE.map(({ status, key, filter, label }) => {
              const Icon = STATUS_META[status].icon
              const count = data ? (data[key] as number) : undefined
              return (
                <li key={status}>
                  <Link
                    to={`/admin/orders?filter=${filter}`}
                    className={cn(
                      'flex h-full flex-col gap-2 rounded-card border p-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      count ? 'border-line-strong bg-surface hover:border-ink-3' : 'border-line bg-surface-2/60 hover:border-line-strong',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-ink-3">
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </span>
                    {count === undefined ? (
                      <Skeleton className="h-8 w-10" />
                    ) : (
                      <span className={cn('tabular font-display text-3xl font-extrabold', count ? 'text-ink' : 'text-ink-3')}>{count}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="New orders"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/orders?filter=new">See all</Link>
            </Button>
          }
        >
          {active.isPending ? (
            <Skeleton className="h-32 rounded-[0.9rem]" />
          ) : newOrders.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-ink-3">No new paid orders waiting. They appear here the moment Paystack confirms them.</p>
          ) : (
            <ul>
              {newOrders.map((o) => (
                <OrderLine key={o.id} order={o} onOpen={open} meta={`Paid ${formatRelative(o.paid_at)} · ${o.items_summary ?? ''}`} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Delivery fees to confirm">
          {active.isPending ? (
            <Skeleton className="h-32 rounded-[0.9rem]" />
          ) : quotes.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-ink-3">Every active order has its delivery fee set.</p>
          ) : (
            <ul>
              {quotes.map((o) => (
                <OrderLine key={o.id} order={o} onOpen={open} meta={o.delivery_area ?? o.delivery_address ?? undefined} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="On the way"
          action={
            <Button asChild variant="ghost" size="sm" leadingIcon={<Bike aria-hidden="true" />}>
              <Link to="/admin/deliveries">Map</Link>
            </Button>
          }
        >
          {active.isPending ? (
            <Skeleton className="h-24 rounded-[0.9rem]" />
          ) : onTheWay.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-ink-3">No riders out right now.</p>
          ) : (
            <ul>
              {onTheWay.map((o) => (
                <OrderLine key={o.id} order={o} onOpen={open} meta={`${o.rider_name ?? 'Rider'} · ${o.delivery_area ?? o.delivery_address ?? ''}`} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Latest orders"
          action={
            <Button asChild variant="ghost" size="sm" leadingIcon={<Clock3 aria-hidden="true" />}>
              <Link to="/admin/orders?filter=all">All orders</Link>
            </Button>
          }
        >
          {recent.isPending ? (
            <Skeleton className="h-40 rounded-[0.9rem]" />
          ) : (recent.data ?? []).length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-ink-3">No orders yet. The first one will show up here.</p>
          ) : (
            <ul>
              {(recent.data ?? []).map((o) => (
                <OrderLine key={o.id} order={o} onOpen={open} meta={`${formatRelative(o.created_at)} · ${o.items_summary ?? ''}`} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <AdminOrderDrawer orderId={orderId} onClose={close} />
    </>
  )
}
