import { checkCoordinates, isWithinBounds, type Bounds, type LatLng } from '@/utils/geo'

export type LocationSource = 'GPS' | 'SEARCH' | 'MAP' | 'SAVED'

/** A delivery destination as the customer sees and confirms it. */
export interface DeliveryPoint extends LatLng {
  /** Metres, only when the device measured it (GPS). Never invented. */
  accuracy: number | null
  source: LocationSource
  address: string
  area: string | null
  landmark: string
  instructions: string
  savedLocationId: string | null
}

/**
 * Two slots, by design:
 *  - temporary: a proposal from a map tap, search result, GPS fix or saved pin.
 *  - confirmed: the destination the order will use.
 * Only an explicit `confirm` moves temporary → confirmed, so stray taps can
 * never silently replace a confirmed destination.
 */
export interface LocationPickerState {
  temporary: DeliveryPoint | null
  confirmed: DeliveryPoint | null
}

export type LocationAction =
  | { type: 'propose'; point: DeliveryPoint }
  | { type: 'updateTemporary'; patch: Partial<DeliveryPoint> }
  | { type: 'moveTemporary'; to: LatLng }
  | { type: 'confirm' }
  | { type: 'discard' }
  | { type: 'updateConfirmed'; patch: Pick<Partial<DeliveryPoint>, 'landmark' | 'instructions' | 'address'> }
  | { type: 'clear' }

export const initialPickerState: LocationPickerState = { temporary: null, confirmed: null }

export function locationReducer(state: LocationPickerState, action: LocationAction): LocationPickerState {
  switch (action.type) {
    case 'propose': {
      const check = checkCoordinates(action.point.latitude, action.point.longitude)
      if (!check.ok) return state
      return { ...state, temporary: { ...action.point, ...check.value } }
    }
    case 'updateTemporary':
      if (!state.temporary) return state
      return { ...state, temporary: { ...state.temporary, ...action.patch } }
    case 'moveTemporary': {
      if (!state.temporary) return state
      const check = checkCoordinates(action.to.latitude, action.to.longitude)
      if (!check.ok) return state
      // A pin moved by hand is no longer a GPS fix: drop the measured accuracy.
      return { ...state, temporary: { ...state.temporary, ...check.value, source: 'MAP', accuracy: null, savedLocationId: null } }
    }
    case 'confirm':
      if (!state.temporary || !canConfirm(state.temporary)) return state
      return { temporary: null, confirmed: { ...state.temporary, address: state.temporary.address.trim() } }
    case 'discard':
      return { ...state, temporary: null }
    case 'updateConfirmed':
      if (!state.confirmed) return state
      return { ...state, confirmed: { ...state.confirmed, ...action.patch } }
    case 'clear':
      return initialPickerState
  }
}

export function canConfirm(point: DeliveryPoint, bounds?: Bounds | null) {
  return (
    checkCoordinates(point.latitude, point.longitude).ok &&
    point.address.trim().length >= 3 &&
    point.address.trim().length <= 300 &&
    isWithinBounds(point, bounds)
  )
}

/** The payload create_order expects for the confirmed destination. */
export function toOrderDelivery(point: DeliveryPoint) {
  return {
    confirmed: true as const,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy,
    source: point.source,
    address: point.address.trim(),
    landmark: point.landmark.trim() || null,
    area: point.area,
    instructions: point.instructions.trim() || null,
    saved_location_id: point.savedLocationId,
  }
}

export function blankPoint(position: LatLng, source: LocationSource, extra: Partial<DeliveryPoint> = {}): DeliveryPoint {
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: null,
    source,
    address: '',
    area: null,
    landmark: '',
    instructions: '',
    savedLocationId: null,
    ...extra,
  }
}
