import { useCallback, useEffect, useRef, useState } from 'react'
import { checkCoordinates, type LatLng } from '@/utils/geo'

export interface GeoFix extends LatLng {
  /** Metres, exactly as reported by the device. */
  accuracy: number
  timestamp: number
}

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'success'; fix: GeoFix }
  | { status: 'error'; message: string; code: 'UNSUPPORTED' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'INVALID' }

const MESSAGES = {
  UNSUPPORTED: 'This browser can’t share your location. Search or tap the map instead.',
  DENIED: 'Location access is blocked. Allow it in your browser settings, or search or tap the map instead.',
  UNAVAILABLE: 'Your location isn’t available right now. Try again outdoors, or search or tap the map.',
  TIMEOUT: 'Finding your location took too long. Try again, or search or tap the map.',
  INVALID: 'Your device reported an invalid position. Please search or tap the map.',
}

function toFix(position: GeolocationPosition): GeoFix | null {
  const check = checkCoordinates(position.coords.latitude, position.coords.longitude)
  if (!check.ok) return null
  return { ...check.value, accuracy: position.coords.accuracy, timestamp: position.timestamp }
}

function errorState(error: GeolocationPositionError): GeoState {
  const code = error.code === error.PERMISSION_DENIED ? 'DENIED' : error.code === error.TIMEOUT ? 'TIMEOUT' : 'UNAVAILABLE'
  return { status: 'error', code, message: MESSAGES[code] }
}

/** One-off high-accuracy position request. GPS is always optional in the UI. */
export function useCurrentPosition() {
  const [state, setState] = useState<GeoState>({ status: 'idle' })
  const locate = useCallback(
    () =>
      new Promise<GeoFix | null>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          setState({ status: 'error', code: 'UNSUPPORTED', message: MESSAGES.UNSUPPORTED })
          resolve(null)
          return
        }
        setState({ status: 'locating' })
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const fix = toFix(position)
            setState(fix ? { status: 'success', fix } : { status: 'error', code: 'INVALID', message: MESSAGES.INVALID })
            resolve(fix)
          },
          (error) => {
            setState(errorState(error))
            resolve(null)
          },
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        )
      }),
    [],
  )
  return { state, locate }
}

/** Continuous position while `enabled` (used by the rider map). Never simulated. */
export function useWatchPosition(enabled: boolean) {
  const [state, setState] = useState<GeoState>({ status: 'idle' })
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      queueMicrotask(() => setState({ status: 'error', code: 'UNSUPPORTED', message: MESSAGES.UNSUPPORTED }))
      return
    }
    queueMicrotask(() => setState({ status: 'locating' }))
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const fix = toFix(position)
        setState(fix ? { status: 'success', fix } : { status: 'error', code: 'INVALID', message: MESSAGES.INVALID })
      },
      (error) => setState(errorState(error)),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
    )
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [enabled])

  return enabled ? state : ({ status: 'idle' } as GeoState)
}
