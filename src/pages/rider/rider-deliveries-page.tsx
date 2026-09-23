import { Package } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useRiderDeliveries } from '@/features/rider/api'
import { DeliveryCard } from '@/features/rider/components'
import { useDocumentTitle } from '@/hooks/use-document-title'

export default function RiderDeliveriesPage() {
  useDocumentTitle('My deliveries')
  const deliveries = useRiderDeliveries()
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-ink">Deliveries</h1>
      {deliveries.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading deliveries">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
        </div>
      ) : deliveries.isError ? (
        <ErrorState error={deliveries.error} onRetry={() => void deliveries.refetch()} />
      ) : deliveries.data.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={Package} title="Nothing assigned" description="Deliveries the kitchen gives you appear here, newest last." />
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.data.map((o) => (
            <DeliveryCard key={o.id} order={o} highlight={o.order_status === 'OUT_FOR_DELIVERY'} />
          ))}
        </div>
      )}
    </div>
  )
}
