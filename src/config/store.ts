import type { LatLng } from '@/utils/geo'
import { env } from './env'

/**
 * Centralised store configuration.
 *
 * The store's coordinates come ONLY from VITE_STORE_LATITUDE /
 * VITE_STORE_LONGITUDE and must be verified on site before launch. Until they
 * are set, maps show no store pin and say so, rather than guessing.
 */
export const store = {
  name: 'SCOTCH’s Kitchen',
  shortName: 'SCOTCH’s',
  areaLabel: env.storeAreaLabel,
  location: env.storeLocation,
  contact: env.contact,
}

export const isStoreLocationConfigured = store.location !== null

/**
 * Camera-only default: Kumasi city centre. Used purely to position a map before
 * the customer picks a point. It is never stored, and never used as a store or
 * delivery location. Override with VITE_MAP_DEFAULT_CENTER="lat,lng".
 */
const KUMASI_CAMERA_DEFAULT: LatLng = { latitude: 6.6885, longitude: -1.6244 }

export const mapDefaults = {
  center: store.location ?? env.mapDefaultCenter ?? KUMASI_CAMERA_DEFAULT,
  zoom: store.location ? 14 : 12.5,
}
