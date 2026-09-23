import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness.ts'
import { createOrder, createPaidOrder, createStaff, orderRow, rpcAs } from './fixtures.ts'

let t: TestDb
let admin: string
let rider: string
let otherRider: string
let customer: string

const statuses = ['PENDING', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const

beforeAll(async () => {
  t = await createTestDb()
  ;({ admin, rider, otherRider } = await createStaff(t))
})
// A fresh customer per test keeps each test clear of the 10-orders-per-10-minutes limit.
beforeEach(async () => {
  customer = await t.createUser(`flow.${randomUUID()}@example.com`, { full_name: 'Abena Owusu' })
})
afterAll(async () => {
  await t.close()
})

const setStatus = (orderId: string, status: string, note: string | null = null, as = admin) =>
  t.as('authenticated', as, () => t.query('select public.admin_update_order_status($1, $2, $3)', [orderId, status, note]))
const assign = (orderId: string, riderId: string, as = admin) =>
  t.as('authenticated', as, () => t.query('select public.admin_assign_rider($1, $2)', [orderId, riderId]))
const startDelivery = (orderId: string, as = rider) =>
  t.as('authenticated', as, () => t.query('select public.rider_start_delivery($1)', [orderId]))
const markDelivered = (orderId: string, as = rider) =>
  t.as('authenticated', as, () => t.query('select public.rider_mark_delivered($1)', [orderId]))

describe('status machine', () => {
  it('allows exactly the documented transitions', async () => {
    const allowed = await t.query<{ f: string; t: string }>(`
      select f.s as f, x.s as t
      from unnest(enum_range(null::public.order_status)) as f(s)
      cross join unnest(enum_range(null::public.order_status)) as x(s)
      where private.is_valid_transition(f.s, x.s)
      order by 1, 2`)
    expect(allowed.map((r) => `${r.f}>${r.t}`).sort()).toEqual(
      [
        'PENDING>PAID', 'PENDING>CANCELLED',
        'PAID>PREPARING', 'PAID>CANCELLED',
        'PREPARING>READY', 'PREPARING>ASSIGNED', 'PREPARING>CANCELLED',
        'READY>ASSIGNED', 'READY>CANCELLED',
        'ASSIGNED>READY', 'ASSIGNED>OUT_FOR_DELIVERY', 'ASSIGNED>CANCELLED',
        'OUT_FOR_DELIVERY>DELIVERED', 'OUT_FOR_DELIVERY>CANCELLED',
      ].sort(),
    )
    expect(statuses).toHaveLength(8)
  })

  it('blocks jumps such as PENDING → DELIVERED and admin-forced payment states', async () => {
    const order = await createOrder(t, customer)
    expect(await errorOf(setStatus(order.order_id, 'PREPARING'))).toBe('INVALID_TRANSITION')
    expect(await errorOf(setStatus(order.order_id, 'DELIVERED'))).toBe('INVALID_TRANSITION')
    expect(await errorOf(setStatus(order.order_id, 'PAID'))).toBe('STATUS_SET_BY_PAYMENT')
    expect(await errorOf(setStatus(order.order_id, 'ASSIGNED'))).toBe('USE_ASSIGN_RIDER')

    const paid = await createPaidOrder(t, customer)
    expect(await errorOf(setStatus(paid.order_id, 'READY'))).toBe('INVALID_TRANSITION')
    expect(await errorOf(setStatus(paid.order_id, 'OUT_FOR_DELIVERY'))).toBe('INVALID_TRANSITION')
    expect(await errorOf(setStatus(paid.order_id, 'CANCELLED'))).toBe('CANCELLATION_REASON_REQUIRED')
  })

  it('lets only admins drive kitchen statuses', async () => {
    const paid = await createPaidOrder(t, customer)
    expect(await errorOf(setStatus(paid.order_id, 'PREPARING', null, customer))).toBe('FORBIDDEN')
    expect(await errorOf(setStatus(paid.order_id, 'PREPARING', null, rider))).toBe('FORBIDDEN')
    await setStatus(paid.order_id, 'PREPARING')
    expect((await orderRow(t, paid.order_id)).order_status).toBe('PREPARING')
  })
})

describe('end-to-end delivery flow', () => {
  it('runs PAID → PREPARING → READY → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED with history, audit and notifications', async () => {
    const order = await createPaidOrder(t, customer)
    await setStatus(order.order_id, 'PREPARING')
    await setStatus(order.order_id, 'READY')

    // Before assignment the rider cannot see the order at all.
    const hidden = await t.as('authenticated', rider, () => t.query('select id from public.orders where id = $1', [order.order_id]))
    expect(hidden).toEqual([])

    await assign(order.order_id, rider)
    const assigned = await orderRow(t, order.order_id)
    expect(assigned).toMatchObject({ order_status: 'ASSIGNED', assigned_rider_id: rider })

    // The assigned rider sees what they need; the other rider sees nothing.
    const riderView = await t.as('authenticated', rider, () =>
      t.one<Record<string, unknown>>(
        'select order_reference, contact_name, contact_phone, delivery_latitude, delivery_longitude from public.orders where id = $1',
        [order.order_id],
      ),
    )
    expect(riderView).toMatchObject({ contact_name: 'Ama Mensah', contact_phone: '024 387 0366', delivery_latitude: 6.6745 })
    const items = await t.as('authenticated', rider, () =>
      t.query('select product_name from public.order_items where order_id = $1', [order.order_id]),
    )
    expect(items).toHaveLength(1)
    const otherView = await t.as('authenticated', otherRider, () =>
      t.query('select id from public.orders where id = $1', [order.order_id]),
    )
    expect(otherView).toEqual([])

    // Riders never see payments or admin notes.
    await t.as('authenticated', admin, () => t.query(`select public.admin_set_order_notes($1, 'VIP customer')`, [order.order_id]))
    const riderPayments = await t.as('authenticated', rider, () =>
      t.query('select id from public.payments where order_id = $1', [order.order_id]),
    )
    expect(riderPayments).toEqual([])
    const riderNotes = await t.as('authenticated', rider, () =>
      t.query('select notes from public.order_admin_notes where order_id = $1', [order.order_id]),
    )
    expect(riderNotes).toEqual([])
    const customerNotes = await t.as('authenticated', customer, () =>
      t.query('select notes from public.order_admin_notes where order_id = $1', [order.order_id]),
    )
    expect(customerNotes).toEqual([])

    expect(await errorOf(startDelivery(order.order_id, otherRider))).toBe('NOT_ASSIGNED_TO_YOU')
    expect(await errorOf(startDelivery(order.order_id, customer))).toBe('FORBIDDEN')
    expect(await errorOf(markDelivered(order.order_id))).toBe('INVALID_TRANSITION')

    await startDelivery(order.order_id)
    const out = await orderRow(t, order.order_id)
    expect(out.order_status).toBe('OUT_FOR_DELIVERY')
    expect(out.picked_up_at).not.toBeNull()

    expect(await errorOf(markDelivered(order.order_id, otherRider))).toBe('NOT_ASSIGNED_TO_YOU')
    await markDelivered(order.order_id)
    const done = await orderRow(t, order.order_id)
    expect(done.order_status).toBe('DELIVERED')
    expect(done.delivered_at).not.toBeNull()
    expect(await errorOf(markDelivered(order.order_id))).toBe('INVALID_TRANSITION')

    const history = await t.as('authenticated', customer, () =>
      t.query<{ event: string; to_status: string | null }>(
        'select event, to_status from public.order_status_history where order_id = $1 order by id',
        [order.order_id],
      ),
    )
    expect(history.map((h) => h.to_status ?? h.event)).toEqual([
      'PENDING', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED',
    ])

    const audit = await t.query<{ action: string }>(
      `select action from public.audit_logs where target_type = 'order' and target_id = $1 order by id`,
      [order.order_id],
    )
    expect(audit.map((a) => a.action)).toEqual([
      'order.payment_confirmed',
      'order.status_changed',
      'order.status_changed',
      'order.status_changed',
      'order.rider_assigned',
      'order.notes_updated',
      'delivery.started',
      'delivery.completed',
    ])

    const riderNotifications = await t.query<{ kind: string }>(
      'select kind from public.notifications where user_id = $1 and order_id = $2',
      [rider, order.order_id],
    )
    expect(riderNotifications.map((n) => n.kind)).toContain('DELIVERY_ASSIGNED')
    const customerNotifications = await t.query<{ title: string }>(
      'select title from public.notifications where user_id = $1 and order_id = $2 order by created_at',
      [customer, order.order_id],
    )
    expect(customerNotifications.map((n) => n.title)).toContain('Delivered. Enjoy!')
  })

  it('only assigns users who hold the RIDER role, and only admins can assign', async () => {
    const order = await createPaidOrder(t, customer)
    await setStatus(order.order_id, 'PREPARING')
    await setStatus(order.order_id, 'READY')
    expect(await errorOf(assign(order.order_id, customer))).toBe('NOT_A_RIDER')
    expect(await errorOf(assign(order.order_id, rider, rider))).toBe('FORBIDDEN')
    expect(await errorOf(assign(order.order_id, rider, customer))).toBe('FORBIDDEN')
    const pending = await createOrder(t, customer)
    expect(await errorOf(assign(pending.order_id, rider))).toBe('CANNOT_ASSIGN_IN_STATUS')
  })

  it('supports assigning during preparation; marking ready then hands it straight to the rider', async () => {
    const order = await createPaidOrder(t, customer)
    await setStatus(order.order_id, 'PREPARING')
    await assign(order.order_id, rider)
    expect(await orderRow(t, order.order_id)).toMatchObject({ order_status: 'PREPARING', assigned_rider_id: rider })
    expect(await errorOf(startDelivery(order.order_id))).toBe('ORDER_NOT_READY')

    await setStatus(order.order_id, 'READY')
    expect((await orderRow(t, order.order_id)).order_status).toBe('ASSIGNED')
    const ready = await t.query('select 1 from public.notifications where user_id = $1 and kind = $2 and order_id = $3', [
      rider,
      'DELIVERY_READY',
      order.order_id,
    ])
    expect(ready).toHaveLength(1)
  })

  it('reassigns and unassigns safely, notifying the riders involved', async () => {
    const order = await createPaidOrder(t, customer)
    await setStatus(order.order_id, 'PREPARING')
    await setStatus(order.order_id, 'READY')
    await assign(order.order_id, rider)
    await assign(order.order_id, otherRider)
    expect(await orderRow(t, order.order_id)).toMatchObject({ order_status: 'ASSIGNED', assigned_rider_id: otherRider })
    const lost = await t.as('authenticated', rider, () => t.query('select id from public.orders where id = $1', [order.order_id]))
    expect(lost).toEqual([])

    await t.as('authenticated', admin, () => t.query('select public.admin_unassign_rider($1)', [order.order_id]))
    expect(await orderRow(t, order.order_id)).toMatchObject({ order_status: 'READY', assigned_rider_id: null })
  })

  it('stops riders seeing a delivery 24 hours after completion and exposes minimal history instead', async () => {
    const order = await createPaidOrder(t, customer)
    await setStatus(order.order_id, 'PREPARING')
    await setStatus(order.order_id, 'READY')
    await assign(order.order_id, rider)
    await startDelivery(order.order_id)
    await markDelivered(order.order_id)
    await t.query(`update public.orders set delivered_at = now() - interval '25 hours' where id = $1`, [order.order_id])

    const direct = await t.as('authenticated', rider, () => t.query('select id from public.orders where id = $1', [order.order_id]))
    expect(direct).toEqual([])

    const history = await t.as('authenticated', rider, () =>
      t.query<Record<string, unknown>>('select * from public.rider_delivery_history(50, 0)'),
    )
    const row = history.find((h) => h.order_id === order.order_id)
    expect(row).toMatchObject({ order_reference: order.order_reference, customer_first_name: 'Ama', order_status: 'DELIVERED' })
    expect(Object.keys(row ?? {})).not.toContain('contact_phone')
    expect(Object.keys(row ?? {})).not.toContain('delivery_latitude')

    expect(await errorOf(t.as('authenticated', customer, () => t.query('select * from public.rider_delivery_history()')))).toBe(
      'FORBIDDEN',
    )
  })
})

describe('delivery fee and balance', () => {
  it('changes the fee before payment and supersedes stale checkout links', async () => {
    const order = await createOrder(t, customer)
    const attempt = await t.as('service_role', null, () =>
      t.one<{ r: { payment_id: string } }>('select public.begin_payment_attempt($1, $2) as r', [order.order_id, customer]),
    )
    const result = await rpcAs<{ status: string; kind: string }>(
      t, admin, `select public.set_order_delivery_charge($1, 700, 'Ayeduase run') as r`, [order.order_id],
    )
    expect(result).toEqual({ status: 'APPLIED', kind: 'DELIVERY_FEE' })
    const row = await orderRow(t, order.order_id)
    expect(row).toMatchObject({ delivery_fee_pesewas: 700, total_pesewas: 3700, delivery_fee_status: 'SET', delivery_fee_note: 'Ayeduase run' })
    const payment = await t.one<{ status: string }>('select status from public.payments where id = $1', [attempt.r.payment_id])
    expect(payment.status).toBe('SUPERSEDED')
  })

  it('never rewrites a completed charge: after payment it becomes a separate delivery balance', async () => {
    const order = await createPaidOrder(t, customer)
    const before = await orderRow(t, order.order_id)
    const result = await rpcAs<{ status: string; kind: string }>(
      t, admin, `select public.set_order_delivery_charge($1, 500, 'Far side of Kotei') as r`, [order.order_id],
    )
    expect(result).toEqual({ status: 'APPLIED', kind: 'DELIVERY_BALANCE' })
    const after = await orderRow(t, order.order_id)
    expect(after.total_pesewas).toBe(before.total_pesewas)
    expect(after.amount_paid_pesewas).toBe(before.amount_paid_pesewas)
    expect(after.delivery_fee_pesewas).toBe(before.delivery_fee_pesewas)
    expect(after.delivery_balance_pesewas).toBe(500)
    const payment = await t.one<{ amount_pesewas: number; status: string }>(
      'select amount_pesewas, status from public.payments where reference = $1',
      [order.reference],
    )
    expect(payment).toEqual({ amount_pesewas: before.total_pesewas, status: 'PAID' })

    const history = await t.query<{ kind: string; previous_amount_pesewas: number; amount_pesewas: number; created_by_role: string }>(
      'select kind, previous_amount_pesewas, amount_pesewas, created_by_role from public.delivery_fee_changes where order_id = $1',
      [order.order_id],
    )
    expect(history).toEqual([{ kind: 'DELIVERY_BALANCE', previous_amount_pesewas: 0, amount_pesewas: 500, created_by_role: 'ADMIN' }])
  })

  it('lets an assigned rider propose a fee that an admin approves (default PROPOSE mode)', async () => {
    const order = await createPaidOrder(t, customer)
    await setStatus(order.order_id, 'PREPARING')
    await setStatus(order.order_id, 'READY')
    await assign(order.order_id, rider)

    expect(
      await errorOf(t.as('authenticated', otherRider, () => t.query('select public.set_order_delivery_charge($1, 300)', [order.order_id]))),
    ).toBe('FORBIDDEN')

    const proposal = await rpcAs<{ status: string; change_id: string }>(
      t, rider, `select public.set_order_delivery_charge($1, 300, 'Long route') as r`, [order.order_id],
    )
    expect(proposal.status).toBe('PROPOSED')
    expect((await orderRow(t, order.order_id)).delivery_balance_pesewas).toBe(0)

    const riderSeesProposal = await t.as('authenticated', rider, () =>
      t.query<{ status: string }>('select status from public.delivery_fee_changes where order_id = $1', [order.order_id]),
    )
    expect(riderSeesProposal.map((p) => p.status)).toEqual(['PROPOSED'])

    expect(
      await errorOf(t.as('authenticated', rider, () => t.query('select public.admin_review_fee_proposal($1, true)', [proposal.change_id]))),
    ).toBe('FORBIDDEN')
    await t.as('authenticated', admin, () => t.query('select public.admin_review_fee_proposal($1, true)', [proposal.change_id]))
    expect((await orderRow(t, order.order_id)).delivery_balance_pesewas).toBe(300)
    expect(
      await errorOf(t.as('authenticated', admin, () => t.query('select public.admin_review_fee_proposal($1, false)', [proposal.change_id]))),
    ).toBe('PROPOSAL_ALREADY_REVIEWED')

    await t.as('authenticated', rider, () => t.query('select public.mark_delivery_balance_collected($1)', [order.order_id]))
    expect((await orderRow(t, order.order_id)).delivery_balance_collected_at).not.toBeNull()
  })

  it('honours the NONE and SET rider permissions', async () => {
    const order = await createPaidOrder(t, customer)
    await setStatus(order.order_id, 'PREPARING')
    await assign(order.order_id, rider)

    await t.query(`update public.store_settings set rider_fee_permission = 'NONE'`)
    expect(
      await errorOf(t.as('authenticated', rider, () => t.query('select public.set_order_delivery_charge($1, 200)', [order.order_id]))),
    ).toBe('RIDER_FEE_CHANGES_DISABLED')

    await t.query(`update public.store_settings set rider_fee_permission = 'SET'`)
    const applied = await rpcAs<{ status: string }>(t, rider, 'select public.set_order_delivery_charge($1, 200) as r', [order.order_id])
    expect(applied.status).toBe('APPLIED')
    expect((await orderRow(t, order.order_id)).delivery_balance_pesewas).toBe(200)
    await t.query(`update public.store_settings set rider_fee_permission = 'PROPOSE'`)
  })

  it('rejects fee changes on closed orders and invalid amounts', async () => {
    const order = await createOrder(t, customer)
    expect(await errorOf(t.as('authenticated', admin, () => t.query('select public.set_order_delivery_charge($1, -5)', [order.order_id])))).toBe(
      'INVALID_AMOUNT',
    )
    await t.as('authenticated', customer, () => t.query('select public.customer_cancel_order($1)', [order.order_id]))
    expect(await errorOf(t.as('authenticated', admin, () => t.query('select public.set_order_delivery_charge($1, 100)', [order.order_id])))).toBe(
      'ORDER_CLOSED',
    )
    expect(await errorOf(t.as('authenticated', customer, () => t.query('select public.set_order_delivery_charge($1, 100)', [order.order_id])))).toBe(
      'FORBIDDEN',
    )
  })
})

describe('public tracking', () => {
  it('needs the reference and checkout phone, and returns no address, coordinates or names', async () => {
    const order = await createPaidOrder(t, customer)
    const found = await t.as('anon', null, () =>
      t.one<{ r: Record<string, unknown> | null }>('select public.track_order_public($1, $2) as r', [
        order.order_reference.toLowerCase(),
        '+233 24 387 0366',
      ]),
    )
    expect(found.r).toMatchObject({ order_reference: order.order_reference, order_status: 'PAID' })
    const serialised = JSON.stringify(found.r)
    for (const secret of ['Unity Hall', '6.6745', '-1.5716', 'Ama', '0366', 'Opposite']) {
      expect(serialised).not.toContain(secret)
    }

    const wrongPhone = await t.as('anon', null, () =>
      t.one<{ r: unknown }>('select public.track_order_public($1, $2) as r', [order.order_reference, '0200000000']),
    )
    expect(wrongPhone.r).toBeNull()
  })
})

describe('dashboards', () => {
  it('reports real per-user counts', async () => {
    const fresh = await t.createUser('dash.customer@example.com')
    const empty = await rpcAs<Record<string, number>>(t, fresh, 'select public.account_summary() as r')
    expect(empty).toEqual({ active_orders: 0, completed_orders: 0, saved_locations: 0 })

    await createOrder(t, fresh)
    const one = await rpcAs<Record<string, number>>(t, fresh, 'select public.account_summary() as r')
    expect(one.active_orders).toBe(1)

    const summary = await rpcAs<Record<string, number>>(t, rider, 'select public.rider_summary() as r')
    expect(Object.keys(summary).sort()).toEqual(['assigned', 'completed_today', 'out_for_delivery', 'ready_for_pickup'])
    expect(await errorOf(t.as('authenticated', fresh, () => t.query('select public.rider_summary()')))).toBe('FORBIDDEN')
  })
})
