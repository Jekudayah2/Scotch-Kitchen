import { supabase } from '@/lib/supabase'
import type { CreatedOrder, Order, OrderEvent, OrderItem, Payment } from '@/types/domain'

export type OrderWithItems = Order & { order_items: OrderItem[] }
export type OrderDetail = OrderWithItems & { order_status_history: OrderEvent[] }

export const orderKeys = {
  all: ['orders'] as const,
  mine: (userId: string | null) => ['orders', 'mine', userId] as const,
  detail: (reference: string) => ['orders', 'detail', reference] as const,
  payments: (orderId: string) => ['orders', 'payments', orderId] as const,
}

export interface CreateOrderInput {
  items: Array<{ variant_id: string; quantity: number }>
  contact: { name: string; phone: string }
  delivery: Record<string, unknown>
  idempotencyKey: string
}

/** Server-side order creation. The database prices every line itself. */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { data, error } = await supabase.rpc('create_order', {
    p_items: input.items,
    p_contact: input.contact,
    p_delivery: input.delivery as never,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
  return data as unknown as CreatedOrder
}

export async function fetchMyOrders(userId: string, options: { limit?: number } = {}) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50)
  if (error) throw error
  return (data ?? []) as unknown as OrderWithItems[]
}

export async function fetchOrderByReference(reference: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), order_status_history(*)')
    .eq('order_reference', reference.toUpperCase())
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const detail = data as unknown as OrderDetail
  detail.order_status_history = [...(detail.order_status_history ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  detail.order_items = [...(detail.order_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return detail
}

export async function fetchOrderPayments(orderId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, reference, status, amount_pesewas, currency, channel, paid_at, verified_at, created_at, failure_reason')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Pick<Payment, 'id' | 'reference' | 'status' | 'amount_pesewas' | 'currency' | 'channel' | 'paid_at' | 'verified_at' | 'created_at' | 'failure_reason'>[]
}

export async function cancelMyOrder(orderId: string, reason?: string) {
  const { data, error } = await supabase.rpc('customer_cancel_order', { p_order_id: orderId, p_reason: reason })
  if (error) throw error
  return data
}

export interface PublicTracking {
  order_reference: string
  order_status: Order['order_status']
  payment_status: Order['payment_status']
  item_count: number
  created_at: string
  paid_at: string | null
  preparing_at: string | null
  ready_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  items: Array<{ product_name: string; variant_name: string; quantity: number }>
  timeline: Array<{ event: string; to_status: Order['order_status'] | null; created_at: string }>
}

/** Reference + checkout phone lookup. Returns no address, coordinates or names. */
export async function trackOrderPublic(reference: string, phone: string) {
  const { data, error } = await supabase.rpc('track_order_public', { p_reference: reference, p_phone: phone })
  if (error) throw error
  return (data ?? null) as unknown as PublicTracking | null
}
