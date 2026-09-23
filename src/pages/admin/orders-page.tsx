import { Clock3, Download, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ORDER_FILTERS, useAdminOrders, useAdminOverview, type OrderFilter } from '@/features/admin/api'
import { AdminOrderDrawer } from '@/features/admin/order-drawer'
import { AdminPageHeader, DataTable, FilterChips, SearchField, useDebouncedValue, type Column } from '@/features/admin/ui'
import { useOrderParam } from '@/features/admin/use-order-param'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/components'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { AdminOrderRow, OrderStatus, PaymentStatus } from '@/types/domain'
import { toCsv, downloadTextFile } from '@/utils/csv'
import { formatDateTime, formatRelative } from '@/utils/dates'
import { formatCedis } from '@/utils/money'

const COLUMNS: Column<AdminOrderRow>[] = [
  {
    id: 'ref',
    header: 'Order',
    mobile: 'primary',
    cell: (o) => (
      <span className="flex flex-col">
        <span className="font-mono font-bold text-ink">{o.order_reference}</span>
        <span className="text-xs text-ink-3">{formatRelative(o.created_at)}</span>
      </span>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    mobile: 'meta',
    cell: (o) => (
      <span className="flex flex-col">
        <span className="font-semibold text-ink">{o.contact_name}</span>
        <span className="text-xs text-ink-3">{o.contact_phone}</span>
      </span>
    ),
  },
  { id: 'items', header: 'Items', mobile: 'meta', className: 'max-w-64', cell: (o) => <span className="line-clamp-2">{o.items_summary}</span> },
  {
    id: 'area',
    header: 'Deliver to',
    mobile: 'hidden',
    className: 'max-w-48',
    cell: (o) => <span className="line-clamp-2">{o.delivery_area ?? o.delivery_address}</span>,
  },
  {
    id: 'total',
    header: 'Total',
    align: 'right',
    mobile: 'end',
    cell: (o) => (
      <span className="flex flex-col items-end gap-1">
        <span className="tabular font-semibold text-ink">{formatCedis((o.total_pesewas ?? 0) + (o.delivery_balance_pesewas ?? 0))}</span>
        {o.delivery_fee_status === 'QUOTE_PENDING' && (
          <Badge tone="warning" size="sm">
            <Clock3 aria-hidden="true" />
            Fee
          </Badge>
        )}
      </span>
    ),
  },
  { id: 'payment', header: 'Payment', mobile: 'hidden', cell: (o) => <PaymentStatusBadge status={o.payment_status as PaymentStatus} size="sm" /> },
  { id: 'status', header: 'Status', mobile: 'meta', cell: (o) => <OrderStatusBadge status={o.order_status as OrderStatus} audience="staff" size="sm" /> },
  { id: 'rider', header: 'Rider', mobile: 'hidden', cell: (o) => o.rider_name ?? <span className="text-ink-3">—</span> },
]

export default function AdminOrdersPage() {
  useDocumentTitle('Orders')
  const [params, setParams] = useSearchParams()
  const filter = (ORDER_FILTERS.some((f) => f.id === params.get('filter')) ? params.get('filter') : 'active') as OrderFilter
  const [search, setSearch] = useState(params.get('q') ?? '')
  const term = useDebouncedValue(search)
  const orders = useAdminOrders({ filter, search: term, limit: 200 })
  const overview = useAdminOverview()
  const { orderId, open, close } = useOrderParam()

  const counts: Partial<Record<OrderFilter, number>> = overview.data
    ? {
        new: overview.data.paid,
        preparing: overview.data.preparing,
        ready: overview.data.ready,
        assigned: overview.data.assigned,
        out: overview.data.out_for_delivery,
        unpaid: overview.data.pending,
      }
    : {}

  const setFilter = (next: OrderFilter) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        updated.set('filter', next)
        return updated
      },
      { replace: true, preventScrollReset: true },
    )

  const exportCsv = () => {
    const rows = (orders.data ?? []).map((o) => ({
      reference: o.order_reference,
      placed_at: formatDateTime(o.created_at),
      customer: o.contact_name,
      phone: o.contact_phone,
      items: o.items_summary,
      subtotal_ghs: ((o.subtotal_pesewas ?? 0) / 100).toFixed(2),
      delivery_fee_ghs: ((o.delivery_fee_pesewas ?? 0) / 100).toFixed(2),
      delivery_balance_ghs: ((o.delivery_balance_pesewas ?? 0) / 100).toFixed(2),
      paid_ghs: ((o.amount_paid_pesewas ?? 0) / 100).toFixed(2),
      payment_status: o.payment_status,
      order_status: o.order_status,
      rider: o.rider_name,
      delivery_address: o.delivery_address,
    }))
    if (rows.length === 0) {
      toast.info('No orders to export in this view.')
      return
    }
    downloadTextFile(`scotchs-kitchen-orders-${filter}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Every order, newest first. Open one to move it along, assign a rider or confirm its delivery fee."
        actions={
          <Button variant="secondary" onClick={exportCsv} leadingIcon={<Download aria-hidden="true" />}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 space-y-3">
        <SearchField value={search} onChange={setSearch} label="Search orders" placeholder="Reference, name, phone, email, item or area" className="max-w-xl" />
        <FilterChips
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={ORDER_FILTERS.map((f) => ({ id: f.id, label: f.label, count: counts[f.id] }))}
        />
      </div>
      <DataTable
        rows={orders.data}
        columns={COLUMNS}
        rowKey={(o) => o.id ?? o.order_reference ?? ''}
        rowLabel={(o) => `Open order ${o.order_reference}`}
        onRowClick={(o) => o.id && open(o.id)}
        loading={orders.isPending}
        error={orders.error}
        onRetry={() => void orders.refetch()}
        empty={{
          icon: ReceiptText,
          title: term ? 'No orders match your search' : 'No orders here',
          description: term ? 'Try a reference like SK-7KQ4MX, a phone number or a name.' : 'Orders appear here as soon as they are placed.',
        }}
      />
      <AdminOrderDrawer orderId={orderId} onClose={close} />
    </>
  )
}
