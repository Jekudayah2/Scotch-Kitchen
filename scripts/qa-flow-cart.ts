/**
 * Interactive QA of the cart against the running QA preview (`npm run dev:qa`).
 * Uses a fresh browser profile so it starts as a signed-out guest.
 *   node scripts/qa-flow-cart.ts --out <folder>
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const outIndex = process.argv.indexOf('--out')
const out = resolve(outIndex !== -1 ? (process.argv[outIndex + 1] as string) : 'qa-screenshots')
const base = 'http://127.0.0.1:5173'
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'sk-cart-')), {
  channel: process.env.QA_BROWSER_CHANNEL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
})
const page = context.pages()[0] ?? (await context.newPage())
const errors: string[] = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
const ready = () => page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, undefined, { timeout: 90_000 })
const check = (label: string, ok: boolean) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)

await page.goto(`${base}/order`)
await ready()
await page.getByRole('heading', { name: /Order/ }).first().waitFor()
const zobopop500 = page.locator('article', { hasText: '500ml' }).first()
await zobopop500.getByRole('button', { name: /Increase/ }).click()
await zobopop500.getByRole('button', { name: /^Add / }).click()
const vanilla = page.locator('article', { hasText: 'Vanilla' }).first()
await vanilla.getByRole('button', { name: /^Add / }).click()
await page.waitForTimeout(400)
const sidebar = await page.locator('aside[aria-label="Your order"]').innerText()
check('sidebar shows 3 items totalling GH₵38', /3 items/.test(sidebar) && sidebar.includes('GH₵38'))
await page.screenshot({ path: join(out, 'flow_cart_order_sidebar.png') })

await page.getByRole('button', { name: /Open cart, 3 items/ }).click()
await page.getByRole('dialog').waitFor()
await page.waitForTimeout(400)
await page.screenshot({ path: join(out, 'flow_cart_drawer.png') })
const drawer = await page.getByRole('dialog').innerText()
check('drawer lists ZOBOPOP 500ml and Creamypop Vanilla', drawer.includes('ZOBOPOP 500ml') && drawer.includes('Creamypop Vanilla'))
await page.keyboard.press('Escape')

// Guest cart survives a reload.
await page.reload()
await ready()
await page.waitForTimeout(800)
check('guest cart persists across reloads', (await page.getByRole('button', { name: /Open cart, 3 items/ }).count()) === 1)

// Quantity can never exceed the store limit.
await page.goto(`${base}/cart`)
await ready()
await page.waitForTimeout(800)
const qty = page.getByRole('spinbutton', { name: /Quantity of ZOBOPOP 500ml/ })
await qty.fill('999')
await page.waitForTimeout(300)
check('quantity input clamps to the maximum (20)', (await qty.inputValue()) === '20')
await qty.fill('2')
await page.waitForTimeout(300)
await page.screenshot({ path: join(out, 'flow_cart_page.png'), fullPage: true })

// Checkout requires sign-in; the guest cart merges into the account.
await page.getByRole('button', { name: /Sign in to check out/i }).click()
await page.waitForURL(/\/sign-in/)
check('checkout redirects guests to sign-in with a return path', page.url().includes('next=%2Fcheckout'))
await page.fill('input[type="email"]', 'customer@qa.local')
await page.fill('input[autocomplete="current-password"]', 'Kitchen2026')
await page.click('button[type="submit"]')
await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 20_000 })
// Read the account cart in place: the QA database persists to IndexedDB asynchronously,
// so reloading before it flushes could drop the newest write (a harness artefact).
const readServerCart = () =>
  page.evaluate(async () => {
    const db = (globalThis as unknown as { __SK_QA_DB__: { query: (sql: string) => Promise<{ rows: unknown[] }> } }).__SK_QA_DB__
    const res = await db.query(`select v.sku, c.quantity from public.cart_items c join public.product_variants v on v.id = c.variant_id order by v.sku`)
    return res.rows
  })
let serverCart: unknown[] = []
for (let i = 0; i < 25 && serverCart.length < 2; i++) {
  await page.waitForTimeout(200)
  serverCart = await readServerCart()
}
console.log('server cart rows:', JSON.stringify(serverCart))
check('guest cart merged into the account cart', JSON.stringify(serverCart) === JSON.stringify([{ sku: 'CP-VAN-200', quantity: 1 }, { sku: 'ZP-500', quantity: 2 }]))
check('local guest cart cleared after merge', (await page.evaluate(() => localStorage.getItem('sk-cart-v1'))) === null)

console.log(errors.length ? `\nConsole errors:\n - ${errors.join('\n - ')}` : '\nNo console errors.')
await context.close()
