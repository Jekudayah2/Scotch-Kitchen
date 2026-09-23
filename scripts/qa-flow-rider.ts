/**
 * End-to-end QA of the rider app against the QA preview.
 *   node scripts/qa-flow-rider.ts --out <folder> [--width 390]
 *
 * Customer pays → rider goes Available → admin prepares, assigns and marks
 * ready with a delivery balance → rider starts, collects and delivers →
 * the customer's order page shows Delivered.
 */
import { join, resolve } from 'node:path'
import { check, go, launch, placePaidOrder, ready, signIn, signOut, sql } from './qa-helpers.ts'

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index !== -1 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback
}
const out = resolve(arg('out', 'qa-screenshots'))
const width = Number(arg('width', '390'))
const { context, page, errors } = await launch(width)
const overflowed: string[] = []
const shot = async (name: string, fullPage = true) => {
  await page.screenshot({ path: join(out, `rider_${name}__${width}.png`), fullPage })
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (wide > 1) overflowed.push(`${name}: ${wide}px`)
}

await signIn(page, 'customer@qa.local', '/order')
const reference = await placePaidOrder(page)
console.log('order placed:', reference)
await signOut(page)

// The rider comes on duty.
await signIn(page, 'rider@qa.local', '/rider')
await page.waitForURL(/\/rider/)
await ready(page)
await page.getByRole('heading', { name: /^Hi/ }).waitFor({ timeout: 20_000 })
await page.getByRole('radio', { name: 'Available' }).click()
await page.waitForTimeout(1000)
await shot('1_home_empty')
await signOut(page)

// The kitchen prepares, assigns and adds a delivery balance.
await signIn(page, 'admin@qa.local', '/admin/orders')
await page.getByRole('button', { name: `Open order ${reference}` }).first().click()
const drawer = page.getByRole('dialog')
await drawer.getByRole('button', { name: 'Start preparing' }).click()
await drawer.getByRole('button', { name: 'Mark ready' }).waitFor({ timeout: 10_000 })
await drawer.getByLabel('Choose a rider').selectOption({ label: 'Kofi Asare · Available' })
await drawer.getByRole('button', { name: 'Assign' }).click()
await page.waitForTimeout(1200)
await drawer.getByLabel('Amount in cedis').fill('5')
await drawer.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(1200)
await drawer.getByRole('button', { name: 'Mark ready' }).click()
await page.waitForTimeout(1500)
await signOut(page)

// On the road.
await signIn(page, 'rider@qa.local', '/rider')
await page.getByRole('heading', { name: 'Up next' }).waitFor({ timeout: 20_000 })
await page.waitForTimeout(800)
await shot('2_home_assigned')
await page.getByRole('button', { name: 'Picked up: start delivery' }).first().click()
await page.getByRole('heading', { name: 'On the way now' }).waitFor({ timeout: 15_000 })
await page.waitForTimeout(800)
await shot('3_home_on_the_way')

const [row] = await sql<{ id: string }>(page, 'select id from public.orders where order_reference = $1', [reference])
await go(page, `/rider/deliveries/${row?.id}`)
await page.getByRole('heading', { name: reference }).waitFor({ timeout: 15_000 })
await page.waitForTimeout(2500)
await shot('4_delivery_detail')
await page.getByRole('button', { name: 'Collected GH₵5 balance' }).click()
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Mark delivered' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Yes, delivered' }).click()
await page.waitForTimeout(1500)

const [done] = await sql<{ order_status: string; delivery_balance_collected_at: string | null; delivered_at: string | null }>(
  page,
  'select order_status, delivery_balance_collected_at, delivered_at from public.orders where order_reference = $1',
  [reference],
)
console.log('order row:', JSON.stringify(done))
check('rider delivered the order and collected the balance', done?.order_status === 'DELIVERED' && Boolean(done.delivery_balance_collected_at) && Boolean(done.delivered_at))

await go(page, '/rider/history')
await page.waitForTimeout(1500)
await shot('5_history')
check('history lists the delivery', (await page.locator('main').innerText()).includes(reference))
await go(page, '/rider/map')
await page.waitForTimeout(2500)
await shot('6_map', false)
await go(page, '/rider/account')
await page.waitForTimeout(800)
await shot('7_account')

// The customer sees it delivered.
await signOut(page)
await signIn(page, 'customer@qa.local', `/track-order/${reference}`)
await page.waitForTimeout(2000)
const tracking = await page.locator('main').innerText()
check('customer tracking shows Delivered', /Delivered/.test(tracking))

// A plain customer is kept out of the rider app.
await go(page, '/rider')
await page.waitForTimeout(1200)
check('a customer sees "No access" at /rider', (await page.locator('body').innerText()).includes('No access'))

check(`no horizontal overflow${overflowed.length ? ` (${overflowed.join('; ')})` : ''}`, overflowed.length === 0)
console.log(errors.length ? `\nConsole errors:\n - ${[...new Set(errors)].join('\n - ')}` : '\nNo console errors.')
await context.close()
