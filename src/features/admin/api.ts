import { useQuery } from '@tanstack/react-query'
import { LIVE_REFETCH_MS, useRealtimeInvalidation } from '@/hooks/use-realtime'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type {
  AdminAuditRow,
  AdminCustomerRow,
  AdminOrderRow,
  AdminPaymentRow,
  AdminRiderRow,
  AppRole,
  DeliveryFeeChange,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Payment,
  RiderAvailability,
  StoreSettings,
} from '@/types/domain'

/*
 * Admin data access. Every read goes through RLS (admins may read everything)
 * and every change goes through a SECURITY DEFINER function that re-checks the
 * ADMIN role, validates the change and writes the audit log. The UI hides what
 * an admin can't do; the database is what actually prevents it.
 */

export const adminKeys = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  orders: (filters: object) => ['admin', 'orders', filters] as const,
  order: (id: string) => ['admin', 'order', id] as const,
  riders: ['admin', 'riders'] as const,
  customers: (search: string) => ['admin', 'customers', search] as const,
  customerOrders: (id: string) => ['admin', 'customer-orders', id] as const,
  payments: (filters: object) => ['admin', 'payments', filters] as const,
  audit: (filters: object) => ['admin', 'audit', filters] as const,
  analytics: (from: string, to: string) => ['admin', 'analytics', from, to] as const,
  archive: ['admin', 'archive-preview'] as const,
  archived: ['admin', 'archived-orders'] as const,
  team: ['admin', 'team'] as const,
  catalog: ['admin', 'catalog'] as const,
  settings: ['store-settings'] as const,
}

/** Keeps admin screens live: realtime where available, polling as a safety net. */
export function useAdminLiveOrders(channel: string) {
  useRealtimeInvalidation({ channel: `admin:${channel}`, table: 'orders', invalidate: [adminKeys.all] })
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never)
  if (error) throw error
  return data as T
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export interface AdminOverview {
  orders_today: number
  revenue_today_pesewas: number
  pending: number
  paid: number
  preparing: number
  ready: number
  assigned: number
  out_for_delivery: number
  delivered_today: number
  pending_fee_proposals: number
  generated_at: string
}

