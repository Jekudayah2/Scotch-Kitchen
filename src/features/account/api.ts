import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-provider'
import { fetchMyOrders, orderKeys } from '@/features/orders/api'
import { LIVE_REFETCH_MS, useRealtimeInvalidation } from '@/hooks/use-realtime'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types/domain'

export interface AccountSummary {
  active_orders: number
  completed_orders: number
  saved_locations: number
}

export const accountKeys = {
  summary: (userId: string | null) => ['account', 'summary', userId] as const,
  notifications: (userId: string | null) => ['account', 'notifications', userId] as const,
}

function useUserId() {
  const { user, status } = useAuth()
  return status === 'signed_in' ? (user?.id ?? null) : null
}

/** Counts computed by the database for the signed-in customer only. */
export function useAccountSummary() {
  const userId = useUserId()
  return useQuery({
    queryKey: accountKeys.summary(userId),
    enabled: userId !== null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('account_summary')
      if (error) throw error
      return data as unknown as AccountSummary
    },
  })
}

/** The customer's orders (RLS limits rows to their own), kept fresh while any is in progress. */
export function useMyOrders(limit = 50) {
  const userId = useUserId()
  useRealtimeInvalidation({
    channel: `my-orders:${userId ?? 'anon'}`,
    table: 'orders',
    filter: userId ? `customer_id=eq.${userId}` : undefined,
    invalidate: [orderKeys.mine(userId), accountKeys.summary(userId)],
    enabled: userId !== null,
  })
  return useQuery({
    queryKey: [...orderKeys.mine(userId), limit],
    enabled: userId !== null,
    queryFn: () => fetchMyOrders(userId as string, { limit }),
    refetchInterval: (query) =>
      query.state.data?.some((o) => o.order_status !== 'DELIVERED' && o.order_status !== 'CANCELLED' && !o.archived_at) ? LIVE_REFETCH_MS : false,
  })
}

export function useNotifications() {
  const userId = useUserId()
  useRealtimeInvalidation({
    channel: `notifications:${userId ?? 'anon'}`,
    table: 'notifications',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    invalidate: [accountKeys.notifications(userId)],
    enabled: userId !== null,
  })
  return useQuery({
    queryKey: accountKeys.notifications(userId),
    enabled: userId !== null,
    refetchInterval: LIVE_REFETCH_MS * 2,
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return data as Notification[]
    },
  })
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) throw error
}
