import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness.ts'
import { contact, createOrder, delivery, orderRow, VARIANTS } from './fixtures.ts'

let t: TestDb
let customer: string

beforeAll(async () => {
  t = await createTestDb()
  customer = await t.createUser('orders.customer@example.com', { full_name: 'Ama Mensah' })
})
afterAll(async () => {
  await t.close()
})

describe('create_order: authoritative pricing', () => {
  it('prices every line from the database and ignores client-supplied prices', async () => {
    const order = await createOrder(t, customer, [
      { variant_id: VARIANTS.ZOBOPOP_500, quantity: 2, unit_price_pesewas: 1, price: 0.01 },
      { variant_id: VARIANTS.CREAMYPOP_VANILLA, quantity: 1, price_pesewas: 5 },
    ])
    // 2 × GH₵15 + 1 × GH₵8 = GH₵38 ; QUOTE mode → fee confirmed later
    expect(order.subtotal_pesewas).toBe(3800)
    expect(order.delivery_fee_pesewas).toBe(0)
    expect(order.delivery_fee_status).toBe('QUOTE_PENDING')
    expect(order.total_pesewas).toBe(3800)
    expect(order.order_reference).toMatch(/^SK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)

    const items = await t.query<{ product_name: string; variant_name: string; unit_price_pesewas: number; quantity: number; line_total_pesewas: number }>(
      'select product_name, variant_name, unit_price_pesewas, quantity, line_total_pesewas from public.order_items where order_id = $1 order by unit_price_pesewas desc',
      [order.order_id],
    )
    expect(items).toEqual([
      { product_name: 'ZOBOPOP', variant_name: '500ml', unit_price_pesewas: 1500, quantity: 2, line_total_pesewas: 3000 },
      { product_name: 'Creamypop Ice Cream', variant_name: 'Vanilla', unit_price_pesewas: 800, quantity: 1, line_total_pesewas: 800 },
    ])
  })

  it('merges duplicate lines for the same variant', async () => {
    const order = await createOrder(t, customer, [
      { variant_id: VARIANTS.ZOBOPOP_330, quantity: 1 },
      { variant_id: VARIANTS.ZOBOPOP_330, quantity: 2 },
    ])
    expect(order.subtotal_pesewas).toBe(3000)
    const row = await orderRow(t, order.order_id)
    expect(row.item_count).toBe(3)
    expect(row.items_summary).toBe('3 × ZOBOPOP 330ml')
  })

  it('charges the flat fee when the store is in FLAT mode', async () => {
    await t.query(`update public.store_settings set delivery_fee_mode = 'FLAT', flat_delivery_fee_pesewas = 500`)
    const order = await createOrder(t, customer, [{ variant_id: VARIANTS.CREAMYPOP_STRAWBERRY, quantity: 2 }])
    expect(order.subtotal_pesewas).toBe(1600)
    expect(order.delivery_fee_pesewas).toBe(500)
    expect(order.total_pesewas).toBe(2100)
    await t.query(`update public.store_settings set delivery_fee_mode = 'QUOTE', flat_delivery_fee_pesewas = null`)
  })

  it.each([
    [[{ variant_id: VARIANTS.ZOBOPOP_500, quantity: 0 }], 'INVALID_QUANTITY'],
    [[{ variant_id: VARIANTS.ZOBOPOP_500, quantity: -1 }], 'INVALID_CART_ITEM'],
    [[{ variant_id: VARIANTS.ZOBOPOP_500, quantity: 1.5 }], 'INVALID_CART_ITEM'],
    [[{ variant_id: VARIANTS.ZOBOPOP_500, quantity: '2' }], 'INVALID_CART_ITEM'],
    [[{ variant_id: VARIANTS.ZOBOPOP_500, quantity: 21 }], 'INVALID_QUANTITY'],
    [[{ variant_id: 'not-a-uuid', quantity: 1 }], 'INVALID_CART_ITEM'],
    [[{ variant_id: randomUUID(), quantity: 1 }], 'ITEM_UNAVAILABLE'],
    [[], 'CART_EMPTY'],
    [{}, 'CART_EMPTY'],
  ])('rejects invalid cart %j with %s', async (items, code) => {
    expect(await errorOf(createOrder(t, customer, items))).toBe(code)
  })

  it('rejects unavailable and sold-out variants', async () => {
    await t.query('update public.product_variants set is_available = false where id = $1', [VARIANTS.CREAMYPOP_VANILLA])
    expect(await errorOf(createOrder(t, customer, [{ variant_id: VARIANTS.CREAMYPOP_VANILLA, quantity: 1 }]))).toBe(
      'ITEM_UNAVAILABLE',
    )
    await t.query('update public.product_variants set is_available = true where id = $1', [VARIANTS.CREAMYPOP_VANILLA])

    await t.query('update public.product_variants set track_stock = true, stock_quantity = 1 where id = $1', [
      VARIANTS.CREAMYPOP_VANILLA,
    ])
    expect(await errorOf(createOrder(t, customer, [{ variant_id: VARIANTS.CREAMYPOP_VANILLA, quantity: 2 }]))).toBe(
      'INSUFFICIENT_STOCK',
    )
    await t.query('update public.product_variants set track_stock = false, stock_quantity = null where id = $1', [
      VARIANTS.CREAMYPOP_VANILLA,
    ])
  })

  it('refuses orders when the store is paused', async () => {
    await t.query('update public.store_settings set accepting_orders = false')
    expect(await errorOf(createOrder(t, customer))).toBe('STORE_NOT_ACCEPTING_ORDERS')
    await t.query('update public.store_settings set accepting_orders = true')
  })

  it('requires a signed-in customer', async () => {
    const error = await errorOf(
      t.as('anon', null, () =>
        t.query('select public.create_order($1::jsonb, $2::jsonb, $3::jsonb, $4::uuid)', [
          JSON.stringify([{ variant_id: VARIANTS.ZOBOPOP_500, quantity: 1 }]),
          JSON.stringify(contact()),
          JSON.stringify(delivery()),
          randomUUID(),
        ]),
      ),
    )
    expect(error).toMatch(/permission denied/)
  })
})

