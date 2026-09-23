import { z } from 'zod'
import { checkCoordinates, type LatLng } from '@/utils/geo'

/**
 * Browser-safe configuration only. Everything here ships to the client, so it
 * must never contain secrets. Paystack's secret key, the Supabase service-role
 * key and the webhook secret live in Supabase Edge Function secrets instead.
 */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))

const schema = z.object({
  VITE_SUPABASE_URL: optionalString,
  VITE_SUPABASE_ANON_KEY: optionalString,
  VITE_SUPABASE_PUBLISHABLE_KEY: optionalString,
  VITE_SITE_URL: optionalString,
  VITE_STORE_LATITUDE: optionalString,
  VITE_STORE_LONGITUDE: optionalString,
  VITE_STORE_AREA_LABEL: optionalString,
  VITE_MAP_STYLE_URL: optionalString,
  VITE_MAP_STYLE_URL_DARK: optionalString,
  VITE_MAP_DEFAULT_CENTER: optionalString,
  VITE_GEOCODER_URL: optionalString,
  VITE_CONTACT_PHONE: optionalString,
  VITE_CONTACT_EMAIL: optionalString,
  VITE_CONTACT_WHATSAPP: optionalString,
  VITE_INSTAGRAM_URL: optionalString,
})

const raw = schema.parse(import.meta.env)

function parseLatLng(latitude?: string, longitude?: string): LatLng | null {
  if (!latitude || !longitude) return null
  const result = checkCoordinates(Number(latitude), Number(longitude))
  if (!result.ok) {
    console.warn(`Ignoring invalid store coordinates (${result.issues.join(', ')}).`)
    return null
  }
  return result.value
}

function parseCenter(value?: string): LatLng | null {
  if (!value) return null
  const [lat, lng] = value.split(',').map((s) => s.trim())
  return parseLatLng(lat, lng)
}

function httpsUrl(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1' ? value : undefined
  } catch {
    return undefined
  }
}

const isQaMode = import.meta.env.DEV && import.meta.env.MODE === 'qa'

export const env = {
  isQaMode,
  supabaseUrl: isQaMode ? 'http://qa.supabase.local' : httpsUrl(raw.VITE_SUPABASE_URL),
  supabaseKey: isQaMode ? 'qa-anon-key' : (raw.VITE_SUPABASE_PUBLISHABLE_KEY ?? raw.VITE_SUPABASE_ANON_KEY),
  siteUrl: (httpsUrl(raw.VITE_SITE_URL) ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, ''),
  /** Verified store pin. Null until both values are set; never guessed. */
  storeLocation: parseLatLng(raw.VITE_STORE_LATITUDE, raw.VITE_STORE_LONGITUDE),
  storeAreaLabel: raw.VITE_STORE_AREA_LABEL ?? 'KNUST & Kumasi',
  mapStyleUrl: httpsUrl(raw.VITE_MAP_STYLE_URL) ?? 'https://tiles.openfreemap.org/styles/positron',
  mapStyleUrlDark: httpsUrl(raw.VITE_MAP_STYLE_URL_DARK) ?? 'https://tiles.openfreemap.org/styles/dark',
  mapDefaultCenter: parseCenter(raw.VITE_MAP_DEFAULT_CENTER),
  geocoderUrl: (httpsUrl(raw.VITE_GEOCODER_URL) ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, ''),
  contact: {
    phone: raw.VITE_CONTACT_PHONE,
    email: raw.VITE_CONTACT_EMAIL,
    whatsapp: raw.VITE_CONTACT_WHATSAPP,
    instagram: httpsUrl(raw.VITE_INSTAGRAM_URL),
  },
} as const

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey)

export const missingEnv = [
  !env.supabaseUrl && 'VITE_SUPABASE_URL',
  !env.supabaseKey && 'VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)',
].filter(Boolean) as string[]
