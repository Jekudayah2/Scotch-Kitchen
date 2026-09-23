import { Crosshair } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { isStoreLocationConfigured, mapDefaults, store } from '@/config/store'
import { LazyMap, type MapMarkerSpec } from '@/features/maps/lazy-map'
import { useRiderDeliveries } from '@/features/rider/api'
import { useCurrentPosition } from '@/hooks/use-geolocation'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { isValidLatLng, type LatLng } from '@/utils/geo'

/** All active drops on one map. The rider's own position is shown only when they ask. */
export default function RiderMapPage() {
  useDocumentTitle('Delivery map')
  const navigate = useNavigate()
  const deliveries = useRiderDeliveries()
  const { state: gps, locate } = useCurrentPosition()
  const [me, setMe] = useState<LatLng | null>(null)

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = []
    if (isStoreLocationConfigured && store.location) list.push({ id: 'store', kind: 'store', position: store.location, label: `${store.name} kitchen` })
    if (me) list.push({ id: 'me', kind: 'rider', position: me, label: 'You are here' })
    for (const o of deliveries.data ?? []) {
      const position = { latitude: o.delivery_latitude, longitude: o.delivery_longitude }
      if (!isValidLatLng(position)) continue
      list.push({
        id: o.id,
        kind: 'order',
        position,
        label: `${o.order_reference}: ${o.delivery_area || o.delivery_address}. Open delivery.`,
        onClick: () => navigate(`/rider/deliveries/${o.id}`),
      })
    }
    return list
  }, [deliveries.data, me, navigate])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-ink">Map</h1>
        <Button
          variant="secondary"
          size="sm"
          loading={gps.status === 'locating'}
          leadingIcon={<Crosshair aria-hidden="true" />}
          onClick={async () => {
            const fix = await locate()
            if (fix) setMe({ latitude: fix.latitude, longitude: fix.longitude })
          }}
        >
          Show me
        </Button>
      </div>
      {gps.status === 'error' && <Notice tone="warning">{gps.message}</Notice>}
      {deliveries.isPending ? (
        <Skeleton className="h-[60dvh] rounded-card" />
      ) : (
        <LazyMap
          className="h-[calc(100dvh-15rem)] min-h-80 w-full ring-1 ring-line"
          ariaLabel="Map of your deliveries. Tap a pin to open it."
          markers={markers}
          initialCenter={mapDefaults.center}
          initialZoom={mapDefaults.zoom}
          fitKey={markers.map((m) => m.id).join(',')}
        />
      )}
      {!deliveries.isPending && (deliveries.data ?? []).length === 0 && <p className="text-center text-sm text-ink-3">No active deliveries to show.</p>}
    </div>
  )
}
