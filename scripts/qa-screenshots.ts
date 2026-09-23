/**
 * Visual QA helper: screenshots routes of the running QA preview (`npm run dev:qa`)
 * at several widths and colour schemes using the locally installed Microsoft Edge
 * (or Chrome) through playwright-core. No browser download is needed.
 *
 *   node scripts/qa-screenshots.ts --routes /,/order --widths 1440,390 --schemes light,dark
 *   node scripts/qa-screenshots.ts --routes /account --login customer@qa.local
 *
 * Options:
 *   --base     App URL (default http://127.0.0.1:5173)
 *   --routes   Comma-separated paths
 *   --widths   Comma-separated viewport widths (default 1440,390)
 *   --schemes  light,dark (default light)
 *   --login    QA account email to sign in with first (password Kitchen2026)
 *   --out      Output folder (default ./qa-screenshots)
 *   --full     Capture the full page (default true; pass --full false for viewport only)
 *   --profile  Browser profile folder, so the in-browser QA database persists
 */
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index !== -1 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback
}

const base = arg('base', 'http://127.0.0.1:5173').replace(/\/$/, '')
const routes = arg('routes', '/').split(',').filter(Boolean)
const widths = arg('widths', '1440,390').split(',').map(Number)
const schemes = arg('schemes', 'light').split(',') as Array<'light' | 'dark'>
const login = arg('login', '')
const out = resolve(arg('out', 'qa-screenshots'))
const full = arg('full', 'true') !== 'false'
const profile = resolve(arg('profile', join(out, '.profile')))
const heights: Record<number, number> = { 1920: 1080, 1440: 900, 1280: 800, 1024: 768, 768: 1024, 430: 932, 412: 915, 390: 844, 375: 812, 360: 780 }

mkdirSync(out, { recursive: true })

const context = await chromium.launchPersistentContext(profile, {
  channel: process.env.QA_BROWSER_CHANNEL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = context.pages()[0] ?? (await context.newPage())
const problems: string[] = []
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`[console] ${message.text()}`)
})
page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`))

async function settle() {
  // The first visit builds the in-browser database before React mounts.
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, undefined, { timeout: 90_000 })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  // Wait for skeletons/spinners to resolve.
  await page
    .waitForFunction(() => !document.querySelector('.animate-pulse, [role="status"]'), undefined, { timeout: 15_000 })
    .catch(() => undefined)
  // Scroll through at reading pace so lazy images load and scroll reveals play
  // (a reveal only starts once its section has actually been on screen).
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.55)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 160))
    }
    await new Promise((r) => setTimeout(r, 500))
    // Anything still waiting for its reveal (e.g. it mounted after we scrolled past) gets visited directly.
    for (let pass = 0; pass < 3; pass++) {
      const hidden = [...document.querySelectorAll<HTMLElement>('[style*="opacity: 0"]')]
      if (hidden.length === 0) break
      for (const el of hidden) {
        el.scrollIntoView({ block: 'center' })
        await new Promise((r) => setTimeout(r, 120))
      }
      await new Promise((r) => setTimeout(r, 700))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(700)
}

if (login) {
  await page.goto(`${base}/sign-in`)
  await settle()
  if (await page.locator('input[type="email"]').count()) {
    await page.fill('input[type="email"]', login)
    await page.fill('input[autocomplete="current-password"]', 'Kitchen2026')
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 20_000 })
  }
}

for (const scheme of schemes) {
  await page.emulateMedia({ colorScheme: scheme })
  for (const width of widths) {
    await page.setViewportSize({ width, height: heights[width] ?? 900 })
    for (const route of routes) {
      await page.goto(`${base}${route}`)
      await settle()
      const name = `${route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]+/g, '_')}__${width}__${scheme}.png`
      await page.screenshot({ path: join(out, name), fullPage: full })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (overflow > 1) problems.push(`[overflow] ${route} @${width}px scrolls horizontally by ${overflow}px`)
      console.log(`saved ${name}`)
    }
  }
}

await context.close()
if (problems.length) {
  console.log('\nProblems:')
  for (const p of [...new Set(problems)]) console.log(` - ${p}`)
} else {
  console.log('\nNo console errors, page errors or horizontal overflow detected.')
}
