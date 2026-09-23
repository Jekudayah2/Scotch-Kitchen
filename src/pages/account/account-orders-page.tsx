import { ArrowRight, Package } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMyOrders } from '@/features/account/api'
import { OrderCard } from '@/features/account/order-card'
import { isActiveOrder } from '@/features/orders/status'
import { useDocumentTitle } from '@/hooks/use-document-title'

type Tab = 'active' | 'completed' | 'all'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
]

const EMPTY: Record<Tab, { title: string; description: string }> = {
  active: { title: 'No orders on the way', description: 'Orders you place appear here until they’re delivered.' },
  completed: { title: 'No delivered orders yet', description: 'Once an order is delivered, you’ll find it here to order again.' },
  all: { title: 'No orders yet', description: 'Your kitchen orders will all be kept here.' },
}

export default function AccountOrdersPage() {
  useDocumentTitle('My orders')
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'active') as Tab
  const orders = useMyOrders(100)
  const all = orders.data ?? []
  const lists: Record<Tab, typeof all> = {
    active: all.filter(isActiveOrder),
    completed: all.filter((o) => o.order_status === 'DELIVERED'),
    all,
  }
  const shown = lists[tab]

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true, preventScrollReset: true })}>
        <TabsList aria-label="Filter orders">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
              {!orders.isPending && <span className="tabular text-xs font-bold text-ink-3">{lists[t.id].length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {orders.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading your orders">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-card" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState title="We couldn’t load your orders" error={orders.error} onRetry={() => void orders.refetch()} retrying={orders.isFetching} />
      ) : shown.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={Package}
            title={EMPTY[tab].title}
            description={EMPTY[tab].description}
            action={
              <Button asChild trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link to="/order">Order Now</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
