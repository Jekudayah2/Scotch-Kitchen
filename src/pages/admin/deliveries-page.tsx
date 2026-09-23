import { Bike, MapPinOff, Navigation } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/feedback'
import { isStoreLocationConfigured, mapDefaults, store } from '@/config/store'
import { useAdminOrders, useAdminRiders } from '@/features/admin/api'
import { AdminOrderDrawer } from '@/features/admin/order-drawer'
import { AdminPageHeader } from '@/features/admin/ui'
import { useOrderParam } from '@/features/admin/use-order-param'
import { LazyMap, type MapMarkerSpec } from '@/features/maps/lazy-map'
import { OrderStatusBadge } from '@/features/orders/components'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { OrderStatus } from '@/types/domain'
import { formatRelative } from '@/utils/dates'
import { isValidLatLng } from '@/utils/geo'

const GROUPS: Array<{ status: OrderStatus; title: string }> = [
  { status: 'OUT_FOR_DELIVERY', title: 'On the way' },
  { status: 'ASSIGNED', title: 'Assigned, waiting to leave' },
  { status: 'READY', title: 'Ready for a rider' },
  { status: 'PREPARING', title: 'In the kitchen' },
  { status: 'PAID', title: 'New' },
]

export default function AdminDeliveriesPage() {
  useDocumentTitle('Deliveries')
  const orders = useAdminOrders({ filter: 'active', limit: 200 })
  const riders = useAdminRiders()
  const { orderId, open, close } = useOrderParam()
  const list = useMemo(() => orders.data ?? [], [orders.data])

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const result: MapMarkerSpec[] = []
    if (isStoreLocationConfigured && store.location) result.push({ id: 'store', kind: 'store', position: store.location, label: `${store.name} kitchen` })
    for (const o of list) {
      const position = { latitude: o.delivery_latitude ?? NaN, longitude: o.delivery_longitude ?? NaN }
      if (!o.id || !isValidLatLng(position)) continue
      result.push({
        id: o.id,
        kind: 'order',
        position,
        label: `${o.order_reference}, ${o.contact_name}, ${o.delivery_area ?? o.delivery_address ?? ''}. Open order.`,
        onClick: () => open(o.id as string),
      })
    }
    return result
    // `open` only writes the URL; markers depend on the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list])

  const withoutPin = list.filter((o) => !isValidLatLng({ latitude: o.delivery_latitude ?? NaN, longitude: o.delivery_longitude ?? NaN }))

  return (
    <>
      <AdminPageHeader title="Deliveries" description="Every active order on the map, grouped by where it is in the journey. Tap a pin or a row to open it." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="relative">
          <LazyMap
            className="h-[26rem] w-full ring-1 ring-line sm:h-[34rem] xl:h-[calc(100dvh-13rem)]"
            ariaLabel="Map of active delivery destinations"
            markers={markers}
            initialCenter={mapDefaults.center}
            initialZoom={mapDefaults.zoom}
            fitKey={markers.map((m) => m.id).join(',')}
          />
          {!isStoreLocationConfigured && (
            <p className="glass pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-soft">
              <MapPinOff className="size-3.5" aria-hidden="true" />
              Kitchen pin not set (VITE_STORE_LATITUDE / LONGITUDE)
            </p>
          )}
        </div>

        <div className="space-y-5">
          <section aria-label="Riders" className="rounded-card border border-line bg-surface p-4">
            <h2 className="eyebrow mb-3 text-ink-3">Riders</h2>
            {riders.isPending ? (
              <Skeleton className="h-16 rounded-[0.8rem]" />
            ) : (riders.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-3">No riders yet. Add one in Settings → Team.</p>
            ) : (
              <ul className="space-y-2">
                {(riders.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Bike className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                      <span className="truncate font-semibold text-ink">{r.full_name ?? r.email}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.current_delivery_reference && <span className="font-mono text-xs text-ink-3">{r.current_delivery_reference}</span>}
                      <Badge tone={r.availability === 'AVAILABLE' ? 'success' : r.availability === 'BUSY' ? 'warning' : 'neutral'} size="sm">
                        {r.availability === 'AVAILABLE' ? 'Available' : r.availability === 'BUSY' ? 'Busy' : 'Offline'}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {orders.isPending ? (
            <Skeleton className="h-64 rounded-card" />
          ) : (
            GROUPS.map(({ status, title }) => {
              const group = list.filter((o) => o.order_status === status)
              if (group.length === 0) return null
              return (
                <section key={status} aria-label={title} className="rounded-card border border-line bg-surface p-2">
                  <h2 className="eyebrow px-2 pt-2 pb-1 text-ink-3">
                    {title} · {group.length}
                  </h2>
                  <ul>
                    {group.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => o.id && open(o.id)}
                          className="flex w-full items-start gap-3 rounded-[0.8rem] px-2 py-2.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                        >
                          <Navigation className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-ink">{o.order_reference}</span>
                              <OrderStatusBadge status={o.order_status as OrderStatus} audience="staff" size="sm" />
                            </span>
                            <span className="block truncate text-sm text-ink-2">{o.delivery_area ?? o.delivery_address}</span>
                            <span className="block text-xs text-ink-3">
                              {o.rider_name ? `${o.rider_name} · ` : ''}
                              {formatRelative(o.updated_at)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
          {!orders.isPending && list.length === 0 && (
            <p className="rounded-card border border-line bg-surface p-6 text-center text-sm text-ink-3">No active deliveries right now.</p>
          )}
          {withoutPin.length > 0 && <p className="text-xs text-ink-3">{withoutPin.length} active order(s) have no valid pin and aren’t on the map.</p>}
        </div>
      </div>
      <AdminOrderDrawer orderId={orderId} onClose={close} />
    </>
  )
}
