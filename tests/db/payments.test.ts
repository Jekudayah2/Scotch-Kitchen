import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness.ts'
import { beginPayment, confirmPayment, createOrder, createPaidOrder, createStaff, orderRow, VARIANTS } from './fixtures.ts'

let t: TestDb
let admin: string

beforeAll(async () => {
  t = await createTestDb()
  ;({ admin } = await createStaff(t))
})
afterAll(async () => {
  await t.close()
})

describe('payment architecture', () => {
  it('keeps payment-state functions out of reach of browsers', async () => {
    const customer = await t.createUser('pay.attacker@example.com')
    const order = await createOrder(t, customer)
    for (const sql of [
      `select public.begin_payment_attempt('${order.order_id}', '${customer}')`,
      `select public.confirm_paystack_payment('SKP-X', 3000, 'GHS', now(), 'card', 'ok', '1', 'BROWSER')`,
      `select public.record_payment_failure('SKP-X', 'FAILED', 'x')`,
      `select public.attach_payment_authorization('${order.order_id}', 'a', 'https://x')`,
    ]) {
      expect(await errorOf(t.as('authenticated', customer, () => t.query(sql)))).toMatch(/permission denied/)
      expect(await errorOf(t.as('anon', null, () => t.query(sql)))).toMatch(/permission denied/)
    }
    const row = await orderRow(t, order.order_id)
    expect(row.payment_status).toBe('PENDING')
  })

  it('charges the authoritative total and refuses to start payment for someone else’s order', async () => {
    const customer = await t.createUser('pay.owner@example.com')
    const other = await t.createUser('pay.other@example.com')
    const order = await createOrder(t, customer, [{ variant_id: VARIANTS.ZOBOPOP_500, quantity: 3 }])

    const attempt = await beginPayment(t, order.order_id, customer)
    expect(attempt.ok).toBe(true)
    expect(attempt.amount_pesewas).toBe(4500)
    expect(attempt.reference).toMatch(/^SKP-[A-Z0-9]{6}-[A-Z0-9]{8}$/)

    const stolen = await beginPayment(t, order.order_id, other)
    expect(stolen).toMatchObject({ ok: false, error: 'ORDER_NOT_FOUND' })
  })

  it('reuses a fresh checkout link instead of creating duplicate transactions', async () => {
    const customer = await t.createUser('pay.reuse@example.com')
    const order = await createOrder(t, customer)
    const first = await beginPayment(t, order.order_id, customer)
    await t.as('service_role', null, () =>
      t.query(`select public.attach_payment_authorization($1, 'ACC', 'https://checkout.paystack.com/x1')`, [first.payment_id]),
    )
    const second = await beginPayment(t, order.order_id, customer)
    expect(second.reused).toBe(true)
    expect(second.reference).toBe(first.reference)
  })

  it('marks the order PAID only after server-side confirmation, exactly once', async () => {
    const customer = await t.createUser('pay.happy@example.com')
    const order = await createOrder(t, customer, [
      { variant_id: VARIANTS.ZOBOPOP_330, quantity: 1 },
      { variant_id: VARIANTS.CREAMYPOP_STRAWBERRY, quantity: 2 },
    ])
    const attempt = await beginPayment(t, order.order_id, customer)
    expect((await orderRow(t, order.order_id)).payment_status).toBe('PENDING')

    const first = await confirmPayment(t, attempt.reference, 2600)
    expect(first).toMatchObject({ ok: true, already_processed: false, order_status: 'PAID', payment_status: 'PAID' })

    // Webhook and browser verification can both arrive: the second is a no-op.
    const second = await confirmPayment(t, attempt.reference, 2600)
    expect(second).toMatchObject({ ok: true, already_processed: true })

    const row = await orderRow(t, order.order_id)
    expect(row).toMatchObject({ order_status: 'PAID', payment_status: 'PAID', amount_paid_pesewas: 2600 })
    const payment = await t.one<Record<string, unknown>>('select * from public.payments where reference = $1', [attempt.reference])
    expect(payment).toMatchObject({ status: 'PAID', amount_pesewas: 2600, amount_received_pesewas: 2600, currency: 'GHS', channel: 'mobile_money' })
    expect(payment.verified_at).not.toBeNull()

    const events = await t.query<{ event: string }>(
      'select event from public.order_status_history where order_id = $1 order by id',
      [order.order_id],
    )
    expect(events.map((e) => e.event)).toEqual(['ORDER_PLACED', 'PAYMENT_CONFIRMED'])

    const adminNote = await t.query<{ kind: string }>(
      `select kind from public.notifications where user_id = $1 and order_id = $2`,
      [admin, order.order_id],
    )
    expect(adminNote.map((n) => n.kind)).toContain('NEW_PAID_ORDER')
  })

  it('refuses amount or currency mismatches and flags them for review', async () => {
    const customer = await t.createUser('pay.mismatch@example.com')
    const order = await createOrder(t, customer)
    const attempt = await beginPayment(t, order.order_id, customer)

    const result = await confirmPayment(t, attempt.reference, 100)
    expect(result).toMatchObject({ ok: false, error: 'AMOUNT_MISMATCH' })
    expect((await orderRow(t, order.order_id)).payment_status).toBe('PENDING')

    const attempt2 = await beginPayment(t, order.order_id, customer)
    const usd = await confirmPayment(t, attempt2.reference, attempt2.amount_pesewas, 'USD')
    expect(usd).toMatchObject({ ok: false, error: 'AMOUNT_MISMATCH' })

    const audit = await t.query<{ action: string }>(`select action from public.audit_logs where action = 'payment.mismatch'`)
    expect(audit.length).toBeGreaterThanOrEqual(2)
  })

  it('records failures without touching a paid order', async () => {
    const customer = await t.createUser('pay.fail@example.com')
    const order = await createOrder(t, customer)
    const attempt = await beginPayment(t, order.order_id, customer)
    await t.as('service_role', null, () =>
      t.query(`select public.record_payment_failure($1, 'FAILED', 'Declined')`, [attempt.reference]),
    )
    expect((await orderRow(t, order.order_id)).payment_status).toBe('FAILED')

    // A fresh attempt puts the order back into PENDING payment.
    const retry = await beginPayment(t, order.order_id, customer)
    expect(retry.ok).toBe(true)
    expect((await orderRow(t, order.order_id)).payment_status).toBe('PENDING')
    await confirmPayment(t, retry.reference, retry.amount_pesewas)
    expect((await orderRow(t, order.order_id)).payment_status).toBe('PAID')

    const again = await beginPayment(t, order.order_id, customer)
    expect(again).toMatchObject({ ok: false, error: 'ALREADY_PAID' })
  })

  it('flags money received for an order cancelled before payment completed', async () => {
    const customer = await t.createUser('pay.cancelled@example.com')
    const order = await createOrder(t, customer)
    const attempt = await beginPayment(t, order.order_id, customer)
    await t.as('authenticated', customer, () => t.query('select public.customer_cancel_order($1)', [order.order_id]))

    const result = await confirmPayment(t, attempt.reference, attempt.amount_pesewas)
    expect(result.ok).toBe(true)
    const row = await orderRow(t, order.order_id)
    expect(row.order_status).toBe('CANCELLED')
    const refund = await t.query(`select 1 from public.notifications where user_id = $1 and kind = 'REFUND_REQUIRED' and order_id = $2`, [
      admin,
      order.order_id,
    ])
    expect(refund).toHaveLength(1)
  })

  it('lets customers see their own payments but not other people’s', async () => {
    const customer = await t.createUser('pay.visible@example.com')
    const other = await t.createUser('pay.nosy@example.com')
    const paid = await createPaidOrder(t, customer)
    const mine = await t.as('authenticated', customer, () =>
      t.query<{ reference: string }>('select reference from public.payments where order_id = $1', [paid.order_id]),
    )
    expect(mine.map((p) => p.reference)).toEqual([paid.reference])
    const theirs = await t.as('authenticated', other, () =>
      t.query('select reference from public.payments where order_id = $1', [paid.order_id]),
    )
    expect(theirs).toEqual([])
  })

  it('decrements tracked stock only when payment is confirmed', async () => {
    await t.query('update public.product_variants set track_stock = true, stock_quantity = 10 where id = $1', [
      VARIANTS.CREAMYPOP_VANILLA,
    ])
    const customer = await t.createUser('pay.stock@example.com')
    const order = await createOrder(t, customer, [{ variant_id: VARIANTS.CREAMYPOP_VANILLA, quantity: 3 }])
    const stock = async () =>
      (await t.one<{ s: number }>('select stock_quantity as s from public.product_variants where id = $1', [VARIANTS.CREAMYPOP_VANILLA])).s
    expect(await stock()).toBe(10)
    const attempt = await beginPayment(t, order.order_id, customer)
    await confirmPayment(t, attempt.reference, attempt.amount_pesewas)
    expect(await stock()).toBe(7)

    await t.as('authenticated', admin, () =>
      t.query(`select public.admin_update_order_status($1, 'CANCELLED', 'Out of cones')`, [order.order_id]),
    )
    expect(await stock()).toBe(10)
    await t.query('update public.product_variants set track_stock = false, stock_quantity = null where id = $1', [
      VARIANTS.CREAMYPOP_VANILLA,
    ])
  })
})
