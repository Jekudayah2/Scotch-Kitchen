import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import type { SavedLocation } from '@/types/domain'
import type { DeliveryPoint } from './location-state'

export const savedLocationsKey = (userId: string | null) => ['saved-locations', userId] as const

export function useSavedLocations() {
  const { user, status } = useAuth()
  const userId = status === 'signed_in' ? (user?.id ?? null) : null
  return useQuery({
    queryKey: savedLocationsKey(userId),
    enabled: userId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as SavedLocation[]
    },
  })
}

export interface SavedLocationInput {
  label: string
  address: string
  landmark: string | null
  latitude: number
  longitude: number
  accuracy_m: number | null
  delivery_instructions: string | null
  is_default?: boolean
}

export function pointToSavedInput(point: DeliveryPoint, label: string, isDefault = false): SavedLocationInput {
  return {
    label: label.trim(),
    address: point.address.trim(),
    landmark: point.landmark.trim() || null,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy_m: point.accuracy,
    delivery_instructions: point.instructions.trim() || null,
    is_default: isDefault,
  }
}

export async function createSavedLocation(userId: string, input: SavedLocationInput) {
  const { data, error } = await supabase
    .from('saved_locations')
    .insert({ ...input, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as SavedLocation
}

export async function updateSavedLocation(id: string, patch: Partial<SavedLocationInput>) {
  const { data, error } = await supabase.from('saved_locations').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as SavedLocation
}

export async function deleteSavedLocation(id: string) {
  const { error } = await supabase.from('saved_locations').delete().eq('id', id)
  if (error) throw error
}

export function savedToPoint(location: SavedLocation): DeliveryPoint {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy_m,
    source: 'SAVED',
    address: location.address,
    area: null,
    landmark: location.landmark ?? '',
    instructions: location.delivery_instructions ?? '',
    savedLocationId: location.id,
  }
}
