import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { MapPinOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { env } from '@/config/env'
import { useTheme } from '@/features/theme/theme-provider'
import { cn } from '@/utils/cn'
import { fromMapLibre, isValidLatLng, toMapLibre, type LatLng } from '@/utils/geo'

// maplibre v6 locates its worker at runtime; point it at the bundled copy explicitly.
setWorkerUrl(workerUrl)

export type MarkerKind = 'confirmed' | 'temporary' | 'store' | 'order' | 'rider'

export interface MapMarkerSpec {
  id: string
  position: LatLng
  kind: MarkerKind
  /** Accessible name / tooltip (plain text). */
  label: string
  /** Short text inside the marker, e.g. a queue number (plain text). */
  badge?: string
  /** CSS colour for `order` markers. */
  tone?: string
  draggable?: boolean
  onDragEnd?: (position: LatLng) => void
  onClick?: () => void
  /** Plain-text popup content. Never HTML. */
  popup?: { title: string; lines?: string[] }
}

export interface MapCanvasProps {
  markers: MapMarkerSpec[]
  initialCenter: LatLng
  initialZoom?: number
  /** Fly to this point whenever `key` changes. */
  focus?: { point: LatLng; zoom?: number; key: string | number } | null
  /** Fit all markers into view whenever this value changes. */
  fitKey?: string | number
  onMapClick?: (position: LatLng) => void
  className?: string
  ariaLabel: string
}

const PIN_SVG =
  '<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="16" cy="15.5" r="5.5" fill="white"/></svg>'

function markerElement(spec: MapMarkerSpec) {
  const el = document.createElement('div')
  el.setAttribute('role', spec.onClick ? 'button' : 'img')
  el.setAttribute('aria-label', spec.label)
  el.title = spec.label
  if (spec.onClick) el.tabIndex = 0

  switch (spec.kind) {
    case 'confirmed':
      el.className = 'sk-marker text-[var(--primary)] drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] cursor-pointer'
      el.innerHTML = PIN_SVG
      break
    case 'temporary': {
      el.className = 'sk-marker relative grid size-11 place-items-center cursor-grab'
      const ring = document.createElement('span')
      ring.className = 'absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--brand)_35%,transparent)] animate-pulse-ring'
      const dot = document.createElement('span')
      dot.className = 'relative size-5 rounded-full border-[3px] border-white bg-[var(--brand)] shadow-lg'
      el.append(ring, dot)
      break
    }
    case 'store': {
      el.className = 'sk-marker grid size-10 place-items-center rounded-2xl bg-[#1d1816] text-white shadow-lg ring-2 ring-white font-display font-extrabold text-lg'
      el.textContent = 'S'
      break
    }
    case 'rider': {
      el.className = 'sk-marker relative grid size-8 place-items-center'
      const ring = document.createElement('span')
      ring.className = 'absolute inset-0 rounded-full bg-[rgba(31,95,160,0.3)] animate-pulse-ring'
      const dot = document.createElement('span')
      dot.className = 'relative size-4 rounded-full border-[3px] border-white bg-[#1f5fa0] shadow-lg'
      el.append(ring, dot)
      break
    }
    case 'order': {
      el.className =
        'sk-marker grid min-w-9 h-9 place-items-center rounded-full px-2 text-sm font-bold text-white shadow-lg ring-[3px] ring-white cursor-pointer'
      el.style.background = spec.tone ?? 'var(--primary)'
      el.textContent = spec.badge ?? ''
      break
    }
  }
  if (spec.onClick) {
    const activate = () => spec.onClick?.()
    el.addEventListener('click', (event) => {
      event.stopPropagation()
      activate()
    })
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        activate()
      }
    })
  }
  return el
}

function popupNode(popup: NonNullable<MapMarkerSpec['popup']>) {
  const root = document.createElement('div')
  root.className = 'space-y-0.5'
  const title = document.createElement('p')
  title.className = 'font-semibold text-sm'
  title.textContent = popup.title
  root.append(title)
  for (const line of popup.lines ?? []) {
    const p = document.createElement('p')
    p.className = 'text-xs opacity-80'
    p.textContent = line
    root.append(p)
  }
  return root
}

/**
 * MapLibre wrapper. Canonical {latitude, longitude} points go in and come out;
 * the [lng, lat] conversion happens only through utils/geo.
 */
