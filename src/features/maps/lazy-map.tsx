import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/feedback'
import { cn } from '@/utils/cn'
import type { MapCanvasProps } from './map-canvas'

// MapLibre is large; load it only on screens that show a map.
const MapCanvas = lazy(() => import('./map-canvas'))

export type { MapCanvasProps, MapMarkerSpec, MarkerKind } from './map-canvas'

export function LazyMap(props: MapCanvasProps) {
  return (
    <Suspense
      fallback={
        <div className={cn('relative', props.className)}>
          <Skeleton className="absolute inset-0 rounded-3xl" />
          <span className="sr-only">Loading map</span>
        </div>
      }
    >
      <MapCanvas {...props} />
    </Suspense>
  )
}
