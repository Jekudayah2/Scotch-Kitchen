import { describe, expect, it } from 'vitest'
import { blankPoint, canConfirm, initialPickerState, locationReducer, toOrderDelivery, type LocationPickerState } from './location-state'

const A = blankPoint({ latitude: 6.6745, longitude: -1.5716 }, 'GPS', { accuracy: 12, address: 'Unity Hall, KNUST' })
const B = blankPoint({ latitude: 6.6801, longitude: -1.5602 }, 'MAP', { address: 'Ayeduase' })
const ghana = { minLatitude: 4.5, maxLatitude: 11.2, minLongitude: -3.3, maxLongitude: 1.3 }

describe('temporary vs confirmed location', () => {
  it('a map tap only proposes a temporary location', () => {
    const state = locationReducer(initialPickerState, { type: 'propose', point: B })
    expect(state.temporary).toMatchObject({ latitude: 6.6801, longitude: -1.5602 })
    expect(state.confirmed).toBeNull()
  })

  it('confirming commits the destination', () => {
    let state = locationReducer(initialPickerState, { type: 'propose', point: A })
    state = locationReducer(state, { type: 'confirm' })
    expect(state.confirmed).toMatchObject({ latitude: 6.6745, longitude: -1.5716, accuracy: 12, source: 'GPS' })
    expect(state.temporary).toBeNull()
  })

  it('a random tap never silently replaces a confirmed location', () => {
    let state: LocationPickerState = { temporary: null, confirmed: A }
    state = locationReducer(state, { type: 'propose', point: B })
    expect(state.confirmed).toEqual(A)
    expect(state.temporary?.latitude).toBe(6.6801)
    state = locationReducer(state, { type: 'discard' }) // "Choose another location"
    expect(state.confirmed).toEqual(A)
    expect(state.temporary).toBeNull()
  })

  it('replaces the confirmed location only after an explicit confirm', () => {
    let state: LocationPickerState = { temporary: null, confirmed: A }
    state = locationReducer(state, { type: 'propose', point: B })
    state = locationReducer(state, { type: 'confirm' })
    expect(state.confirmed?.latitude).toBe(6.6801)
  })

  it('cannot confirm without an address', () => {
    const noAddress = blankPoint({ latitude: 6.67, longitude: -1.57 }, 'MAP')
    let state = locationReducer(initialPickerState, { type: 'propose', point: noAddress })
    state = locationReducer(state, { type: 'confirm' })
    expect(state.confirmed).toBeNull()
    expect(state.temporary).not.toBeNull()
  })

  it('ignores invalid coordinates instead of swapping them', () => {
    const bad = blankPoint({ latitude: 120, longitude: 6.6 }, 'SEARCH', { address: 'x' })
    const state = locationReducer(initialPickerState, { type: 'propose', point: bad })
    expect(state).toEqual(initialPickerState)
  })

  it('drops GPS accuracy when a pin is dragged by hand', () => {
    let state = locationReducer(initialPickerState, { type: 'propose', point: A })
    state = locationReducer(state, { type: 'moveTemporary', to: { latitude: 6.675, longitude: -1.5711 } })
    expect(state.temporary).toMatchObject({ latitude: 6.675, longitude: -1.5711, accuracy: null, source: 'MAP' })
  })

  it('respects the delivery service area', () => {
    expect(canConfirm(A, ghana)).toBe(true)
    // A lat/lng swap lands outside Ghana and cannot be confirmed.
    expect(canConfirm({ ...A, latitude: -1.5716, longitude: 6.6745 }, ghana)).toBe(false)
  })
})

describe('order payload', () => {
  it('sends the confirmed pin with its real accuracy', () => {
    expect(toOrderDelivery({ ...A, landmark: ' Blue gate ', instructions: '' })).toEqual({
      confirmed: true,
      latitude: 6.6745,
      longitude: -1.5716,
      accuracy: 12,
      source: 'GPS',
      address: 'Unity Hall, KNUST',
      landmark: 'Blue gate',
      area: null,
      instructions: null,
      saved_location_id: null,
    })
  })
})
