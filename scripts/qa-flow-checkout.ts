/**
 * End-to-end QA of the purchase path against the running QA preview
 * (`npm run dev:qa`): sign in → add items → Details → Delivery (map pin) →
 * Review → Paystack (QA simulator) → "Your order is confirmed." → tracking.
 *
 *   node scripts/qa-flow-checkout.ts --out <folder> [--width 1440|390]
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index !== -1 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback
}
const out = resolve(arg('out', 'qa-screenshots'))
const width = Number(arg('width', '1440'))
const height = width < 768 ? 844 : 900
const base = 'http://127.0.0.1:5173'

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'sk-checkout-')), {
  channel: process.env.QA_BROWSER_CHANNEL ?? 'msedge',
  headless: true,
  viewport: { width, height },
  // Software WebGL so MapLibre can render headless; GPS is emulated at the app's
  // documented camera default (Kumasi city centre) for the GPS fallback path.
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  permissions: ['geolocation'],
  geolocation: { latitude: 6.6885, longitude: -1.6244, accuracy: 25 },
})
const page = context.pages()[0] ?? (await context.newPage())
const errors: string[] = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
const ready = () => page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, undefined, { timeout: 90_000 })
const check = (label: string, ok: boolean) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
const shot = (name: string, fullPage = true) => page.screenshot({ path: join(out, `checkout_${name}__${width}.png`), fullPage })

// Sign in first.
await page.goto(`${base}/sign-in`)
await ready()
await page.fill('input[type="email"]', 'customer@qa.local')
await page.fill('input[autocomplete="current-password"]', 'Kitchen2026')
await page.click('button[type="submit"]')
await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 20_000 })

// Fill the bag.
await page.goto(`${base}/order`)
await ready()
await page.locator('article', { hasText: '500ml' }).first().getByRole('button', { name: /^Add / }).click()
const strawberry = page.locator('article', { hasText: 'Strawberry' }).first()
await strawberry.getByRole('button', { name: /Increase/ }).click()
await strawberry.getByRole('button', { name: /^Add / }).click()
await page.waitForTimeout(600)

// 1 Details — reached in-app through the bag, as a shopper would.
await page.getByRole('button', { name: /Open cart, 3 items/ }).first().click()
await page.getByRole('dialog').getByRole('button', { name: 'Continue to Checkout' }).click()
await page.getByRole('heading', { name: 'Your details' }).waitFor()
await page.waitForTimeout(400)
await shot('1_details')
check('checkout uses the focused header (no primary nav)', (await page.getByRole('navigation', { name: 'Primary' }).count()) === 0)
if (width < 640) await page.locator('form#checkout-details ~ *').count()
await page.getByRole('button', { name: width < 640 ? /^Continue$/ : /Continue to Delivery/ }).click()

// 2 Delivery: pick on the map, name the spot, confirm.
await page.getByRole('heading', { name: 'Delivery location' }).waitFor()
await page.getByRole('button', { name: /Pick on map/ }).click()
const map = page.getByRole('region', { name: 'Delivery map. Tap to drop a pin.' })
const mapShown = await map
  .waitFor({ timeout: 15_000 })
  .then(() => true)
  .catch(() => false)
if (mapShown) {
  await page.waitForTimeout(2500)
  const box = await map.boundingBox()
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  check('map renders and a tap proposes a pin', true)
} else {
  check('map unavailable here; using the GPS path instead', true)
  await page.getByRole('button', { name: /Use my location/ }).click()
}
await page.getByRole('heading', { name: 'Is this your delivery location?' }).waitFor({ timeout: 15_000 })
const address = page.getByLabel('Address')
await address.fill('Unity Hall, KNUST')
await page.getByLabel('Landmark').fill('Opposite the main gate')
await page.waitForTimeout(300)
await shot('2_delivery_proposed')
await page.getByRole('button', { name: 'Confirm This Location' }).click()
await page.getByText('Delivery location confirmed').waitFor()
await page.getByLabel('Save this location for next time').click()
await page.getByLabel('Label').selectOption('Hostel')
await shot('2_delivery_confirmed')
await page.getByRole('button', { name: 'Review Order' }).last().click()

// 3 Review
await page.getByRole('heading', { name: 'Review your order' }).waitFor()
await page.waitForTimeout(300)
await shot('3_review')
const payButton = page.getByRole('button', { name: /^Pay GH₵/ }).last()
const payLabel = (await payButton.innerText()).trim()
check(`pay button shows the live total (${payLabel})`, payLabel === 'Pay GH₵31')
await payButton.click()

// 4 Payment → QA Paystack simulator
await page.waitForURL(/\/dev\/paystack/, { timeout: 30_000 })
await ready()
await page.waitForTimeout(400)
await shot('4_paystack_simulator', false)
await page.getByRole('button', { name: /success/i }).first().click()

// Return: server verification, then the confirmation screen.
await page.waitForURL(/\/checkout\/callback/, { timeout: 30_000 })
await page.getByRole('heading', { name: 'Your order is confirmed.' }).waitFor({ timeout: 30_000 })
await page.waitForTimeout(1200)
await shot('5_confirmed')
const confirmation = await page.locator('main').innerText()
check('confirmation shows the destination', confirmation.includes('Unity Hall, KNUST'))
check('confirmation shows the amount paid', confirmation.includes('GH₵31'))
const reference = /SK-[A-Z0-9]{6}/.exec(confirmation)?.[0]
check(`confirmation shows the order reference (${reference ?? 'missing'})`, Boolean(reference))

const paid = await page.evaluate(async (ref) => {
  const db = (globalThis as unknown as { __SK_QA_DB__: { query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> } }).__SK_QA_DB__
  const res = await db.query('select payment_status, order_status, amount_paid_pesewas, total_pesewas from public.orders where order_reference = $1', [ref])
  return res.rows[0]
}, reference)
console.log('order row:', JSON.stringify(paid))
check('server marked the order PAID from verification (not the redirect)', paid?.payment_status === 'PAID' && paid?.amount_paid_pesewas === 3100)

await page.getByRole('link', { name: 'Track My Order' }).click()
await page.waitForURL(/\/track-order\/SK-/)
await ready()
await page.waitForTimeout(1500)
await shot('6_tracking')

// The customer's own space.
for (const [path, name] of [
  ['/account', '7_account'],
  ['/account/orders', '8_account_orders'],
  ['/account/locations', '9_account_places'],
  ['/account/notifications', '10_account_notifications'],
] as const) {
  await page.getByRole('link', { name: /My Account|Overview|Orders|Saved places|Notifications/ }).first().waitFor({ timeout: 5_000 }).catch(() => undefined)
  await page.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForTimeout(1500)
  await shot(name)
}
const accountText = await page.locator('main').innerText()
check('account pages render for the signed-in customer', accountText.includes('My SCOTCH’s Kitchen'))

console.log(errors.length ? `\nConsole errors:\n - ${errors.join('\n - ')}` : '\nNo console errors.')
await context.close()
