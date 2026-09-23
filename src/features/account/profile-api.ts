import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/domain'

/** Only these columns are writable by the owner (column-level grant + RLS). */
export async function updateMyProfile(userId: string, patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single()
  if (error) throw error
  return data as Profile
}
