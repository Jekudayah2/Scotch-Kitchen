import { Mail, Phone, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/feedback'
import { useAdminCustomers, useAdminOrders } from '@/features/admin/api'
import { AdminOrderDrawer } from '@/features/admin/order-drawer'
import { AdminPageHeader, DataTable, SearchField, StatCard, useDebouncedValue, type Column } from '@/features/admin/ui'
import { useOrderParam } from '@/features/admin/use-order-param'
import { OrderStatusBadge } from '@/features/orders/components'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { AdminCustomerRow, OrderStatus } from '@/types/domain'
import { formatDate, formatRelative } from '@/utils/dates'
import { formatCedis } from '@/utils/money'

const COLUMNS: Column<AdminCustomerRow>[] = [
  {
    id: 'name',
    header: 'Customer',
    mobile: 'primary',
    cell: (c) => (
      <span className="flex flex-col">
        <span className="font-semibold text-ink">{c.full_name || 'No name yet'}</span>
        <span className="text-xs text-ink-3">{c.email}</span>
      </span>
    ),
  },
  { id: 'phone', header: 'Phone', mobile: 'meta', cell: (c) => c.phone ?? <span className="text-ink-3">—</span> },
  { id: 'orders', header: 'Orders', align: 'right', mobile: 'meta', cell: (c) => <span className="tabular">{c.total_orders} orders</span> },
  { id: 'spent', header: 'Paid', align: 'right', mobile: 'end', cell: (c) => <span className="tabular font-semibold text-ink">{formatCedis(c.total_paid_pesewas)}</span> },
  { id: 'last', header: 'Last order', mobile: 'hidden', cell: (c) => (c.last_order_at ? formatRelative(c.last_order_at) : <span className="text-ink-3">Never</span>) },
  { id: 'joined', header: 'Joined', mobile: 'hidden', cell: (c) => formatDate(c.created_at) },
]

function CustomerSheet({ customer, onClose, onOpenOrder }: { customer: AdminCustomerRow | null; onClose: () => void; onOpenOrder: (id: string) => void }) {
  const orders = useAdminOrders({ filter: 'all', customerId: customer?.id ?? undefined, limit: 50, enabled: Boolean(customer?.id) })
  return (
    <Sheet open={customer !== null} onOpenChange={(o) => !o && onClose()} side="right" width="lg" title={customer?.full_name || 'Customer'} description={customer?.email ?? undefined}>
      {customer && (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {customer.phone && (
              <Button asChild variant="secondary" size="sm" leadingIcon={<Phone aria-hidden="true" />}>
                <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
              </Button>
            )}
            {customer.email && (
              <Button asChild variant="ghost" size="sm" leadingIcon={<Mail aria-hidden="true" />}>
                <a href={`mailto:${customer.email}`}>Email</a>
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Orders" value={customer.total_orders} />
            <StatCard label="Paid in total" value={formatCedis(customer.total_paid_pesewas)} />
          </div>
          <section aria-label="Orders">
            <h3 className="eyebrow mb-2 text-ink-3">Orders</h3>
            {orders.isPending ? (
              <Skeleton className="h-32 rounded-card" />
            ) : (orders.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-3">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-card border border-line">
                {(orders.data ?? []).map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => o.id && onOpenOrder(o.id)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-bold text-ink">{o.order_reference}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {formatDate(o.created_at)} · {o.items_summary}
                        </span>
                      </span>
                      <span className="tabular text-sm font-semibold text-ink">{formatCedis(o.total_pesewas)}</span>
                      <OrderStatusBadge status={o.order_status as OrderStatus} audience="staff" size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Sheet>
  )
}

export default function AdminCustomersPage() {
  useDocumentTitle('Customers')
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search)
  const customers = useAdminCustomers(term)
  const [selected, setSelected] = useState<AdminCustomerRow | null>(null)
  const { orderId, open, close } = useOrderParam()

  return (
    <>
      <AdminPageHeader title="Customers" description="Everyone who has signed up, with their orders and what they’ve paid (archived orders excluded)." />
      <SearchField value={search} onChange={setSearch} label="Search customers" placeholder="Name, email or phone" className="mb-4 max-w-xl" />
      <DataTable
        rows={customers.data}
        columns={COLUMNS}
        rowKey={(c) => c.id ?? c.email ?? ''}
        rowLabel={(c) => `Open ${c.full_name || c.email}`}
        onRowClick={setSelected}
        loading={customers.isPending}
        error={customers.error}
        onRetry={() => void customers.refetch()}
        empty={{ icon: Users, title: term ? 'No customers match your search' : 'No customers yet', description: 'Customers appear here once they sign up.' }}
      />
      <CustomerSheet customer={selected} onClose={() => setSelected(null)} onOpenOrder={open} />
      <AdminOrderDrawer orderId={orderId} onClose={close} />
    </>
  )
}
