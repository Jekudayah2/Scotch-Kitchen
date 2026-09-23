import { History } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { HISTORY_PAGE, useRiderHistory } from '@/features/rider/api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatDateTime } from '@/utils/dates'
import { formatCedis } from '@/utils/money'

/** Past drops. For privacy it shows first names and areas only, never addresses or phone numbers. */
export default function RiderHistoryPage() {
  useDocumentTitle('Delivery history')
  const [page, setPage] = useState(0)
  const history = useRiderHistory(page)
  const rows = history.data ?? []
  const total = rows[0]?.total_count ?? 0
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE))

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-ink">History</h1>
      {history.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading history">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={History} title="No completed deliveries yet" description="Your delivered and cancelled drops will be listed here." />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {rows.map((r) => (
              <li key={r.order_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-ink">{r.order_reference}</p>
                  <p className="truncate text-sm text-ink-2">
                    {r.customer_first_name}
                    {r.delivery_area ? ` · ${r.delivery_area}` : ''}
                  </p>
                  <p className="text-xs text-ink-3">{formatDateTime(r.delivered_at ?? r.cancelled_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={r.order_status === 'DELIVERED' ? 'success' : 'neutral'} size="sm">
                    {r.order_status === 'DELIVERED' ? 'Delivered' : 'Cancelled'}
                  </Badge>
                  {r.delivery_balance_pesewas > 0 && <p className="tabular mt-1 text-xs text-ink-3">Balance {formatCedis(r.delivery_balance_pesewas)}</p>}
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span className="text-sm text-ink-3">
                Page {page + 1} of {pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
