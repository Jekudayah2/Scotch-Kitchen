/**
 * Shared steps for the QA preview flows (`npm run dev:qa` must be running).
 * Everything happens in one browser profile because the in-browser QA
 * database lives in that profile's IndexedDB.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright-core'

export const BASE = 'http://127.0.0.1:5173'
export const QA_PASSWORD = 'Kitchen2026'

export async function launch(width = 1440) {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'sk-qa-')), {
    channel: process.env.QA_BROWSER_CHANNEL ?? 'msedge',
    headless: true,
    viewport: { width, height: width < 768 ? 844 : 900 },
    // Software WebGL so MapLibre renders headless.
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  const page = context.pages()[0] ?? (await context.newPage())
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return { context, page, errors }
}

export const ready = (page: Page) =>
  page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, undefined, { timeout: 90_000 })

export const check = (label: string, ok: boolean) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)

/** Client-side navigation (no reload), so the QA database never loses an unflushed write. */
export async function go(page: Page, path: string) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForTimeout(900)
}

export async function signIn(page: Page, email: string, next = '/') {
  // A full navigation follows; give the QA database a moment to flush earlier writes.
  if (page.url().startsWith(BASE)) await page.waitForTimeout(1500)
  await page.goto(`${BASE}/sign-in?next=${encodeURIComponent(next)}`)
  await ready(page)
  await page.fill('input[type="email"]', email)
  await page.fill('input[autocomplete="current-password"]', QA_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 20_000 })
  await page.waitForTimeout(800)
}

export async function sql<T = Record<string, unknown>>(page: Page, query: string, params: unknown[] = []) {
  return page.evaluate(
    async ([q, p]) => {
      const db = (globalThis as unknown as { __SK_QA_DB__: { query: (s: string, v: unknown[]) => Promise<{ rows: unknown[] }> } }).__SK_QA_DB__
      return (await db.query(q as string, p as unknown[])).rows
    },
    [query, params] as const,
  ) as Promise<T[]>
}

/** As the signed-in customer: bag → checkout → map pin → pay with the QA Paystack simulator. */
export async function placePaidOrder(page: Page) {
  await go(page, '/order')
  await page.locator('article', { hasText: '500ml' }).first().getByRole('button', { name: /^Add / }).click()
  await page.locator('article', { hasText: 'Vanilla' }).first().getByRole('button', { name: /^Add / }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Open cart, \d+ items?/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Continue to Checkout' }).click()
  await page.getByRole('heading', { name: 'Your details' }).waitFor()
  await page.getByRole('button', { name: /Continue to Delivery|^Continue$/ }).first().click()
  await page.getByRole('heading', { name: 'Delivery location' }).waitFor()
  await page.getByRole('button', { name: /Pick on map/ }).click()
  const map = page.getByRole('region', { name: 'Delivery map. Tap to drop a pin.' })
  await map.waitFor({ timeout: 20_000 })
  await page.waitForTimeout(2500)
  const box = await map.boundingBox()
  if (!box) throw new Error('map not visible')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.getByRole('heading', { name: 'Is this your delivery location?' }).waitFor({ timeout: 15_000 })
  await page.getByLabel('Address').fill('Unity Hall, KNUST')
  await page.getByLabel('Landmark').fill('Opposite the main gate')
  await page.getByRole('button', { name: 'Confirm This Location' }).click()
  await page.getByText('Delivery location confirmed').waitFor()
  await page.getByRole('button', { name: 'Review Order' }).last().click()
  await page.getByRole('heading', { name: 'Review your order' }).waitFor()
  await page.getByRole('button', { name: /^Pay GH₵/ }).last().click()
  await page.waitForURL(/\/dev\/paystack/, { timeout: 30_000 })
  await ready(page)
  await page.getByRole('button', { name: /success/i }).first().click()
  await page.getByRole('heading', { name: 'Your order is confirmed.' }).waitFor({ timeout: 30_000 })
  const text = await page.locator('main').innerText()
  const reference = /SK-[A-Z0-9]{6}/.exec(text)?.[0]
  if (!reference) throw new Error('no order reference on the confirmation screen')
  return reference
}

export async function signOut(page: Page) {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.includes('auth')) localStorage.removeItem(key)
  })
}
