import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import type { Database } from '@/types/database'

declare global {
  // Set only by the development UI-preview harness (src/dev/qa). Never in production builds.
  var __SK_DEV_FETCH__: typeof fetch | undefined
}

const devFetch = import.meta.env.DEV ? globalThis.__SK_DEV_FETCH__ : undefined

/**
 * The browser client uses the public anon/publishable key only. Row Level
 * Security in Postgres is what actually protects data; the client is untrusted.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabaseUrl ?? 'http://supabase-not-configured.invalid',
  env.supabaseKey ?? 'supabase-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'sk-auth',
    },
    global: devFetch ? { fetch: devFetch } : undefined,
    realtime: { params: { eventsPerSecond: 5 } },
  },
)

export type Supabase = typeof supabase
