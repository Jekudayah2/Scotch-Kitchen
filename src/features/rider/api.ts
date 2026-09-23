import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-provider'
import { LIVE_REFETCH_MS, useRealtimeInvalidation } from '@/hooks/use-realtime'
import { supabase } from '@/lib/supabase'
import type { Order, OrderItem, OrderStatus, RiderAvailability, RiderProfile } from '@/types/domain'

/*
 * Rider data. RLS only returns orders assigned to the signed-in rider (and, for
 * 24 hours after delivery, their own completed drops); every action is a
 * SECURITY DEFINER function that re-checks the assignment.
 */

export type RiderDelivery = Order & { order_items: OrderItem[] }

export const riderKeys = {
  all: ['rider'] as const,
  summary: ['rider', 'summary'] as const,
  deliveries: ['rider', 'deliveries'] as const,
  delivery: (id: string) => ['rider', 'delivery', id] as const,
  history: (page: number) => ['rider', 'history', page] as const,
  profile: ['rider', 'profile'] as const,
}

export const ACTIVE_RIDER_STATUSES: OrderStatus[] = ['PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY']

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never)
  if (error) throw error
  return data as T
}

/** Live updates for everything assigned to this rider. */
export function useRiderLive() {
  const { user } = useAuth()
  useRealtimeInvalidation({
    channel: `rider:${user?.id ?? 'anon'}`,
    table: 'orders',
    filter: user ? `assigned_rider_id=eq.${user.id}` : undefined,
    invalidate: [riderKeys.all],
    enabled: Boolean(user),
  })
}

export interface RiderSummary {
  assigned: number
  ready_for_pickup: number
  out_for_delivery: number
  completed_today: number
}

export function useRiderSummary() {
  return useQuery({ queryKey: riderKeys.summary, queryFn: () => rpc<RiderSummary>('rider_summary'), refetchInterval: LIVE_REFETCH_MS })
}

export function useRiderDeliveries() {
  const { user } = useAuth()
  return useQuery({
    queryKey: riderKeys.deliveries,
    enabled: Boolean(user),
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('assigned_rider_id', user?.id as string)
        .in('order_status', ACTIVE_RIDER_STATUSES)
        .order('assigned_at', { ascending: true })
      if (error) throw error
      // On the road first, then ready to collect, then still in the kitchen.
      const rank: Record<string, number> = { OUT_FOR_DELIVERY: 0, ASSIGNED: 1, READY: 2, PREPARING: 3 }
      return (data as unknown as RiderDelivery[]).sort((a, b) => (rank[a.order_status] ?? 9) - (rank[b.order_status] ?? 9))
    },
  })
}

export function useRiderDelivery(id: string) {
  return useQuery({
    queryKey: riderKeys.delivery(id),
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle()
      if (error) throw error
      return data as unknown as RiderDelivery | null
    },
  })
}

export interface HistoryRow {
  order_id: string
  order_reference: string
  customer_first_name: string
  delivery_area: string | null
  delivery_fee_pesewas: number
  delivery_balance_pesewas: number
  order_status: OrderStatus
  assigned_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  total_count: number
}

export const HISTORY_PAGE = 20

export function useRiderHistory(page: number) {
  return useQuery({
    queryKey: riderKeys.history(page),
    queryFn: () => rpc<HistoryRow[]>('rider_delivery_history', { p_limit: HISTORY_PAGE, p_offset: page * HISTORY_PAGE }),
  })
}

export function useMyRiderProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: riderKeys.profile,
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('rider_profiles').select('*').eq('user_id', user?.id as string).maybeSingle()
      if (error) throw error
      return data as RiderProfile | null
    },
  })
}

export const riderActions = {
  setAvailability: (availability: RiderAvailability) => rpc('set_rider_availability', { p_availability: availability }),
  start: (orderId: string) => rpc('rider_start_delivery', { p_order_id: orderId }),
  delivered: (orderId: string) => rpc('rider_mark_delivered', { p_order_id: orderId }),
  collectBalance: (orderId: string) => rpc('mark_delivery_balance_collected', { p_order_id: orderId }),
  setCharge: (orderId: string, amountPesewas: number, note?: string) =>
    rpc<{ status: 'APPLIED' | 'PROPOSED'; kind: string }>('set_order_delivery_charge', {
      p_order_id: orderId,
      p_amount_pesewas: amountPesewas,
      p_note: note?.trim() || null,
    }),
}

/** Turn-by-turn in Google Maps (web or app). Coordinates go latitude,longitude. */
export function directionsUrl(order: Pick<Order, 'delivery_latitude' | 'delivery_longitude'>) {
  return `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_latitude},${order.delivery_longitude}&travelmode=driving`
}
