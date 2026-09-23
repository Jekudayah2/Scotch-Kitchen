/**
 * Coordinate safety.
 *
 * Canonical form everywhere in the app and database: { latitude, longitude }.
 * MapLibre (and GeoJSON) use [longitude, latitude]. The ONLY conversions between
 * the two live in this file (toMapLibre / fromMapLibre). Values are validated,
 * never silently swapped: a suspicious pair is reported as an error instead.
 */

export interface LatLng {
  latitude: number
  longitude: number
}

/** MapLibre / GeoJSON order. Named tuple members make the order explicit at call sites. */
export type LngLatTuple = [longitude: number, latitude: number]

export type CoordinateIssue =
  | 'LATITUDE_NOT_A_NUMBER'
  | 'LONGITUDE_NOT_A_NUMBER'
  | 'LATITUDE_OUT_OF_RANGE'
  | 'LONGITUDE_OUT_OF_RANGE'
  | 'NULL_ISLAND'

export type CoordinateCheck = { ok: true; value: LatLng } | { ok: false; issues: CoordinateIssue[] }

export class CoordinateError extends Error {
  readonly issues: CoordinateIssue[]
  constructor(issues: CoordinateIssue[]) {
    super(`Invalid coordinates: ${issues.join(', ')}`)
    this.name = 'CoordinateError'
    this.issues = issues
  }
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function checkCoordinates(latitude: unknown, longitude: unknown): CoordinateCheck {
  const issues: CoordinateIssue[] = []
  if (!isFiniteNumber(latitude)) issues.push('LATITUDE_NOT_A_NUMBER')
  else if (latitude < -90 || latitude > 90) issues.push('LATITUDE_OUT_OF_RANGE')
  if (!isFiniteNumber(longitude)) issues.push('LONGITUDE_NOT_A_NUMBER')
  else if (longitude < -180 || longitude > 180) issues.push('LONGITUDE_OUT_OF_RANGE')
  if (issues.length === 0 && latitude === 0 && longitude === 0) issues.push('NULL_ISLAND')
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: { latitude: latitude as number, longitude: longitude as number } }
}

export function isValidLatLng(point: Partial<LatLng> | null | undefined): point is LatLng {
  return !!point && checkCoordinates(point.latitude, point.longitude).ok
}

/** Validates and returns a canonical point, or throws CoordinateError. */
export function toLatLng(latitude: unknown, longitude: unknown): LatLng {
  const result = checkCoordinates(latitude, longitude)
  if (!result.ok) throw new CoordinateError(result.issues)
  return result.value
}

/** Canonical { latitude, longitude } → MapLibre [longitude, latitude]. */
export function toMapLibre(point: LatLng): LngLatTuple {
  const { latitude, longitude } = toLatLng(point.latitude, point.longitude)
  return [longitude, latitude]
}

/** MapLibre { lng, lat } (or a [lng, lat] tuple) → canonical { latitude, longitude }. */
export function fromMapLibre(lngLat: { lng: number; lat: number } | LngLatTuple): LatLng {
  if (Array.isArray(lngLat)) {
    const [longitude, latitude] = lngLat
    return toLatLng(latitude, longitude)
  }
  return toLatLng(lngLat.lat, lngLat.lng)
}

export function formatCoordinates(point: LatLng, digits = 6) {
  return `${point.latitude.toFixed(digits)}, ${point.longitude.toFixed(digits)}`
}

/** Human-readable accuracy. Never invents a value when none was measured. */
export function formatAccuracy(meters: number | null | undefined) {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return 'Not measured'
  if (meters < 1) return '±1 m'
  if (meters >= 1000) return `±${(meters / 1000).toFixed(1)} km`
  return `±${Math.round(meters)} m`
}

export interface Bounds {
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
}

export function isWithinBounds(point: LatLng, bounds: Bounds | null | undefined) {
  if (!bounds) return true
  return (
    point.latitude >= bounds.minLatitude &&
    point.latitude <= bounds.maxLatitude &&
    point.longitude >= bounds.minLongitude &&
    point.longitude <= bounds.maxLongitude
  )
}

/**
 * Great-circle ("as the crow flies") distance in metres. This is NOT road
 * distance and must always be labelled as straight-line where displayed.
 */
export function straightLineDistanceMeters(a: LatLng, b: LatLng) {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// ---- External navigation links (these URL formats all take LATITUDE first) ----

const fixed = (n: number) => n.toFixed(6)

/** Google Maps turn-by-turn directions to the exact stored pin. */
export function googleMapsDirectionsUrl(destination: LatLng, origin?: LatLng) {
  const d = toLatLng(destination.latitude, destination.longitude)
  const params = new URLSearchParams({
    api: '1',
    destination: `${fixed(d.latitude)},${fixed(d.longitude)}`,
    travelmode: 'driving',
  })
  if (origin && isValidLatLng(origin)) params.set('origin', `${fixed(origin.latitude)},${fixed(origin.longitude)}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** OpenStreetMap with a marker on the exact stored pin. */
export function openStreetMapUrl(point: LatLng, zoom = 18) {
  const p = toLatLng(point.latitude, point.longitude)
  return `https://www.openstreetmap.org/?mlat=${fixed(p.latitude)}&mlon=${fixed(p.longitude)}#map=${zoom}/${fixed(p.latitude)}/${fixed(p.longitude)}`
}

/** OpenStreetMap car routing from an optional origin to the pin. */
export function openStreetMapDirectionsUrl(destination: LatLng, origin?: LatLng) {
  const d = toLatLng(destination.latitude, destination.longitude)
  const to = `${fixed(d.latitude)},${fixed(d.longitude)}`
  const from = origin && isValidLatLng(origin) ? `${fixed(origin.latitude)},${fixed(origin.longitude)}` : ''
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`${from};${to}`)}`
}
