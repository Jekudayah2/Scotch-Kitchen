import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { buildCatalog, type RawCatalogBrand } from './catalog'

export const catalogQueryKey = ['catalog'] as const
export const storeSettingsQueryKey = ['store-settings'] as const

const CATALOG_SELECT = `
  *,
  products (
    *,
    product_variants ( * ),
    product_images ( * ),
    product_ingredients ( * )
  )
`

export async function fetchCatalog() {
  const { data, error } = await supabase
    .from('brands')
    .select(CATALOG_SELECT)
    .eq('is_active', true)
    .eq('is_visible', true)
    .order('sort_order')
  if (error) throw error
  return buildCatalog((data ?? []) as unknown as RawCatalogBrand[])
}

export function useCatalog() {
  return useQuery({
    queryKey: catalogQueryKey,
    queryFn: fetchCatalog,
    staleTime: 60_000,
    // The catalog contains Maps; skip structural sharing and replace it wholesale.
    structuralSharing: false,
  })
}

export async function fetchStoreSettings() {
  const { data, error } = await supabase.from('store_settings').select('*').maybeSingle()
  if (error) throw error
  return data
}

export function useStoreSettings() {
  return useQuery({ queryKey: storeSettingsQueryKey, queryFn: fetchStoreSettings, staleTime: 60_000 })
}
