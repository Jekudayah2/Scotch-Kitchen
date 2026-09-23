import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness.ts'
import { createOrder, createPaidOrder, createStaff, orderRow, rpcAs } from './fixtures.ts'

let t: TestDb
let admin: string
let rider: string
let customer: string

beforeAll(async () => {
  t = await createTestDb()
  ;({ admin, rider } = await createStaff(t))
  customer = await t.createUser('archive.customer@example.com', { full_name: 'Efua Ansah' })
})
afterAll(async () => {
  await t.close()
})

describe('admin metrics', () => {
  it('are admin-only and computed from real rows', async () => {
    expect(await errorOf(t.as('authenticated', customer, () => t.query('select public.admin_overview()')))).toBe('FORBIDDEN')
    expect(await errorOf(t.as('authenticated', rider, () => t.query('select public.admin_overview()')))).toBe('FORBIDDEN')

    const empty = await rpcAs<Record<string, number>>(t, admin, 'select public.admin_overview() as r')
    expect(empty).toMatchObject({ orders_today: 0, revenue_today_pesewas: 0, pending: 0, delivered_today: 0 })

    await createOrder(t, customer)
    await createPaidOrder(t, customer)
    const after = await rpcAs<Record<string, number>>(t, admin, 'select public.admin_overview() as r')
    expect(after).toMatchObject({ orders_today: 2, pending: 1, paid: 1, revenue_today_pesewas: 3000 })
  })

  it('produce zero-filled analytics without inventing data', async () => {
    const result = await rpcAs<{
      totals: Record<string, number | null>
      brands: Array<{ brand_name: string; units: number }>
      by_day: Array<{ day: string; orders: number }>
    }>(t, admin, `select public.admin_analytics(now() - interval '6 days', now() + interval '1 hour') as r`)
    expect(result.totals.paid_orders).toBe(1)
    expect(result.totals.revenue_pesewas).toBe(3000)
    expect(result.totals.average_order_value_pesewas).toBe(3000)
    expect(result.brands).toEqual([{ brand_id: 'b1000000-0000-4000-8000-000000000001', brand_name: 'ZOBOPOP', units: 2, revenue_pesewas: 3000 }])
    expect(result.by_day.length).toBeGreaterThanOrEqual(7)
    expect(result.by_day.filter((d) => d.orders > 0)).toHaveLength(1)
  })

  it('exposes admin views only to admins', async () => {
    const asCustomer = await t.as('authenticated', customer, () => t.query<{ id: string }>('select id from public.admin_order_list'))
    // Security-invoker view: a customer sees at most their own orders, never other people’s.
    const own = await t.query<{ id: string }>('select id from public.orders where customer_id = $1', [customer])
    expect(asCustomer.map((r) => r.id).sort()).toEqual(own.map((r) => r.id).sort())
    await expect(t.as('anon', null, () => t.query('select id from public.admin_order_list'))).rejects.toThrow(/permission denied/)
    const audit = await t.as('authenticated', customer, () => t.query('select id from public.admin_audit_log'))
    expect(audit).toEqual([])
  })
})

describe('safe order archival', () => {
  it('requires the exact confirmation phrase, server-side', async () => {
    for (const phrase of ['reset orders', 'RESET', 'RESET ORDERS ', '']) {
      expect(await errorOf(t.as('authenticated', admin, () => t.query('select public.admin_archive_orders($1)', [phrase])))).toBe(
        'CONFIRMATION_MISMATCH',
      )
    }
    expect(
      await errorOf(t.as('authenticated', customer, () => t.query(`select public.admin_archive_orders('RESET ORDERS')`))),
    ).toBe('FORBIDDEN')
  })

  it('archives without deleting, removes orders from operations, and keeps payment references', async () => {
    const paid = await createPaidOrder(t, customer)
    await t.as('authenticated', admin, () => t.query(`select public.admin_update_order_status($1, 'PREPARING')`, [paid.order_id]))
    await t.as('authenticated', admin, () => t.query(`select public.admin_assign_rider($1, $2)`, [paid.order_id, rider]))

    const preview = await rpcAs<Record<string, number>>(t, admin, 'select public.admin_archive_preview() as r')
    expect(preview.total).toBe(3)
    expect(preview.in_progress).toBe(2)

    const beforeCount = await t.one<{ n: number }>('select count(*)::int as n from public.orders')
    const result = await rpcAs<{ batch_id: string; order_count: number }>(
      t, admin, `select public.admin_archive_orders('RESET ORDERS', 'Clearing launch-week test orders') as r`,
    )
    expect(result.order_count).toBe(3)

    const afterCount = await t.one<{ n: number }>('select count(*)::int as n from public.orders')
    expect(afterCount.n).toBe(beforeCount.n)

    const row = await orderRow(t, paid.order_id)
    expect(row.archived_at).not.toBeNull()
    expect(row.archive_batch_id).toBe(result.batch_id)
    expect(row.customer_id).toBe(customer)
    expect(row.delivery_address).toBe('Unity Hall, KNUST')
    const payment = await t.one<{ reference: string; status: string }>('select reference, status from public.payments where order_id = $1', [
      paid.order_id,
    ])
    expect(payment).toEqual({ reference: paid.reference, status: 'PAID' })

    const overview = await rpcAs<Record<string, number>>(t, admin, 'select public.admin_overview() as r')
    expect(overview).toMatchObject({ orders_today: 0, revenue_today_pesewas: 0, pending: 0, paid: 0, preparing: 0 })

    // Archived orders leave the rider's queue and are frozen for staff actions.
    const riderView = await t.as('authenticated', rider, () => t.query('select id from public.orders where id = $1', [paid.order_id]))
    expect(riderView).toEqual([])
    expect(
      await errorOf(t.as('authenticated', admin, () => t.query(`select public.admin_update_order_status($1, 'READY')`, [paid.order_id]))),
    ).toBe('ORDER_ARCHIVED')

    // Customers keep their purchase history.
    const customerView = await t.as('authenticated', customer, () =>
      t.query('select id from public.orders where id = $1', [paid.order_id]),
    )
    expect(customerView).toHaveLength(1)

    const batch = await t.one<{ order_count: number; reason: string }>('select order_count, reason from public.archive_batches where id = $1', [
      result.batch_id,
    ])
    expect(batch).toEqual({ order_count: 3, reason: 'Clearing launch-week test orders' })
    const audit = await t.query<{ action: string }>(`select action from public.audit_logs where action = 'orders.archived'`)
    expect(audit).toHaveLength(1)

    const archivedList = await t.as('authenticated', admin, () =>
      t.query('select id from public.admin_order_list where archive_batch_id = $1', [result.batch_id]),
    )
    expect(archivedList).toHaveLength(3)
  })
})
