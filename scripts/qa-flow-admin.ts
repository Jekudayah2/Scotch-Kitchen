/**
 * End-to-end QA of the admin operations HQ against the QA preview.
 *   node scripts/qa-flow-admin.ts --out <folder> [--width 1440|390]
 *
 * A customer pays for an order; the admin then prepares it, puts a rider on
 * duty, assigns them, adds a delivery balance and marks it ready. Every admin
 * page is captured along the way.
 */
import { join, resolve } from 'node:path'
import { BASE, check, go, launch, placePaidOrder, ready, signIn, signOut, sql } from './qa-helpers.ts'

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index !== -1 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback
}
const out = resolve(arg('out', 'qa-screenshots'))
const width = Number(arg('width', '1440'))
const { context, page, errors } = await launch(width)
const overflowed: string[] = []
const shot = async (name: string, fullPage = true) => {
  await page.screenshot({ path: join(out, `admin_${name}__${width}.png`), fullPage })
  // Nothing may scroll sideways: not the page, and not an open drawer.
  const wide = await page.evaluate(() => {
    const panes = [document.documentElement, ...document.querySelectorAll<HTMLElement>('[role="dialog"] .overflow-y-auto')]
    return panes.map((el) => el.scrollWidth - el.clientWidth).filter((d) => d > 1)
  })
  if (wide.length) overflowed.push(`${name}: ${wide.join(', ')}px`)
}

// A real paid order to work with.
await signIn(page, 'customer@qa.local', '/order')
const reference = await placePaidOrder(page)
console.log('order placed:', reference)
await signOut(page)

await signIn(page, 'admin@qa.local', '/admin')
await page.waitForURL(/\/admin/)
await ready(page)
await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor({ timeout: 20_000 })
await page.waitForTimeout(1200)
await shot('1_overview')
check('overview lists the new paid order', (await page.locator('main').innerText()).includes(reference))

// Put the QA rider on duty so they can be assigned.
await go(page, '/admin/riders')
await page.getByRole('heading', { name: 'Riders' }).waitFor()
const riderCard = page.locator('li', { hasText: 'Kofi Asare' })
await riderCard.getByRole('radio', { name: 'Available' }).click()
await page.waitForTimeout(800)
await shot('2_riders')

// Work the order.
await go(page, '/admin/orders')
await page.getByRole('heading', { name: 'Orders' }).waitFor()
await page.waitForTimeout(800)
await shot('3_orders')
await page.getByRole('button', { name: `Open order ${reference}` }).first().click()
const drawer = page.getByRole('dialog')
await drawer.getByRole('button', { name: 'Start preparing' }).click()
await drawer.getByRole('button', { name: 'Mark ready' }).waitFor({ timeout: 10_000 })
await drawer.getByLabel('Choose a rider').selectOption({ label: 'Kofi Asare · Available' })
await drawer.getByRole('button', { name: 'Assign' }).click()
await page.waitForTimeout(1200)
await drawer.getByLabel('Amount in cedis').fill('5')
await drawer.getByLabel('Note (optional)').fill('Across campus')
await drawer.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(1200)
await drawer.getByRole('button', { name: 'Mark ready' }).click()
await page.waitForTimeout(1500)
await shot('4_order_drawer')
const [row] = await sql<{ order_status: string; delivery_balance_pesewas: number; rider: string | null }>(
  page,
  `select o.order_status, o.delivery_balance_pesewas, p.full_name as rider
     from public.orders o left join public.profiles p on p.id = o.assigned_rider_id where o.order_reference = $1`,
  [reference],
)
console.log('order row:', JSON.stringify(row))
check('order is ASSIGNED to Kofi with a GH₵5 delivery balance', row?.order_status === 'ASSIGNED' && row.rider === 'Kofi Asare' && row.delivery_balance_pesewas === 500)
const [audit] = await sql<{ n: number }>(page, `select count(*)::int as n from public.audit_logs where summary like $1`, [`${reference}%`])
check('each admin action was written to the audit log', (audit?.n ?? 0) >= 3)
await page.keyboard.press('Escape')

for (const [path, name] of [
  ['/admin/deliveries', '5_deliveries'],
  ['/admin/products', '6_products'],
  ['/admin/customers', '7_customers'],
  ['/admin/payments', '8_payments'],
  ['/admin/analytics', '9_analytics'],
  ['/admin/settings?tab=store', '10_settings_store'],
  ['/admin/settings?tab=team', '11_settings_team'],
  ['/admin/settings?tab=data', '12_settings_data'],
  ['/admin/settings?tab=audit', '13_settings_audit'],
] as const) {
  await go(page, path)
  await page.waitForTimeout(1600)
  await shot(name)
}

// Non-admins are turned away by the guard (and by RLS underneath).
await signOut(page)
await signIn(page, 'customer@qa.local', '/admin')
await page.goto(`${BASE}/admin`)
await ready(page)
await page.waitForTimeout(1200)
check('a customer sees "No access" at /admin', (await page.locator('body').innerText()).includes('No access'))

check(`no horizontal overflow${overflowed.length ? ` (${overflowed.join('; ')})` : ''}`, overflowed.length === 0)
console.log(errors.length ? `\nConsole errors:\n - ${[...new Set(errors)].join('\n - ')}` : '\nNo console errors.')
await context.close()
