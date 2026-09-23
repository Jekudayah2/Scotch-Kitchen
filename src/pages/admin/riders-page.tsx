import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bike, Phone, UserPlus } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/controls'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { adminKeys, setRiderAvailability, useAdminRiders } from '@/features/admin/api'
import { AdminPageHeader } from '@/features/admin/ui'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { AdminRiderRow, RiderAvailability } from '@/types/domain'
import { formatDate, formatRelative } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'

const AVAILABILITY: Array<{ value: RiderAvailability; label: string }> = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'OFFLINE', label: 'Offline' },
]

function RiderCard({ rider }: { rider: AdminRiderRow }) {
  const queryClient = useQueryClient()
  const change = useMutation({
    mutationFn: (availability: RiderAvailability) => setRiderAvailability(rider.id as string, availability),
    onSuccess: () => {
      toast.success('Availability updated.')
      void queryClient.invalidateQueries({ queryKey: adminKeys.riders })
    },
    onError: (error) => toast.error(friendlyError(error)),
  })
  return (
    <li className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-ink">{rider.full_name || rider.email}</p>
          <p className="truncate text-sm text-ink-3">{rider.email}</p>
        </div>
        {rider.phone && (
          <Button asChild variant="secondary" size="icon-sm" aria-label={`Call ${rider.full_name ?? 'rider'}`}>
            <a href={`tel:${rider.phone.replace(/\s/g, '')}`}>
              <Phone aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Active', rider.active_deliveries],
          ['Today', rider.delivered_today],
          ['All time', rider.completed_deliveries],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-[0.8rem] bg-surface-2 px-2 py-2.5">
            <dd className="tabular font-display text-xl font-extrabold text-ink">{value ?? 0}</dd>
            <dt className="text-xs font-semibold text-ink-3">{label}</dt>
          </div>
        ))}
      </dl>
      {rider.current_delivery_reference && (
        <p className="text-sm text-ink-2">
          On delivery: <span className="font-mono font-bold text-ink">{rider.current_delivery_reference}</span>
        </p>
      )}
      <div className="space-y-1.5">
        <SegmentedControl
          size="sm"
          label={`Availability of ${rider.full_name ?? 'rider'}`}
          value={(rider.availability ?? 'OFFLINE') as RiderAvailability}
          onChange={(value) => change.mutate(value)}
          options={AVAILABILITY}
        />
        <p className="text-xs text-ink-3">
          {rider.availability_updated_at ? `Changed ${formatRelative(rider.availability_updated_at)}` : 'Not changed yet'} · Rider since {formatDate(rider.rider_since)}
        </p>
      </div>
    </li>
  )
}

export default function AdminRidersPage() {
  useDocumentTitle('Riders')
  const riders = useAdminRiders()
  return (
    <>
      <AdminPageHeader
        title="Riders"
        description="Who’s available, who’s out, and how many drops each has made. Offline riders can’t be assigned."
        actions={
          <Button asChild variant="secondary" leadingIcon={<UserPlus aria-hidden="true" />}>
            <Link to="/admin/settings?tab=team">Add a rider</Link>
          </Button>
        }
      />
      {riders.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading riders">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-card" />
          ))}
        </div>
      ) : riders.isError ? (
        <ErrorState error={riders.error} onRetry={() => void riders.refetch()} />
      ) : riders.data.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={Bike}
            title="No riders yet"
            description="Give someone the rider role in Settings → Team. They’ll get the rider app the next time they sign in."
            action={
              <Button asChild>
                <Link to="/admin/settings?tab=team">Add a rider</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {riders.data.map((r) => (
            <RiderCard key={r.id} rider={r} />
          ))}
        </ul>
      )}
    </>
  )
}
