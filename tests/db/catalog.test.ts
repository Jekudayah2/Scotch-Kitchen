import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness.ts'
import { VARIANTS } from './fixtures.ts'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})
afterAll(async () => {
  await t.close()
})

describe('seeded catalog', () => {
  it('contains exactly the four legitimate variants at their real prices', async () => {
    const rows = await t.as('anon', null, () =>
      t.query<{ brand: string; product: string; variant: string; size_label: string; flavour: string | null; price_pesewas: number }>(`
        select b.name as brand, p.name as product, v.name as variant, v.size_label, v.flavour, v.price_pesewas
        from public.product_variants v
        join public.products p on p.id = v.product_id
        join public.brands b on b.id = p.brand_id
        order by b.sort_order, v.sort_order`),
    )
    expect(rows).toEqual([
      { brand: 'ZOBOPOP', product: 'ZOBOPOP', variant: '330ml', size_label: '330ml', flavour: null, price_pesewas: 1000 },
      { brand: 'ZOBOPOP', product: 'ZOBOPOP', variant: '500ml', size_label: '500ml', flavour: null, price_pesewas: 1500 },
      { brand: 'Creamypop', product: 'Creamypop Ice Cream', variant: 'Vanilla', size_label: '200ml', flavour: 'Vanilla', price_pesewas: 800 },
      { brand: 'Creamypop', product: 'Creamypop Ice Cream', variant: 'Strawberry', size_label: '200ml', flavour: 'Strawberry', price_pesewas: 800 },
    ])
  })

  it('stores ZOBOPOP ingredients as one recipe, not as selectable flavours', async () => {
    const ingredients = await t.as('anon', null, () =>
      t.query<{ name: string; ingredient_group: string }>(`
        select i.name, i.ingredient_group from public.product_ingredients i
        join public.products p on p.id = i.product_id
        where p.slug = 'zobopop-hibiscus-drink'
        order by i.ingredient_group, i.sort_order`),
    )
    expect(ingredients).toEqual([
      { name: 'Hibiscus', ingredient_group: 'BASE' },
      { name: 'Mango', ingredient_group: 'FRUIT' },
      { name: 'Lemon', ingredient_group: 'FRUIT' },
      { name: 'Pineapple', ingredient_group: 'FRUIT' },
      { name: 'Cloves', ingredient_group: 'SPICE' },
      { name: 'Ginger', ingredient_group: 'SPICE' },
      { name: 'Cinnamon', ingredient_group: 'SPICE' },
      { name: 'Mint', ingredient_group: 'SPICE' },
    ])
    const zobopopFlavours = await t.query<{ n: number }>(
      `select count(*)::int as n from public.product_variants where product_id = 'c1000000-0000-4000-8000-000000000001' and flavour is not null`,
    )
    expect(zobopopFlavours[0]?.n).toBe(0)
  })

  it('seeds no orders, customers, riders or payments', async () => {
    const counts = await t.one<Record<string, number>>(`
      select (select count(*)::int from public.orders) as orders,
             (select count(*)::int from public.payments) as payments,
             (select count(*)::int from public.profiles) as profiles,
             (select count(*)::int from public.user_roles) as roles`)
    expect(counts).toEqual({ orders: 0, payments: 0, profiles: 0, roles: 0 })
  })
})

describe('catalog visibility and admin control', () => {
  it('hides invisible variants from the storefront but not from admins', async () => {
    const admin = await t.createUser('catalog.admin@example.com')
    await t.grantRole(admin, 'ADMIN')

    await t.as('authenticated', admin, () =>
      t.query('update public.product_variants set is_visible = false where id = $1', [VARIANTS.ZOBOPOP_330]),
    )
    const publicIds = await t.as('anon', null, () => t.query<{ id: string }>('select id from public.product_variants'))
    expect(publicIds.map((r) => r.id)).not.toContain(VARIANTS.ZOBOPOP_330)
    const adminIds = await t.as('authenticated', admin, () => t.query<{ id: string }>('select id from public.product_variants'))
    expect(adminIds.map((r) => r.id)).toContain(VARIANTS.ZOBOPOP_330)

    await t.as('authenticated', admin, () =>
      t.query('update public.product_variants set is_visible = true where id = $1', [VARIANTS.ZOBOPOP_330]),
    )
  })

  it('hides a whole product when its brand is hidden', async () => {
    const admin = await t.createUser('brand.admin@example.com')
    await t.grantRole(admin, 'ADMIN')
    await t.as('authenticated', admin, () => t.query(`update public.brands set is_visible = false where slug = 'creamypop'`))
    const variants = await t.as('anon', null, () => t.query<{ sku: string }>('select sku from public.product_variants order by sku'))
    expect(variants.map((v) => v.sku)).toEqual(['ZP-330', 'ZP-500'])
    await t.as('authenticated', admin, () => t.query(`update public.brands set is_visible = true where slug = 'creamypop'`))
  })

  it('lets only admins change prices, and audits the change', async () => {
    const customer = await t.createUser('price.customer@example.com')
    const admin = await t.createUser('price.admin@example.com')
    await t.grantRole(admin, 'ADMIN')

    await t.as('authenticated', customer, () =>
      t.query('update public.product_variants set price_pesewas = 1 where id = $1', [VARIANTS.ZOBOPOP_500]),
    )
    const unchanged = await t.one<{ price_pesewas: number }>('select price_pesewas from public.product_variants where id = $1', [VARIANTS.ZOBOPOP_500])
    expect(unchanged.price_pesewas).toBe(1500)
    expect(
      await errorOf(t.as('anon', null, () => t.query('update public.product_variants set price_pesewas = 1'))),
    ).toMatch(/permission denied/)

    await t.as('authenticated', admin, () =>
      t.query('update public.product_variants set price_pesewas = 1600 where id = $1', [VARIANTS.ZOBOPOP_500]),
    )
    const audit = await t.one<{ action: string; actor_role: string; metadata: { changes: { price_pesewas: { old: number; new: number } } } }>(
      `select action, actor_role, metadata from public.audit_logs
       where target_type = 'product_variant' and target_id = $1 and action = 'product_variant.updated'
       order by id desc limit 1`,
      [VARIANTS.ZOBOPOP_500],
    )
    expect(audit.actor_role).toBe('ADMIN')
    expect(audit.metadata.changes.price_pesewas).toEqual({ old: 1500, new: 1600 })

    await t.as('authenticated', admin, () =>
      t.query('update public.product_variants set price_pesewas = 1500 where id = $1', [VARIANTS.ZOBOPOP_500]),
    )
  })

  it('rejects non-positive prices at the database level', async () => {
    const admin = await t.createUser('price.guard@example.com')
    await t.grantRole(admin, 'ADMIN')
    expect(
      await errorOf(
        t.as('authenticated', admin, () =>
          t.query('update public.product_variants set price_pesewas = 0 where id = $1', [VARIANTS.ZOBOPOP_500]),
        ),
      ),
    ).toMatch(/check constraint/)
  })

  it('exposes store settings publicly but lets only admins change them', async () => {
    const settings = await t.as('anon', null, () =>
      t.one<{ delivery_fee_mode: string; accepting_orders: boolean }>('select delivery_fee_mode, accepting_orders from public.store_settings'),
    )
    expect(settings).toEqual({ delivery_fee_mode: 'QUOTE', accepting_orders: true })
    const customer = await t.createUser('settings.customer@example.com')
    await t.as('authenticated', customer, () => t.query('update public.store_settings set accepting_orders = false'))
    const still = await t.one<{ accepting_orders: boolean }>('select accepting_orders from public.store_settings')
    expect(still.accepting_orders).toBe(true)
  })
})