export default function MapCanvas({ markers, initialCenter, initialZoom = 13, focus, fitKey, onMapClick, className, ariaLabel }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRefs = useRef(new Map<string, { marker: Marker; signature: string }>())
  const clickRef = useRef(onMapClick)
  const { resolved } = useTheme()
  const [failed, setFailed] = useState<string | null>(null)
  const styleUrl = resolved === 'dark' ? env.mapStyleUrlDark : env.mapStyleUrl

  useEffect(() => {
    clickRef.current = onMapClick
  }, [onMapClick])

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: styleUrl,
        center: toMapLibre(initialCenter),
        zoom: initialZoom,
        attributionControl: false,
        cooperativeGestures: false,
      })
    } catch (error) {
      queueMicrotask(() => setFailed(error instanceof Error ? error.message : 'Map unavailable'))
      return
    }
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    map.on('click', (event) => {
      try {
        clickRef.current?.(fromMapLibre(event.lngLat))
      } catch {
        /* invalid point: ignore */
      }
    })
    map.on('error', (event) => {
      if (import.meta.env.DEV) console.warn('Map error', event.error)
    })
    mapRef.current = map
    const markersRef = markerRefs.current
    return () => {
      markersRef.forEach(({ marker }) => marker.remove())
      markersRef.clear()
      map.remove()
      mapRef.current = null
    }
    // The map instance is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the theme.
  useEffect(() => {
    mapRef.current?.setStyle(styleUrl)
  }, [styleUrl])

  // Sync markers (recreate a marker only when its visual signature changes).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const spec of markers) {
      if (!isValidLatLng(spec.position)) continue
      seen.add(spec.id)
      const signature = `${spec.kind}|${spec.badge ?? ''}|${spec.tone ?? ''}|${spec.label}|${spec.draggable ? 1 : 0}|${spec.popup ? JSON.stringify(spec.popup) : ''}`
      const existing = markerRefs.current.get(spec.id)
      if (existing && existing.signature === signature) {
        existing.marker.setLngLat(toMapLibre(spec.position))
        continue
      }
      existing?.marker.remove()
      const marker = new Marker({
        element: markerElement(spec),
        anchor: spec.kind === 'confirmed' ? 'bottom' : 'center',
        draggable: Boolean(spec.draggable),
      }).setLngLat(toMapLibre(spec.position))
      if (spec.popup) marker.setPopup(new Popup({ offset: 18, closeButton: false }).setDOMContent(popupNode(spec.popup)))
      if (spec.draggable && spec.onDragEnd) {
        const onDragEnd = spec.onDragEnd
        marker.on('dragend', () => {
          try {
            onDragEnd(fromMapLibre(marker.getLngLat()))
          } catch {
            /* ignore invalid drag positions */
          }
        })
      }
      marker.addTo(map)
      markerRefs.current.set(spec.id, { marker, signature })
    }
    for (const [id, { marker }] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove()
        markerRefs.current.delete(id)
      }
    }
  }, [markers])

  // Fly to a focus point.
  const focusKey = focus?.key
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus || !isValidLatLng(focus.point)) return
    map.flyTo({ center: toMapLibre(focus.point), zoom: focus.zoom ?? Math.max(map.getZoom(), 16), speed: 1.4 })
    // Only re-run when the caller changes the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])

  // Fit all markers.
  useEffect(() => {
    const map = mapRef.current
    if (!map || fitKey === undefined) return
    const points = markers.filter((m) => isValidLatLng(m.position))
    if (points.length === 0) return
    if (points.length === 1) {
      map.jumpTo({ center: toMapLibre((points[0] as MapMarkerSpec).position), zoom: 15 })
      return
    }
    const bounds = new LngLatBounds()
    for (const p of points) bounds.extend(toMapLibre(p.position))
    map.fitBounds(bounds, { padding: 64, maxZoom: 16, duration: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  if (failed) {
    return (
      <div className={cn('grid place-items-center rounded-3xl bg-surface-2 p-6 text-center', className)} role="note">
        <div className="max-w-xs space-y-2 text-ink-3">
          <MapPinOff className="mx-auto size-7" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">The map can’t be shown on this device</p>
          <p className="text-xs">You can still use your location or search for an address.</p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className={cn('overflow-hidden rounded-3xl', className)} role="region" aria-label={ariaLabel} />
}
