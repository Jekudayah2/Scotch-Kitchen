import { describe, expect, it } from 'vitest'
import {
  checkCoordinates,
  CoordinateError,
  formatAccuracy,
  formatCoordinates,
  fromMapLibre,
  googleMapsDirectionsUrl,
  isWithinBounds,
  openStreetMapDirectionsUrl,
  openStreetMapUrl,
  straightLineDistanceMeters,
  toMapLibre,
} from './geo'

const KNUST = { latitude: 6.6745, longitude: -1.5716 }

describe('coordinate validation', () => {
  it('accepts valid pairs including the extremes', () => {
    expect(checkCoordinates(90, 180)).toEqual({ ok: true, value: { latitude: 90, longitude: 180 } })
    expect(checkCoordinates(-90, -180).ok).toBe(true)
    expect(checkCoordinates(KNUST.latitude, KNUST.longitude).ok).toBe(true)
  })

  it.each([
    [90.0001, 0.5, 'LATITUDE_OUT_OF_RANGE'],
    [-91, 10, 'LATITUDE_OUT_OF_RANGE'],
    [10, 180.5, 'LONGITUDE_OUT_OF_RANGE'],
    [10, -181, 'LONGITUDE_OUT_OF_RANGE'],
    [Number.NaN, 1, 'LATITUDE_NOT_A_NUMBER'],
    ['6.67', 1, 'LATITUDE_NOT_A_NUMBER'],
    [1, Number.POSITIVE_INFINITY, 'LONGITUDE_NOT_A_NUMBER'],
    [0, 0, 'NULL_ISLAND'],
  ])('rejects (%s, %s) with %s', (lat, lng, issue) => {
    const result = checkCoordinates(lat, lng)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues).toContain(issue)
  })

  it('never silently swaps a suspicious pair', () => {
    // Longitude 120 as a latitude is impossible; it must be reported, not "fixed".
    const result = checkCoordinates(120, 6.67)
    expect(result).toEqual({ ok: false, issues: ['LATITUDE_OUT_OF_RANGE'] })
  })
})

describe('MapLibre conversion', () => {
  it('converts canonical { latitude, longitude } to [longitude, latitude]', () => {
    expect(toMapLibre(KNUST)).toEqual([-1.5716, 6.6745])
  })

  it('converts MapLibre { lng, lat } and tuples back to canonical form', () => {
    expect(fromMapLibre({ lng: -1.5716, lat: 6.6745 })).toEqual(KNUST)
    expect(fromMapLibre([-1.5716, 6.6745])).toEqual(KNUST)
  })

  it('round-trips without drift', () => {
    expect(fromMapLibre(toMapLibre(KNUST))).toEqual(KNUST)
  })

  it('throws instead of passing invalid values to the map', () => {
    expect(() => toMapLibre({ latitude: 200, longitude: 1 })).toThrow(CoordinateError)
    expect(() => fromMapLibre({ lng: 1, lat: -95 })).toThrow(CoordinateError)
  })
})

describe('formatting and navigation links', () => {
  it('formats coordinates latitude-first and accuracy honestly', () => {
    expect(formatCoordinates(KNUST)).toBe('6.674500, -1.571600')
    expect(formatAccuracy(12.4)).toBe('±12 m')
    expect(formatAccuracy(1500)).toBe('±1.5 km')
    expect(formatAccuracy(null)).toBe('Not measured')
  })

  it('builds Google Maps directions to the exact pin (lat,lng order)', () => {
    const url = new URL(googleMapsDirectionsUrl(KNUST))
    expect(url.hostname).toBe('www.google.com')
    expect(url.searchParams.get('destination')).toBe('6.674500,-1.571600')
    expect(url.searchParams.get('api')).toBe('1')
  })

  it('builds OpenStreetMap links to the exact pin', () => {
    expect(openStreetMapUrl(KNUST)).toBe('https://www.openstreetmap.org/?mlat=6.674500&mlon=-1.571600#map=18/6.674500/-1.571600')
    expect(decodeURIComponent(openStreetMapDirectionsUrl(KNUST))).toContain('route=;6.674500,-1.571600')
  })

  it('refuses to build links for invalid pins', () => {
    expect(() => googleMapsDirectionsUrl({ latitude: 0, longitude: 0 })).toThrow(CoordinateError)
  })
})

describe('bounds and distance', () => {
  const ghana = { minLatitude: 4.5, maxLatitude: 11.2, minLongitude: -3.3, maxLongitude: 1.3 }
  it('detects a swapped Kumasi pin as outside Ghana', () => {
    expect(isWithinBounds(KNUST, ghana)).toBe(true)
    expect(isWithinBounds({ latitude: KNUST.longitude, longitude: KNUST.latitude }, ghana)).toBe(false)
  })

  it('computes straight-line distance', () => {
    const d = straightLineDistanceMeters(KNUST, { latitude: 6.6885, longitude: -1.6244 })
    expect(d).toBeGreaterThan(5000)
    expect(d).toBeLessThan(7000)
  })
})
