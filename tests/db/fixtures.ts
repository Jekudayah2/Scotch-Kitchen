import { randomUUID } from 'node:crypto'
import type { TestDb } from './harness.ts'

/** Seeded catalog identifiers (see 20260923001000_seed_catalog.sql). */
export const VARIANTS = {
  ZOBOPOP_330: 'd1000000-0000-4000-8000-000000000001',
  ZOBOPOP_500: 'd1000000-0000-4000-8000-000000000002',
  CREAMYPOP_VANILLA: 'd1000000-0000-4000-8000-000000000003',
  CREAMYPOP_STRAWBERRY: 'd1000000-0000-4000-8000-000000000004',
} as const

export const PRODUCTS = {
  ZOBOPOP: 'c1000000-0000-4000-8000-000000000001',
  CREAMYPOP: 'c1000000-0000-4000-8000-000000000002',
} as const

/** A plausible test pin on the KNUST campus. Test data only. */
export const TEST_PIN = { latitude: 6.6745, longitude: -1.5716 }

export function delivery(overrides: Record<string, unknown> = {}) {
  return {
    confirmed: true,
    latitude: TEST_PIN.latitude,
    longitude: TEST_PIN.longitude,
    accuracy: 14.5,
    source: 'GPS',
    address: 'Unity Hall, KNUST',
    landmark: 'Opposite the porters lodge',
    area: 'KNUST',
    instructions: 'Call when you reach the gate',
    ...overrides,
  }
}

export function contact(overrides: Record<string, unknown> = {}) {
  return { name: 'Ama Mensah', phone: '024 387 0366', ...overrides }
}

export interface CreatedOrder {
  order_id: string
  order_reference: string
  subtotal_pesewas: number
  delivery_fee_pesewas: number
  delivery_fee_status: string
  total_pesewas: number
  replayed: boolean
}

export async function createOrder(
  t: TestDb,
  customerId: string,
  items: unknown = [{ variant_id: VARIANTS.ZOBOPOP_500, quantity: 2 }],
  options: { delivery?: unknown; contact?: unknown; key?: string } = {},
): Promise<CreatedOrder> {
  const row = await t.as('authenticated', customerId, () =>
    t.one<{ r: CreatedOrder }>('select public.create_order($1::jsonb, $2::jsonb, $3::jsonb, $4::uuid) as r', [
      JSON.stringify(items),
      JSON.stringify(options.contact ?? contact()),
      JSON.stringify(options.delivery ?? delivery()),
      options.key ?? randomUUID(),
    ]),
  )
  return row.r
}

export async function beginPayment(t: TestDb, orderId: string, customerId: string) {
  const row = await t.as('service_role', null, () =>
    t.one<{ r: Record<string, unknown> }>('select public.begin_payment_attempt($1, $2) as r', [orderId, customerId]),
  )
  return row.r as {
    ok: boolean
    error?: string
    reference: string
    amount_pesewas: number
    reused: boolean
    payment_id: string
  }
}

export async function confirmPayment(t: TestDb, reference: string, amount: number, currency = 'GHS') {
  const row = await t.as('service_role', null, () =>
    t.one<{ r: Record<string, unknown> }>(
      `select public.confirm_paystack_payment($1, $2, $3, now(), 'mobile_money', 'Approved', '123456', 'TEST') as r`,
      [reference, amount, currency],
    ),
  )
  return row.r as { ok: boolean; error?: string; already_processed?: boolean; order_status?: string; payment_status?: string }
}

/** Creates an order and takes it through verified payment. */
export async function createPaidOrder(t: TestDb, customerId: string, items?: unknown) {
  const order = await createOrder(t, customerId, items)
  const attempt = await beginPayment(t, order.order_id, customerId)
  await t.as('service_role', null, () =>
    t.query(`select public.attach_payment_authorization($1, 'ACCESS_x', 'https://checkout.paystack.com/abc')`, [
      attempt.payment_id,
    ]),
  )
  const confirmed = await confirmPayment(t, attempt.reference, attempt.amount_pesewas)
  if (!confirmed.ok) throw new Error(`payment failed: ${confirmed.error}`)
  return { ...order, reference: attempt.reference }
}

export async function rpcAs<T = unknown>(
  t: TestDb,
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const row = await t.as('authenticated', userId, () => t.one<{ r: T }>(sql, params))
  return row.r
}

export async function orderRow(t: TestDb, orderId: string) {
  return t.one<Record<string, unknown>>('select * from public.orders where id = $1', [orderId])
}

/** Staff set-up used by several suites. */
export async function createStaff(t: TestDb) {
  const admin = await t.createUser(`admin-${randomUUID()}@example.com`, { full_name: 'Kitchen Admin' })
  await t.grantRole(admin, 'ADMIN')
  const rider = await t.createUser(`rider-${randomUUID()}@example.com`, { full_name: 'Kofi Rider', phone: '0201112222' })
  await t.grantRole(rider, 'RIDER')
  const otherRider = await t.createUser(`rider2-${randomUUID()}@example.com`, { full_name: 'Yaw Rider' })
  await t.grantRole(otherRider, 'RIDER')
  return { admin, rider, otherRider }
}
