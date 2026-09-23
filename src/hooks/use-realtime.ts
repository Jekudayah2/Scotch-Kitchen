import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { env } from '@/config/env'
import { supabase } from '@/lib/supabase'

type Row = Record<string, unknown>

interface Options {
  /** Unique, stable channel name (scope it: e.g. `order:${id}`). */
  channel: string
  table: 'orders' | 'notifications' | 'order_status_history'
  /** PostgREST-style filter, e.g. `customer_id=eq.<uuid>`. */
  filter?: string
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  /** Query keys to invalidate when a change arrives. */
  invalidate: QueryKey[]
  enabled?: boolean
  onChange?: (payload: RealtimePostgresChangesPayload<Row>) => void
}

/**
 * Scoped Supabase Realtime subscription that simply invalidates the affected
 * queries. Realtime honours RLS, so subscribers only receive rows they may read.
 * Not available in the local QA preview, where pages fall back to polling.
 */
export function useRealtimeInvalidation({ channel, table, filter, event = '*', invalidate, enabled = true, onChange }: Options) {
  const queryClient = useQueryClient()
  const keysRef = useRef(invalidate)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    keysRef.current = invalidate
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!enabled || env.isQaMode) return
    const subscription = supabase
      .channel(channel)
      .on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, (payload: RealtimePostgresChangesPayload<Row>) => {
        for (const key of keysRef.current) void queryClient.invalidateQueries({ queryKey: key })
        onChangeRef.current?.(payload)
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(subscription)
    }
  }, [channel, table, filter, event, enabled, queryClient])
}

/** Polling fallback when realtime is unavailable (QA preview) or as a safety net. */
export const LIVE_REFETCH_MS = env.isQaMode ? 4000 : 30_000
