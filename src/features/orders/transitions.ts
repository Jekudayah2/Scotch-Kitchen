import type { Database } from '../../types/database'

type OrderStatus = Database['public']['Enums']['order_status']

/**
 * Mirror of private.is_valid_transition() in the database. The database is the
 * authority; this copy only decides which buttons to show, and a database test
 * (tests/db/workflow.test.ts) asserts the two are identical.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'ASSIGNED', 'CANCELLED'],
  READY: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['READY', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}