export function useAdminOverview() {
  return useQuery({ queryKey: adminKeys.overview, queryFn: () => rpc<AdminOverview>('admin_overview'), refetchInterval: LIVE_REFETCH_MS })
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export type OrderFilter = 'active' | 'new' | 'preparing' | 'ready' | 'assigned' | 'out' | 'delivered' | 'cancelled' | 'unpaid' | 'all'

export const ORDER_FILTERS: Array<{ id: OrderFilter; label: string; statuses: OrderStatus[] | null }> = [
  { id: 'active', label: 'In progress', statuses: ['PAID', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'] },
  { id: 'new', label: 'New', statuses: ['PAID'] },
  { id: 'preparing', label: 'Preparing', statuses: ['PREPARING'] },
  { id: 'ready', label: 'Ready', statuses: ['READY'] },
  { id: 'assigned', label: 'Assigned', statuses: ['ASSIGNED'] },
  { id: 'out', label: 'Out for delivery', statuses: ['OUT_FOR_DELIVERY'] },
  { id: 'delivered', label: 'Delivered', statuses: ['DELIVERED'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
  { id: 'unpaid', label: 'Awaiting payment', statuses: ['PENDING'] },
  { id: 'all', label: 'All', statuses: null },
]

export function useAdminOrders({
  filter,
  search,
  customerId,
  limit = 100,
  enabled = true,
}: {
  filter: OrderFilter
  search?: string
  customerId?: string
  limit?: number
  enabled?: boolean
}) {
  const statuses = ORDER_FILTERS.find((f) => f.id === filter)?.statuses ?? null
  const term = search?.trim().toLowerCase() ?? ''
  return useQuery({
    queryKey: adminKeys.orders({ filter, term, customerId, limit }),
    enabled,
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () => {
      let query = supabase.from('admin_order_list').select('*').is('archived_at', null).order('created_at', { ascending: false }).limit(limit)
      if (statuses) query = query.in('order_status', statuses)
      if (customerId) query = query.eq('customer_id', customerId)
      if (term) query = query.ilike('search_text', `%${term.replace(/[%_]/g, '')}%`)
      const { data, error } = await query
      if (error) throw error
      return data as AdminOrderRow[]
    },
  })
}

export type AdminOrderDetail = Order & {
  order_items: OrderItem[]
  order_status_history: OrderEvent[]
  delivery_fee_changes: DeliveryFeeChange[]
  payments: Payment[]
  notes: string
  customer: { full_name: string | null; email: string | null; phone: string | null } | null
  rider: { full_name: string | null; phone: string | null } | null
}

export function useAdminOrder(orderId: string | null) {
  return useQuery({
    queryKey: adminKeys.order(orderId ?? 'none'),
    enabled: orderId !== null,
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async (): Promise<AdminOrderDetail> => {
      const [order, notes, profiles] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(*), order_status_history(*), delivery_fee_changes(*), payments(*)')
          .eq('id', orderId as string)
          .single(),
        supabase.from('order_admin_notes').select('notes').eq('order_id', orderId as string).maybeSingle(),
        supabase.from('admin_order_list').select('customer_email, customer_account_name, rider_name, rider_phone').eq('id', orderId as string).maybeSingle(),
      ])
      if (order.error) throw order.error
      if (notes.error) throw notes.error
      if (profiles.error) throw profiles.error
      const row = order.data as unknown as AdminOrderDetail
      const byTime = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at)
      return {
        ...row,
        order_items: [...row.order_items].sort(byTime),
        order_status_history: [...row.order_status_history].sort(byTime),
        delivery_fee_changes: [...row.delivery_fee_changes].sort(byTime).reverse(),
        payments: [...row.payments].sort(byTime).reverse(),
        notes: notes.data?.notes ?? '',
        customer: profiles.data ? { full_name: profiles.data.customer_account_name, email: profiles.data.customer_email, phone: null } : null,
        rider: profiles.data?.rider_name ? { full_name: profiles.data.rider_name, phone: profiles.data.rider_phone } : null,
      }
    },
  })
}

export const adminOrderActions = {
  setStatus: (orderId: string, status: OrderStatus, note?: string) =>
    rpc('admin_update_order_status', { p_order_id: orderId, p_status: status, p_note: note?.trim() || null }),
  assignRider: (orderId: string, riderId: string) => rpc('admin_assign_rider', { p_order_id: orderId, p_rider_id: riderId }),
  unassignRider: (orderId: string) => rpc('admin_unassign_rider', { p_order_id: orderId }),
  setDeliveryCharge: (orderId: string, amountPesewas: number, note?: string) =>
    rpc('set_order_delivery_charge', { p_order_id: orderId, p_amount_pesewas: amountPesewas, p_note: note?.trim() || null }),
  reviewProposal: (changeId: string, approve: boolean) => rpc('admin_review_fee_proposal', { p_change_id: changeId, p_approve: approve }),
  markBalanceCollected: (orderId: string) => rpc('mark_delivery_balance_collected', { p_order_id: orderId }),
  setNotes: (orderId: string, notes: string) => rpc('admin_set_order_notes', { p_order_id: orderId, p_notes: notes }),
}

// ---------------------------------------------------------------------------
// Riders, customers, payments, audit
// ---------------------------------------------------------------------------
export function useAdminRiders() {
  return useQuery({
    queryKey: adminKeys.riders,
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_rider_list').select('*').order('full_name')
      if (error) throw error
      return data as AdminRiderRow[]
    },
  })
}

export const setRiderAvailability = (riderId: string, availability: RiderAvailability) =>
  rpc('set_rider_availability', { p_availability: availability, p_rider_id: riderId })

export function useAdminCustomers(search: string) {
  const term = search.trim().toLowerCase()
  return useQuery({
    queryKey: adminKeys.customers(term),
    queryFn: async () => {
      let query = supabase.from('admin_customer_list').select('*').order('last_order_at', { ascending: false, nullsFirst: false }).limit(200)
      if (term) query = query.ilike('search_text', `%${term.replace(/[%_]/g, '')}%`)
      const { data, error } = await query
      if (error) throw error
      return data as AdminCustomerRow[]
    },
  })
}

export function useAdminPayments({ status, search }: { status: string; search: string }) {
  const term = search.trim().toLowerCase()
  return useQuery({
    queryKey: adminKeys.payments({ status, term }),
    refetchInterval: LIVE_REFETCH_MS * 2,
    queryFn: async () => {
      let query = supabase.from('admin_payment_list').select('*').order('created_at', { ascending: false }).limit(200)
      if (status !== 'ALL') query = query.eq('status', status as Payment['status'])
      if (term) query = query.ilike('search_text', `%${term.replace(/[%_]/g, '')}%`)
      const { data, error } = await query
      if (error) throw error
      return data as AdminPaymentRow[]
    },
  })
}

export function useAdminAudit({ search, target }: { search: string; target: string }) {
  const term = search.trim()
  return useQuery({
    queryKey: adminKeys.audit({ term, target }),
    queryFn: async () => {
      let query = supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200)
      if (target !== 'ALL') query = query.eq('target_type', target)
      if (term) query = query.or(`summary.ilike.%${term.replace(/[%_,()]/g, '')}%,action.ilike.%${term.replace(/[%_,()]/g, '')}%`)
      const { data, error } = await query
      if (error) throw error
      return data as AdminAuditRow[]
    },
  })
}

