import { Bookmark, CheckCircle2, Crosshair, LoaderCircle, MapPin, MousePointerClick, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { isStoreLocationConfigured, mapDefaults, store } from '@/config/store'
import { LazyMap, type MapMarkerSpec } from '@/features/maps/lazy-map'
import { useCurrentPosition } from '@/hooks/use-geolocation'
import { reverseGeocode, searchPlaces, type PlaceResult } from '@/services/geocoding'
import type { SavedLocation } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatAccuracy, formatCoordinates, isWithinBounds, type Bounds, type LatLng } from '@/utils/geo'
import { blankPoint, canConfirm, type DeliveryPoint, type LocationAction, type LocationPickerState } from './location-state'
import { savedToPoint } from './saved-locations'

const SOURCE_LABEL: Record<DeliveryPoint['source'], string> = {
  GPS: 'From your device’s GPS',
  SEARCH: 'From search',
  MAP: 'Pinned on the map',
  SAVED: 'Saved location',
}

interface LocationPickerProps {
  state: LocationPickerState
  dispatch: Dispatch<LocationAction>
  savedLocations: SavedLocation[]
  bounds: Bounds | null
  className?: string
}

export function LocationPicker({ state, dispatch, savedLocations, bounds, className }: LocationPickerProps) {
  const { state: gps, locate } = useCurrentPosition()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ point: LatLng; zoom?: number; key: number } | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [method, setMethod] = useState<'gps' | 'search' | 'map' | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const mapArea = useRef<HTMLDivElement>(null)
  const focusCounter = useRef(0)
  const temporary = state.temporary
  const confirmed = state.confirmed

  const focusOn = (point: LatLng, zoom = 17) => {
    focusCounter.current += 1
    setFocus({ point, zoom, key: focusCounter.current })
  }

  const propose = (point: DeliveryPoint, zoom?: number) => {
    dispatch({ type: 'propose', point })
    focusOn(point, zoom)
  }

  // Suggest an address for pins that arrive without one (map taps, GPS fixes, drags).
  const tempLat = temporary?.latitude
  const tempLng = temporary?.longitude
  const tempHasAddress = Boolean(temporary?.address)
  useEffect(() => {
    if (tempLat === undefined || tempLng === undefined || tempHasAddress) return
    const controller = new AbortController()
    queueMicrotask(() => setLookingUp(true))
    reverseGeocode({ latitude: tempLat, longitude: tempLng }, { signal: controller.signal })
      .then((result) => {
        if (result && !controller.signal.aborted) dispatch({ type: 'updateTemporary', patch: { address: result.address, area: result.area } })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLookingUp(false)
      })
    return () => controller.abort()
  }, [tempLat, tempLng, tempHasAddress, dispatch])

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (query.trim().length < 3) {
      setSearchError('Type at least 3 characters, e.g. “Unity Hall KNUST”.')
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const places = await searchPlaces(query)
      setResults(places)
      if (places.length === 0) setSearchError('No matches. Try a nearby landmark, or tap the map.')
    } catch {
      setSearchError('Search isn’t available right now. Use your location or tap the map instead.')
    } finally {
      setSearching(false)
    }
  }

  const locateMe = async () => {
    const fix = await locate()
    if (fix) propose(blankPoint(fix, 'GPS', { accuracy: fix.accuracy }), fix.accuracy > 200 ? 15 : 17)
  }

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = []
    if (isStoreLocationConfigured && store.location) {
      list.push({ id: 'store', position: store.location, kind: 'store', label: `${store.name} kitchen` })
    }
    if (confirmed) {
      list.push({ id: 'confirmed', position: confirmed, kind: 'confirmed', label: `Confirmed delivery location: ${confirmed.address}` })
    }
    if (temporary) {
      list.push({
        id: 'temporary',
        position: temporary,
        kind: 'temporary',
        label: 'Proposed delivery location. Drag to adjust.',
        draggable: true,
        onDragEnd: (to) => dispatch({ type: 'moveTemporary', to }),
      })
    }
    return list
  }, [confirmed, temporary, dispatch])

  const outOfArea = temporary ? !isWithinBounds(temporary, bounds) : false
  const confirmable = temporary ? canConfirm(temporary, bounds) : false

  return (
    <div className={cn('space-y-4', className)}>
      {/* Three ways to choose a spot. GPS is optional; search and map work without it. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="How do you want to choose your location?">
        {(
          [
            { id: 'gps', icon: Crosshair, label: 'Use my location', hint: 'Best outdoors' },
            { id: 'search', icon: Search, label: 'Search a place', hint: 'Street or landmark' },
            { id: 'map', icon: MousePointerClick, label: 'Pick on map', hint: 'Tap your spot' },
          ] as const
        ).map(({ id, icon: Icon, label, hint }) => {
          const active = method === id
          const busy = id === 'gps' && gps.status === 'locating'
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setMethod(id)
                if (id === 'gps') void locateMe()
                if (id === 'search') queueMicrotask(() => searchInput.current?.focus())
                if (id === 'map') mapArea.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
              className={cn(
                'flex min-h-24 flex-col items-start justify-between gap-2 rounded-[1rem] border-2 p-3 text-left transition-[border-color,background-color,transform] duration-200 sm:p-4',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] motion-reduce:active:scale-100',
                active ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className={cn('grid size-9 place-items-center rounded-[0.7rem]', active ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-2')}>
                {busy ? <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" /> : <Icon className="size-4.5" aria-hidden="true" />}
              </span>
              <span>
                <span className={cn('block text-sm leading-tight font-bold', active ? 'text-primary-text' : 'text-ink')}>{label}</span>
                <span className="hidden text-xs text-ink-3 sm:block">{hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {method === 'search' && (
        <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2" role="search">
          <label htmlFor="location-search" className="sr-only">
            Search for a place, street or landmark
          </label>
          <Input
            ref={searchInput}
            id="location-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Unity Hall KNUST"
            className="h-12"
            autoComplete="off"
            enterKeyHint="search"
          />
          <Button type="submit" size="lg" loading={searching} aria-label="Search" className="px-4">
            <Search aria-hidden="true" />
          </Button>
        </form>
      )}

      {gps.status === 'error' && <Notice tone="warning">{gps.message}</Notice>}
      {searchError && <Notice tone="neutral">{searchError}</Notice>}

      {results && results.length > 0 && (
        <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-[1rem] border border-line bg-surface" aria-label="Search results">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                onClick={() => {
                  propose(blankPoint(place.position, 'SEARCH', { address: place.label, area: place.area }))
                  setResults(null)
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{place.label}</span>
                  <span className="block truncate text-xs text-ink-3">{place.secondary}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {savedLocations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-2">Saved:</span>
          {savedLocations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => propose(savedToPoint(location))}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                confirmed?.savedLocationId === location.id ? 'bg-primary-soft text-primary-text ring-primary/30' : 'bg-surface text-ink ring-line hover:ring-line-strong',
              )}
            >
              <Bookmark className="size-4" aria-hidden="true" />
              {location.label}
            </button>
          ))}
        </div>
      )}

      <div ref={mapArea} className="relative scroll-mt-24">
        <LazyMap
          className="h-[20rem] w-full ring-1 ring-line sm:h-[24rem]"
          ariaLabel="Delivery map. Tap to drop a pin."
          markers={markers}
          initialCenter={confirmed ?? mapDefaults.center}
          initialZoom={confirmed ? 16 : mapDefaults.zoom}
          focus={focus}
          onMapClick={(position) => dispatch({ type: 'propose', point: blankPoint(position, 'MAP') })}
        />
        <p
          className={cn(
            'glass pointer-events-none absolute top-3 left-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-ink shadow-soft',
            method === 'map' && 'ring-2 ring-primary',
          )}
        >
          <MousePointerClick className="size-3.5" aria-hidden="true" />
          Tap the map to drop a pin
        </p>
      </div>

      {temporary ? (
        <section
          aria-labelledby="confirm-location-title"
          className="space-y-4 rounded-card border-2 border-brand bg-brand-soft/40 p-5 dark:bg-brand-soft"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 id="confirm-location-title" className="font-display text-lg font-bold text-ink">
              Is this your delivery location?
            </h3>
            <Badge tone="brand">{SOURCE_LABEL[temporary.source]}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" hint={lookingUp && !temporary.address ? 'Looking up the address…' : 'Edit it so a rider would recognise it.'} required>
              <Input
                value={temporary.address}
                onChange={(e) => dispatch({ type: 'updateTemporary', patch: { address: e.target.value } })}
                placeholder="e.g. Unity Hall, KNUST"
                maxLength={300}
              />
            </Field>
            <Field label="Landmark" optional>
              <Input
                value={temporary.landmark}
                onChange={(e) => dispatch({ type: 'updateTemporary', patch: { landmark: e.target.value } })}
                placeholder="e.g. Opposite the blue gate"
                maxLength={200}
              />
            </Field>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-ink-2">Coordinates</dt>
              <dd className="font-mono text-ink">{formatCoordinates(temporary)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-2">Accuracy</dt>
              <dd className="text-ink">{formatAccuracy(temporary.accuracy)}</dd>
            </div>
          </dl>
          {temporary.accuracy !== null && temporary.accuracy > 100 && (
            <Notice tone="warning">Your device’s reading is only accurate to {formatAccuracy(temporary.accuracy)}. Drag the pin to your exact spot.</Notice>
          )}
          {outOfArea && (
            <Notice tone="danger" title="Outside our delivery area">
              We can’t deliver to this pin. Please choose a location within our delivery area.
            </Notice>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={() => dispatch({ type: 'confirm' })} disabled={!confirmable} leadingIcon={<CheckCircle2 aria-hidden="true" />}>
              Confirm This Location
            </Button>
            <Button size="lg" variant="secondary" onClick={() => dispatch({ type: 'discard' })}>
              Choose Another Location
            </Button>
          </div>
        </section>
      ) : confirmed ? (
        <section aria-label="Confirmed delivery location" className="flex gap-4 rounded-card border border-line bg-surface p-5 shadow-soft">
          <span className="grid size-11 shrink-0 place-items-center rounded-control bg-success-soft text-success-text">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-success-text">Delivery location confirmed</p>
            <p className="font-semibold text-ink">{confirmed.address}</p>
            {confirmed.landmark && <p className="text-sm text-ink-2">Landmark: {confirmed.landmark}</p>}
            <p className="font-mono text-xs text-ink-3">
              {formatCoordinates(confirmed)} · {formatAccuracy(confirmed.accuracy)}
            </p>
            <p className="pt-1 text-xs text-ink-3">To change it, tap the map, search, or use your location, then confirm the new pin.</p>
          </div>
        </section>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-3">
          {gps.status === 'locating' ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
          Choose your delivery location using your GPS, a search, a saved place or the map, then confirm it.
        </p>
      )}
    </div>
  )
}