describe('create_order: delivery location', () => {
  it('requires the location to be explicitly confirmed', async () => {
    expect(await errorOf(createOrder(t, customer, undefined, { delivery: delivery({ confirmed: false }) }))).toBe(
      'LOCATION_NOT_CONFIRMED',
    )
    expect(await errorOf(createOrder(t, customer, undefined, { delivery: delivery({ confirmed: 'true' }) }))).toBe(
      'LOCATION_NOT_CONFIRMED',
    )
  })

  it.each([
    [{ latitude: 91 }, 'INVALID_LATITUDE'],
    [{ latitude: -90.5 }, 'INVALID_LATITUDE'],
    [{ longitude: 181 }, 'INVALID_LONGITUDE'],
    [{ latitude: '6.67' }, 'INVALID_COORDINATES'],
    [{ latitude: 0, longitude: 0 }, 'INVALID_COORDINATES'],
    // A swapped Kumasi pin ([lng, lat] stored as lat/lng) lands in the Gulf of Guinea.
    [{ latitude: -1.5716, longitude: 6.6745 }, 'OUTSIDE_SERVICE_AREA'],
    [{ accuracy: -3 }, 'INVALID_ACCURACY'],
    [{ source: 'GUESS' }, 'INVALID_LOCATION_SOURCE'],
    [{ address: '  ' }, 'INVALID_DELIVERY_ADDRESS'],
  ])('rejects %j with %s (never silently swapped)', async (override, code) => {
    expect(await errorOf(createOrder(t, customer, undefined, { delivery: delivery(override) }))).toBe(code)
  })

  it('stores null accuracy when none was measured (no fabricated accuracy)', async () => {
    const order = await createOrder(t, customer, undefined, {
      delivery: delivery({ accuracy: null, source: 'MAP' }),
    })
    const row = await orderRow(t, order.order_id)
    expect(row.delivery_location_accuracy).toBeNull()
    expect(row.delivery_location_source).toBe('MAP')
  })

  it('snapshots the destination so editing a saved location never changes past orders', async () => {
    const saved = await t.as('authenticated', customer, () =>
      t.one<{ id: string }>(
        `insert into public.saved_locations (user_id, label, address, landmark, latitude, longitude, accuracy_m, delivery_instructions)
         values ($1, 'Hostel', 'Location A, Ayeduase', 'Blue gate', 6.6701, -1.5601, 9, 'Ring twice') returning id`,
        [customer],
      ),
    )
    const order = await createOrder(t, customer, undefined, {
      delivery: delivery({
        source: 'SAVED',
        saved_location_id: saved.id,
        address: 'Location A, Ayeduase',
        landmark: 'Blue gate',
        latitude: 6.6701,
        longitude: -1.5601,
        accuracy: 9,
        instructions: 'Ring twice',
      }),
    })

    await t.as('authenticated', customer, () =>
      t.query(
        `update public.saved_locations
            set address = 'Location B, Bomso', landmark = 'Red gate', latitude = 6.68, longitude = -1.58
          where id = $1`,
        [saved.id],
      ),
    )

    const row = await orderRow(t, order.order_id)
    expect(row).toMatchObject({
      delivery_address: 'Location A, Ayeduase',
      delivery_landmark: 'Blue gate',
      delivery_latitude: 6.6701,
      delivery_longitude: -1.5601,
      delivery_location_accuracy: 9,
      delivery_instructions: 'Ring twice',
      saved_location_id: saved.id,
    })

    // Deleting the saved location keeps the snapshot intact.
    await t.as('authenticated', customer, () => t.query('delete from public.saved_locations where id = $1', [saved.id]))
    const after = await orderRow(t, order.order_id)
    expect(after.delivery_address).toBe('Location A, Ayeduase')
    expect(after.saved_location_id).toBeNull()
  })

  it('ignores another customer’s saved location id', async () => {
    const other = await t.createUser('other.saved@example.com')
    const theirs = await t.as('authenticated', other, () =>
      t.one<{ id: string }>(
        `insert into public.saved_locations (user_id, label, address, latitude, longitude)
         values ($1, 'Home', 'Somewhere else', 6.7, -1.6) returning id`,
        [other],
      ),
    )
    const order = await createOrder(t, customer, undefined, { delivery: delivery({ saved_location_id: theirs.id }) })
    const row = await orderRow(t, order.order_id)
    expect(row.saved_location_id).toBeNull()
  })
})