// ---------------------------------------------------------------------------
// Analytics and data management
// ---------------------------------------------------------------------------
export interface AnalyticsResult {
  from: string
  to: string
  totals: {
    orders: number
    paid_orders: number
    revenue_pesewas: number
    average_order_value_pesewas: number | null
    delivery_fees_pesewas: number
    delivery_balances_pesewas: number
    completed_deliveries: number
    cancelled_orders: number
    units_sold: number
  }
  brands: Array<{ brand_id: string | null; brand_name: string; units: number; revenue_pesewas: number }>
  product_mix: Array<{ brand_name: string; product_name: string; variant_name: string; units: number; revenue_pesewas: number }>
  by_day: Array<{ day: string; orders: number; paid_orders: number; revenue_pesewas: number }>
}

export function useAdminAnalytics(range: { from: Date; to: Date } | null) {
  const from = range?.from.toISOString() ?? ''
  const to = range?.to.toISOString() ?? ''
  return useQuery({
    queryKey: adminKeys.analytics(from, to),
    enabled: range !== null,
    queryFn: () => rpc<AnalyticsResult>('admin_analytics', { p_from: from, p_to: to }),
  })
}

export interface ArchivePreview {
  total: number
  in_progress: number
  awaiting_payment: number
  delivered: number
  cancelled: number
  paid: number
}

export function useArchivePreview() {
  return useQuery({ queryKey: adminKeys.archive, queryFn: () => rpc<ArchivePreview>('admin_archive_preview') })
}

export const archiveOrders = (confirmation: string, reason: string) =>
  rpc<{ batch_id: string; order_count: number; created_at: string }>('admin_archive_orders', { p_confirmation: confirmation, p_reason: reason.trim() || null })

export function useArchivedOrders() {
  return useQuery({
    queryKey: adminKeys.archived,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_order_list')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as AdminOrderRow[]
    },
  })
}

/** Every non-archived order for export (paged so large histories still work). */
export async function fetchOrdersForExport(includeArchived: boolean) {
  const rows: AdminOrderRow[] = []
  for (let from = 0; ; from += 1000) {
    let query = supabase.from('admin_order_list').select('*').order('created_at', { ascending: false }).range(from, from + 999)
    if (!includeArchived) query = query.is('archived_at', null)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data as AdminOrderRow[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// Settings and team
// ---------------------------------------------------------------------------
export type StoreSettingsPatch = Partial<
  Pick<
    StoreSettings,
    'accepting_orders' | 'delivery_fee_mode' | 'flat_delivery_fee_pesewas' | 'rider_fee_permission' | 'max_quantity_per_item' | 'storefront_notice'
  >
>

export async function updateStoreSettings(patch: StoreSettingsPatch) {
  const { data, error } = await supabase.from('store_settings').update(patch).eq('id', true).select('*').single()
  if (error) throw error
  return data as StoreSettings
}

export type TeamMember = Database['public']['Views']['admin_team_list']['Row']

export function useTeam() {
  return useQuery({
    queryKey: adminKeys.team,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_team_list').select('*').order('created_at')
      if (error) throw error
      return data as TeamMember[]
    },
  })
}

export const grantRole = (email: string, role: AppRole) => rpc('admin_grant_role', { p_email: email.trim().toLowerCase(), p_role: role })
export const revokeRole = (userId: string, role: AppRole) => rpc('admin_revoke_role', { p_user_id: userId, p_role: role })
