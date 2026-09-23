import type { Database, Enums, Tables } from './database'

export type AppRole = Enums<'app_role'>
export type OrderStatus = Enums<'order_status'>
export type PaymentStatus = Enums<'payment_status'>
export type PaymentAttemptStatus = Enums<'payment_attempt_status'>
export type RiderAvailability = Enums<'rider_availability'>

export type Profile = Tables<'profiles'>
export type Brand = Tables<'brands'>
export type Product = Tables<'products'>
export type ProductVariant = Tables<'product_variants'>
export type ProductImage = Tables<'product_images'>
export type ProductIngredient = Tables<'product_ingredients'>
export type StoreSettings = Tables<'store_settings'>
export type SavedLocation = Tables<'saved_locations'>
export type Order = Tables<'orders'>
export type OrderItem = Tables<'order_items'>
export type OrderEvent = Tables<'order_status_history'>
export type Payment = Tables<'payments'>
export type Notification = Tables<'notifications'>
export type DeliveryFeeChange = Tables<'delivery_fee_changes'>
export type RiderProfile = Tables<'rider_profiles'>

export type AdminOrderRow = Database['public']['Views']['admin_order_list']['Row']
export type AdminCustomerRow = Database['public']['Views']['admin_customer_list']['Row']
export type AdminRiderRow = Database['public']['Views']['admin_rider_list']['Row']
export type AdminPaymentRow = Database['public']['Views']['admin_payment_list']['Row']
export type AdminAuditRow = Database['public']['Views']['admin_audit_log']['Row']

/** The payload create_order returns (jsonb). */
export interface CreatedOrder {
  order_id: string
  order_reference: string
  subtotal_pesewas: number
  delivery_fee_pesewas: number
  delivery_fee_status: 'SET' | 'QUOTE_PENDING'
  total_pesewas: number
  replayed: boolean
}
