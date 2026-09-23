import {
  Ban,
  Bike,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react'
import type { BadgeTone } from '@/components/ui/badge'
import type { Order, OrderEvent, OrderStatus, PaymentStatus } from '@/types/domain'
import { ORDER_TRANSITIONS } from './transitions'

export const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']

export const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY']

export { ORDER_TRANSITIONS }

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to)
}

interface StatusMeta {
  label: string
  /** Customer-facing wording. */
  customerLabel: string
  tone: BadgeTone
  icon: LucideIcon
  description: string
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: {
    label: 'Pending',
    customerLabel: 'Awaiting payment',
    tone: 'warning',
    icon: Clock3,
    description: 'Order placed. Waiting for payment to be confirmed.',
  },
  PAID: {
    label: 'Paid',
    customerLabel: 'Payment confirmed',
    tone: 'info',
    icon: CircleDollarSign,
    description: 'Payment verified with Paystack. The kitchen will start soon.',
  },
  PREPARING: { label: 'Preparing', customerLabel: 'Preparing', tone: 'accent', icon: ChefHat, description: 'The kitchen is preparing your order.' },
  READY: { label: 'Ready', customerLabel: 'Ready', tone: 'info', icon: PackageCheck, description: 'Packed and waiting for a rider.' },
  ASSIGNED: {
    label: 'Assigned',
    customerLabel: 'Rider assigned',
    tone: 'brand',
    icon: UserRoundCheck,
    description: 'A rider has your order and will set off shortly.',
  },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', customerLabel: 'On the way', tone: 'primary', icon: Bike, description: 'Your rider is on the way to your pin.' },
  DELIVERED: { label: 'Delivered', customerLabel: 'Delivered', tone: 'success', icon: CheckCircle2, description: 'Delivered. Enjoy!' },
  CANCELLED: { label: 'Cancelled', customerLabel: 'Cancelled', tone: 'neutral', icon: Ban, description: 'This order was cancelled.' },
}

export const PAYMENT_META: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Payment pending', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Payment failed', tone: 'danger' },
}

export function isActiveOrder(order: Pick<Order, 'order_status' | 'archived_at'>) {
  return !order.archived_at && ACTIVE_STATUSES.includes(order.order_status)
}

export interface TimelineStep {
  key: string
  label: string
  at: string | null
  state: 'done' | 'current' | 'upcoming' | 'cancelled'
  note?: string | null
}

/** Customer-facing progress. Built only from stored timestamps and events. */
export function buildTimeline(order: Order, events: Pick<OrderEvent, 'event' | 'to_status' | 'created_at' | 'note'>[] = []): TimelineStep[] {
  const statusAt = (status: OrderStatus) => events.find((e) => e.to_status === status)?.created_at ?? null
  const steps: Array<{ key: string; label: string; at: string | null }> = [
    { key: 'placed', label: 'Order received', at: order.created_at },
    { key: 'paid', label: 'Payment confirmed', at: order.paid_at },
    { key: 'preparing', label: 'Preparing', at: order.preparing_at },
    { key: 'ready', label: 'Ready', at: order.ready_at },
    { key: 'assigned', label: 'Rider assigned', at: statusAt('ASSIGNED') },
    { key: 'out', label: 'Out for delivery', at: order.out_for_delivery_at },
    { key: 'delivered', label: 'Delivered', at: order.delivered_at },
  ]
  const reachedIndex: Record<OrderStatus, number> = {
    PENDING: 0,
    PAID: 1,
    PREPARING: 2,
    READY: 3,
    ASSIGNED: 4,
    OUT_FOR_DELIVERY: 5,
    DELIVERED: 6,
    CANCELLED: -1,
  }
  if (order.order_status === 'CANCELLED') {
    const done = steps.filter((s) => s.at).map<TimelineStep>((s) => ({ ...s, state: 'done' }))
    return [...done, { key: 'cancelled', label: 'Cancelled', at: order.cancelled_at, state: 'cancelled', note: order.cancellation_reason }]
  }
  const current = reachedIndex[order.order_status]
  return steps.map((s, i) => ({
    ...s,
    state: i < current ? 'done' : i === current ? (order.order_status === 'DELIVERED' ? 'done' : 'current') : 'upcoming',
  }))
}

/** The customer's money picture. Never rewrites the paid amount. */
export function paymentSummary(order: Pick<Order, 'total_pesewas' | 'amount_paid_pesewas' | 'delivery_balance_pesewas' | 'delivery_balance_collected_at' | 'payment_status'>) {
  const originalCharge = order.total_pesewas
  const paid = order.amount_paid_pesewas
  const balance = order.delivery_balance_pesewas
  const balanceOutstanding = balance > 0 && !order.delivery_balance_collected_at ? balance : 0
  const chargeOutstanding = Math.max(originalCharge - paid, 0)
  return {
    originalCharge,
    paid,
    balance,
    balanceCollected: balance > 0 && !!order.delivery_balance_collected_at,
    outstanding: chargeOutstanding + balanceOutstanding,
    grandTotal: originalCharge + balance,
  }
}