describe('create_order: contact, idempotency and privacy', () => {
  beforeAll(async () => {
    customer = await t.createUser('orders.customer2@example.com', { full_name: 'Esi Owusu' })
  })

  it('validates the contact snapshot', async () => {
    expect(await errorOf(createOrder(t, customer, undefined, { contact: contact({ name: 'A' }) }))).toBe('INVALID_CONTACT_NAME')
    expect(await errorOf(createOrder(t, customer, undefined, { contact: contact({ phone: 'call me' }) }))).toBe(
      'INVALID_CONTACT_PHONE',
    )
  })

  it('returns the original order when the same checkout is submitted twice', async () => {
    const key = randomUUID()
    const first = await createOrder(t, customer, undefined, { key })
    const second = await createOrder(t, customer, [{ variant_id: VARIANTS.CREAMYPOP_VANILLA, quantity: 9 }], { key })
    expect(second.replayed).toBe(true)
    expect(second.order_id).toBe(first.order_id)
    expect(second.total_pesewas).toBe(first.total_pesewas)
    const count = await t.one<{ n: number }>('select count(*)::int as n from public.orders where idempotency_key = $1', [key])
    expect(count.n).toBe(1)
  })

  it('keeps each customer’s orders, items and history private', async () => {
    const mine = await createOrder(t, customer)
    const stranger = await t.createUser('stranger@example.com')

    const seen = await t.as('authenticated', stranger, () =>
      t.query('select id from public.orders where id = $1', [mine.order_id]),
    )
    expect(seen).toEqual([])
    const items = await t.as('authenticated', stranger, () =>
      t.query('select id from public.order_items where order_id = $1', [mine.order_id]),
    )
    expect(items).toEqual([])
    const history = await t.as('authenticated', stranger, () =>
      t.query('select id from public.order_status_history where order_id = $1', [mine.order_id]),
    )
    expect(history).toEqual([])

    const own = await t.as('authenticated', customer, () =>
      t.query<{ id: string }>('select id from public.orders where id = $1', [mine.order_id]),
    )
    expect(own).toHaveLength(1)
    await expect(t.as('anon', null, () => t.query('select id from public.orders'))).rejects.toThrow(/permission denied/)
  })

  it('never lets customers write orders directly', async () => {
    const mine = await createOrder(t, customer)
    await t.as('authenticated', customer, () =>
      t.query(`update public.orders set payment_status = 'PAID' where id = $1`, [mine.order_id]).catch(() => null),
    )
    const row = await orderRow(t, mine.order_id)
    expect(row.payment_status).toBe('PENDING')
    expect(
      await errorOf(t.as('authenticated', customer, () => t.query(`delete from public.orders where id = $1`, [mine.order_id]))),
    ).toMatch(/permission denied/)
  })

  it('rate-limits order creation per customer', async () => {
    const busy = await t.createUser('busy.customer@example.com')
    for (let i = 0; i < 10; i++) await createOrder(t, busy)
    expect(await errorOf(createOrder(t, busy))).toBe('RATE_LIMITED')
  })
})

describe('customer cancellation', () => {
  beforeAll(async () => {
    customer = await t.createUser('orders.customer3@example.com', { full_name: 'Kojo Asante' })
  })

  it('lets a customer cancel their own unpaid order only', async () => {
    const order = await createOrder(t, customer)
    const stranger = await t.createUser('cancel.stranger@example.com')
    expect(
      await errorOf(t.as('authenticated', stranger, () => t.query('select public.customer_cancel_order($1)', [order.order_id]))),
    ).toBe('ORDER_NOT_FOUND')

    await t.as('authenticated', customer, () => t.query(`select public.customer_cancel_order($1, 'Changed my mind')`, [order.order_id]))
    const row = await orderRow(t, order.order_id)
    expect(row.order_status).toBe('CANCELLED')
    expect(row.cancellation_reason).toBe('Changed my mind')
    expect(
      await errorOf(t.as('authenticated', customer, () => t.query('select public.customer_cancel_order($1)', [order.order_id]))),
    ).toBe('ORDER_NOT_CANCELLABLE')
  })
})
