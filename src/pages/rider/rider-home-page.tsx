import { Bike, PackageCheck, PackageOpen, Timer } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-provider'
import { useRiderDeliveries, useRiderSummary } from '@/features/rider/api'
import { AvailabilityControl, DeliveryCard } from '@/features/rider/components'
import { useDocumentTitle } from '@/hooks/use-document-title'

function Stat({ icon: Icon, label, value }: { icon: typeof Bike; label: string; value: number | undefined }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3.5">
      <Icon className="size-4.5 text-primary-text" aria-hidden="true" />
      {value === undefined ? <Skeleton className="mt-2 h-7 w-8" /> : <p className="tabular mt-1.5 font-display text-2xl font-extrabold text-ink">{value}</p>}
      <p className="text-xs font-semibold text-ink-3">{label}</p>
    </div>
  )
}

export default function RiderHomePage() {
  useDocumentTitle('Rider')
  const auth = useAuth()
  const summary = useRiderSummary()
  const deliveries = useRiderDeliveries()
  const list = deliveries.data ?? []
  const current = list.find((o) => o.order_status === 'OUT_FOR_DELIVERY')
  const next = list.filter((o) => o.id !== current?.id)

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow text-primary-text">Rider</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] text-ink">Hi{auth.firstName ? `, ${auth.firstName}` : ''}.</h1>
      </header>

      <section aria-label="Availability" className="space-y-2">
        <AvailabilityControl />
        <p className="text-xs text-ink-3">Only available riders can be given new deliveries.</p>
      </section>

      <div className="grid grid-cols-4 gap-2">
        <Stat icon={PackageOpen} label="Assigned" value={summary.data?.assigned} />
        <Stat icon={Timer} label="To pick up" value={summary.data?.ready_for_pickup} />
        <Stat icon={Bike} label="On the way" value={summary.data?.out_for_delivery} />
        <Stat icon={PackageCheck} label="Done today" value={summary.data?.completed_today} />
      </div>

      {deliveries.isPending ? (
        <Skeleton className="h-56 rounded-card" />
      ) : deliveries.isError ? (
        <ErrorState error={deliveries.error} onRetry={() => void deliveries.refetch()} />
      ) : list.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={Bike} title="No deliveries right now" description="Stay available and the kitchen will send your next drop here." />
        </div>
      ) : (
        <>
          {current && (
            <section aria-label="Current delivery" className="space-y-2">
              <h2 className="font-display text-lg font-bold text-ink">On the way now</h2>
              <DeliveryCard order={current} highlight />
            </section>
          )}
          {next.length > 0 && (
            <section aria-label="Up next" className="space-y-2">
              <h2 className="font-display text-lg font-bold text-ink">Up next</h2>
              <div className="space-y-3">
                {next.map((o) => (
                  <DeliveryCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
