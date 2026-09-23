import { env } from '@/config/env'
import { mapDefaults } from '@/config/store'
import { checkCoordinates, type LatLng } from '@/utils/geo'

/**
 * Address search and reverse geocoding via OpenStreetMap Nominatim (free, no
 * key). Nominatim's usage policy allows at most one request per second and
 * forbids search-as-you-type, so requests are queued, cached, and only sent on
 * explicit actions. Swap VITE_GEOCODER_URL for a self-hosted or paid geocoder.
 */
export interface PlaceResult {
  id: string
  label: string
  secondary: string
  area: string | null
  position: LatLng
}

interface NominatimAddress {
  road?: string
  house_number?: string
  neighbourhood?: string
  suburb?: string
  quarter?: string
  village?: string
  town?: string
  city?: string
  county?: string
  state?: string
  amenity?: string
  building?: string
  university?: string
  shop?: string
}

interface NominatimPlace {
  place_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  address?: NominatimAddress
}

const MIN_INTERVAL_MS = 1100
let lastRequest = 0
let queue: Promise<unknown> = Promise.resolve()
const cache = new Map<string, unknown>()

function schedule<T>(key: string, task: () => Promise<T>): Promise<T> {
  if (cache.has(key)) return Promise.resolve(cache.get(key) as T)
  const run = queue.then(async () => {
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequest = Date.now()
    const result = await task()
    cache.set(key, result)
    return result
  })
  queue = run.catch(() => undefined)
  return run
}

function areaOf(address?: NominatimAddress) {
  if (!address) return null
  return address.neighbourhood ?? address.suburb ?? address.quarter ?? address.village ?? address.town ?? address.city ?? null
}

function shortAddress(place: NominatimPlace) {
  const a = place.address ?? {}
  const first = place.name || a.amenity || a.building || a.university || a.shop || [a.house_number, a.road].filter(Boolean).join(' ')
  const locality = areaOf(a)
  const city = a.city ?? a.town ?? a.county
  const parts = [first, locality, city].filter((p, i, all): p is string => !!p && all.indexOf(p) === i)
  return parts.length ? parts.join(', ') : place.display_name.split(',').slice(0, 3).join(',').trim()
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'en' } })
  if (!response.ok) throw new Error(`Geocoder responded ${response.status}`)
  return (await response.json()) as T
}

export async function searchPlaces(query: string, options: { near?: LatLng; signal?: AbortSignal } = {}): Promise<PlaceResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const near = options.near ?? mapDefaults.center
  // Bias results around the delivery area (roughly 40 km box) without hard-bounding them.
  const box = [near.longitude - 0.35, near.latitude + 0.35, near.longitude + 0.35, near.latitude - 0.35].join(',')
  const params = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'gh', viewbox: box, bounded: '0' })
  const url = `${env.geocoderUrl}/search?${params.toString()}`
  const places = await schedule(url, () => getJson<NominatimPlace[]>(url, options.signal))
  return places.flatMap((place) => {
    const check = checkCoordinates(Number(place.lat), Number(place.lon))
    if (!check.ok) return []
    return [
      {
        id: String(place.place_id),
        label: shortAddress(place),
        secondary: place.display_name,
        area: areaOf(place.address),
        position: check.value,
      },
    ]
  })
}

export async function reverseGeocode(position: LatLng, options: { signal?: AbortSignal } = {}): Promise<{ address: string; area: string | null } | null> {
  const params = new URLSearchParams({
    lat: position.latitude.toFixed(6),
    lon: position.longitude.toFixed(6),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
  })
  const url = `${env.geocoderUrl}/reverse?${params.toString()}`
  try {
    const place = await schedule(url, () => getJson<NominatimPlace & { error?: string }>(url, options.signal))
    if (!place || 'error' in place) return null
    return { address: shortAddress(place), area: areaOf(place.address) }
  } catch {
    return null
  }
}
