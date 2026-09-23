import { CreditCard } from 'lucide-react'
import { useState } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { useAdminPayments } from '@/features/admin/api'
import { AdminOrderDrawer } from '@/features/admin/order-drawer'
import { AdminPageHeader, DataTable, FilterChips, SearchField, useDebouncedValue, type Column } from '@/features/admin/ui'
import { useOrderParam } from '@/features/admin/use-order-param'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { AdminPaymentRow } from '@/types/domain'
import { formatDateTime } from '@/utils/dates'
import { formatCedis } from '@/utils/money'

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PAID: { label: 'Paid', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
  ABANDONED: { label: 'Abandoned', tone: 'neutral' },
  SUPERSEDED: { label: 'Superseded', tone: 'outline' },
}

const COLUMNS: Column<AdminPaymentRow>[] = [
  {
    id: 'ref',
    header: 'Payment',
    mobile: 'primary',
    cell: (p) => (
      <span className="flex flex-col">
        <span className="font-mono text-xs font-semibold break-all text-ink">{p.reference}</span>
        <span className="text-xs text-ink-3">{formatDateTime(p.created_at)}</span>
      </span>
    ),
  },
  { id: 'order', header: 'Order', mobile: 'meta', cell: (p) => <span className="font-mono font-bold text-ink">{p.order_reference}</span> },
  { id: 'customer', header: 'Customer', mobile: 'meta', cell: (p) => p.customer_name },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    mobile: 'end',
    cell: (p) => (
      <span className="flex flex-col items-end">
        <span className="tabular font-semibold text-ink">{formatCedis(p.amount_pesewas)}</span>
        {p.amount_received_pesewas !== null && p.amount_received_pesewas !== p.amount_pesewas && (
          <span className="tabular text-xs font-semibold text-warning-text">received {formatCedis(p.amount_received_pesewas)}</span>
        )}
      </span>
    ),
  },
  { id: 'channel', header: 'Channel', mobile: 'hidden', cell: (p) => p.channel?.replace(/_/g, ' ') ?? <span className="text-ink-3">—</span> },
  {
    id: 'status',
    header: 'Status',
    mobile: 'meta',
    cell: (p) => {
      const s = STATUS[p.status ?? ''] ?? { label: p.status ?? '', tone: 'neutral' as BadgeTone }
      return (
        <Badge tone={s.tone} size="sm">
          {s.label}
        </Badge>
      )
    },
  },
  { id: 'verified', header: 'Verified', mobile: 'hidden', cell: (p) => (p.verified_at ? formatDateTime(p.verified_at) : <span className="text-ink-3">—</span>) },
]

export default function AdminPaymentsPage() {
  useDocumentTitle('Payments')
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search)
  const payments = useAdminPayments({ status, search: term })
  const { orderId, open, close } = useOrderParam()

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Every Paystack transaction attempt. An order is marked paid only after the server verifies the transaction with Paystack."
      />
      <div className="mb-4 space-y-3">
        <SearchField value={search} onChange={setSearch} label="Search payments" placeholder="Payment or order reference, customer" className="max-w-xl" />
        <FilterChips
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={[{ id: 'ALL', label: 'All' }, ...Object.entries(STATUS).map(([id, s]) => ({ id, label: s.label }))]}
        />
      </div>
      <DataTable
        rows={payments.data}
        columns={COLUMNS}
        rowKey={(p) => p.id ?? p.reference ?? ''}
        rowLabel={(p) => `Open order ${p.order_reference}`}
        onRowClick={(p) => p.order_id && open(p.order_id)}
        loading={payments.isPending}
        error={payments.error}
        onRetry={() => void payments.refetch()}
        empty={{ icon: CreditCard, title: 'No payments here', description: 'Payment attempts appear once customers start checking out.' }}
      />
      <AdminOrderDrawer orderId={orderId} onClose={close} />
    </>
  )
}
