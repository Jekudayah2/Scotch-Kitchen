/**
 * Rasterises the logo mark into PNG icons, using the installed Microsoft Edge
 * through playwright-core (no browser download).
 *
 *   public/favicon-32.png         transparent, for browsers without SVG favicons
 *   public/apple-touch-icon.png   180×180; iOS requires an opaque tile, so the
 *                                 gold mark sits on the brand's deep wine
 *
 * Run after scripts/build-logo.ts: node scripts/rasterize-icons.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const mark = readFileSync(join(root, 'public', 'brand', 'scotchs-kitchen-mark.svg'), 'utf8')
const [, , , w, h] = /viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/.exec(mark)!.map(Number) as number[]

const targets = [
  { file: 'favicon-32.png', size: 32, inset: 0, background: null },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.17, background: '#2a0a10' },
] as const

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 })
    const height = t.size * (1 - 2 * t.inset)
    const width = (height * w!) / h!
    const svg = mark.replace('<svg ', `<svg width="${width}" height="${height}" `)
    await page.setContent(
      `<html><body style="margin:0;background:${t.background ?? 'transparent'}"><div style="width:${t.size}px;height:${t.size}px;display:grid;place-items:center">${svg}</div></body></html>`,
    )
    await page.screenshot({ path: join(root, 'public', t.file), omitBackground: t.background === null })
    await page.close()
    console.log(`public/${t.file}`)
  }
} finally {
  await browser.close()
}
