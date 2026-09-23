/**
 * Builds the SCOTCH'S KITCHEN logo as transparent vector artwork.
 *
 * The owner's logo (gold serif "S" with a chef's hat and whisk above
 * "SCOTCHS — KITCHEN —" on a dark tile) was supplied as an image; this script
 * redraws it as clean vectors WITHOUT the dark tile or white surround:
 *   - letterforms come from Cinzel (SIL Open Font License), a classical Roman
 *     serif matching the logo lettering, converted to paths (no runtime font);
 *   - the hat and whisk are drawn as line art and knocked out of the "S"
 *     exactly where the original overlaps it.
 *
 * Outputs:
 *   src/components/brand/logo-art.ts          path data for inline, themeable SVG
 *   public/brand/scotchs-kitchen-logo.svg     stacked logo, gold, transparent
 *   public/brand/scotchs-kitchen-mark.svg     emblem only, gold, transparent
 *   public/favicon.svg                        emblem favicon (deeper gold on light tab bars)
 *
 * Run: node scripts/build-logo.ts   (then: node scripts/rasterize-icons.ts)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const fontDir = join(root, 'node_modules', '@fontsource', 'cinzel', 'files')
const load = (weight: number) => {
  const buffer = readFileSync(join(fontDir, `cinzel-latin-${weight}-normal.woff`))
  return opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
}
const fontBold = load(700)
const fontText = load(600)

const round = (n: number) => Math.round(n * 100) / 100

/** Serialises opentype path commands ourselves (opentype.js v2's toPathData can emit NaN). */
function toD(path: opentype.Path): string {
  const n = (v: number) => {
    if (!Number.isFinite(v)) throw new Error('Non-finite coordinate in glyph path')
    return String(round(v))
  }
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
          return `M${n(c.x)} ${n(c.y)}`
        case 'L':
          return `L${n(c.x)} ${n(c.y)}`
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
        case 'Z':
          return 'Z'
        default:
          return ''
      }
    })
    .join('')
}

// ---------------------------------------------------------------------------
// Letterforms
// ---------------------------------------------------------------------------
function glyphPath(font: opentype.Font, char: string, targetCapHeight: number) {
  const glyph = font.charToGlyph(char)
  const probe = glyph.getPath(0, 0, 1000)
  const box = probe.getBoundingBox()
  const scale = targetCapHeight / (box.y2 - box.y1)
  return { glyph, fontSize: 1000 * scale, box }
}

/** Big emblem "S": top-left of its ink box at (x, y), ink height h. */
function bigS(x: number, y: number, h: number) {
  const { glyph, fontSize } = glyphPath(fontBold, 'S', h)
  const at = glyph.getPath(0, 0, fontSize).getBoundingBox()
  const path = glyph.getPath(x - at.x1, y - at.y1, fontSize)
  return { d: toD(path), box: path.getBoundingBox() }
}

/** Tracked capitals centred on cx, sitting on `baseline`, with the given cap height. */
function trackedText(font: opentype.Font, text: string, cx: number, baseline: number, capHeight: number, tracking: number) {
  const capBox = font.charToGlyph('H').getPath(0, 0, 1000).getBoundingBox()
  const fontSize = (capHeight / (capBox.y2 - capBox.y1)) * 1000
  const scale = fontSize / font.unitsPerEm
  const glyphs = [...text].map((ch) => font.charToGlyph(ch))
  const widths = glyphs.map((g) => (g.advanceWidth ?? 0) * scale)
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (glyphs.length - 1)
  let x = cx - total / 2
  const parts: string[] = []
  glyphs.forEach((g, i) => {
    parts.push(toD(g.getPath(x, baseline, fontSize)))
    x += (widths[i] ?? 0) + tracking
  })
  return { d: parts.join(''), left: cx - total / 2, right: cx + total / 2 }
}

// ---------------------------------------------------------------------------
// Chef's hat (line art) — built upright, then rotated into place
// ---------------------------------------------------------------------------
type Pt = [number, number]
const rotate = ([x, y]: Pt, deg: number, [cx, cy]: Pt): Pt => {
  const r = (deg * Math.PI) / 180
  const dx = x - cx
  const dy = y - cy
  return [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)]
}

function circleIntersectionTop(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(a.r * a.r - l * l, 0))
  const mx = a.x + (l * dx) / d
  const my = a.y + (l * dy) / d
  const p1: Pt = [mx + (h * dy) / d, my - (h * dx) / d]
  const p2: Pt = [mx - (h * dy) / d, my + (h * dx) / d]
  return p1[1] < p2[1] ? p1 : p2
}

interface Box {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Large-arc flag for a clockwise (screen) arc from `a` to `b` around `c`. */
function largeArc(c: Pt, a: Pt, b: Pt) {
  const angle = (p: Pt) => Math.atan2(p[1] - c[1], p[0] - c[0])
  let delta = angle(b) - angle(a)
  while (delta < 0) delta += 2 * Math.PI
  return delta > Math.PI ? 1 : 0
}

/** A chef's toque: three-lobed puff, short straight band, two soft folds. Fitted into `target`. */
function hat(target: Box, tilt: number) {
  const lobes = [
    { x: -30, y: -22, r: 22 },
    { x: 0, y: -42, r: 27 },
    { x: 30, y: -22, r: 22 },
  ]
  const bandTopL: Pt = [-27, 0]
  const bandTopR: Pt = [27, 0]
  const bandBotL: Pt = [-27, 30]
  const bandBotR: Pt = [27, 30]
  const pivot: Pt = [0, 12]

  // Fit: rotate, measure, then scale + translate into the target box.
  const samples: Pt[] = [bandBotL, bandBotR, bandTopL, bandTopR, [0, 36]]
  for (const l of lobes) for (let a = 0; a < 360; a += 6) samples.push([l.x + l.r * Math.cos((a * Math.PI) / 180), l.y + l.r * Math.sin((a * Math.PI) / 180)])
  const rotated = samples.map((pt) => rotate(pt, tilt, pivot))
  const xs = rotated.map((pt) => pt[0])
  const ys = rotated.map((pt) => pt[1])
  const local = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }
  const scale = Math.min((target.x2 - target.x1) / (local.x2 - local.x1), (target.y2 - target.y1) / (local.y2 - local.y1))

  const T = (pt: Pt): Pt => {
    const [x, y] = rotate(pt, tilt, pivot)
    return [target.x1 + (x - local.x1) * scale, target.y1 + (y - local.y1) * scale]
  }
  const f = (pt: Pt) => `${round(T(pt)[0])} ${round(T(pt)[1])}`
  const R = (r: number) => round(r * scale)

  // Crown: walk the outer edge of the lobes, clockwise, from the band's left corner to its right.
  const first = lobes[0]!
  const last = lobes[lobes.length - 1]!
  const onCircle = (l: { x: number; y: number; r: number }, t: number): Pt => [l.x + l.r * Math.cos(t), l.y + l.r * Math.sin(t)]
  const start = onCircle(first, Math.PI - Math.asin(Math.min(1, (bandTopL[1] - first.y) / first.r)))
  const end = onCircle(last, Math.asin(Math.min(1, (bandTopR[1] - last.y) / last.r)))
  let crown = `M${f(bandTopL)} L${f(start)} `
  let from = start
  lobes.forEach((lobe, i) => {
    const next = lobes[i + 1]
    const to = next ? circleIntersectionTop(lobe, next) : end
    crown += `A${R(lobe.r)} ${R(lobe.r)} 0 ${largeArc([lobe.x, lobe.y], from, to)} 1 ${f(to)} `
    from = to
  })
  crown += `L${f(bandTopR)}`

  // Band: straight sides, a gently curved seam and hem.
  const band = `M${f(bandTopL)} L${f(bandBotL)} Q${f([0, 36])} ${f(bandBotR)} L${f(bandTopR)} Q${f([0, 6])} ${f(bandTopL)}Z`
  const folds = [`M${f([-10, 2])} Q${f([-14, -12])} ${f([-11, -27])}`, `M${f([10, 2])} Q${f([14, -12])} ${f([11, -27])}`]
  const outline = `${crown} ${band}`
  const silhouette = `${crown} L${f(bandBotR)} Q${f([0, 36])} ${f(bandBotL)} Z`
  const fitted = samples.map(T)
  const box = {
    x1: Math.min(...fitted.map((q) => q[0])),
    y1: Math.min(...fitted.map((q) => q[1])),
    x2: Math.max(...fitted.map((q) => q[0])),
    y2: Math.max(...fitted.map((q) => q[1])),
  }
  return { outline, pleats: folds, silhouette, box }
}

// ---------------------------------------------------------------------------
// Whisk — built upright (balloon up, handle down), then rotated into place
// ---------------------------------------------------------------------------
function whisk(junction: Pt, scale: number, angle: number) {
  const T = (p: Pt): Pt => {
    const [x, y] = rotate(p, angle, [0, 0])
    return [junction[0] + x * scale, junction[1] + y * scale]
  }
  const f = (p: Pt) => `${round(T(p)[0])} ${round(T(p)[1])}`
  const loop = (w: number) => `M${f([-3, 0])} C${f([-w, -52])} ${f([-w * 1.02, -126])} ${f([0, -148])} C${f([w * 1.02, -126])} ${f([w, -52])} ${f([3, 0])}`
  const wires = [loop(60), loop(44), loop(28), loop(12), `M${f([0, 0])} L${f([0, -148])}`]
  // Handle: capsule from the collar down to the end, with a hanging hole.
  const hw = 7.5
  const handle = `M${f([-hw, 10])} L${f([-hw * 0.9, 96])} A${round(hw * scale)} ${round(hw * scale)} 0 0 0 ${f([hw * 0.9, 96])} L${f([hw, 10])} Z`
  const collar = `M${f([-10, -4])} L${f([10, -4])} L${f([10, 12])} L${f([-10, 12])} Z`
  const hole: Pt = T([0, 90])
  const extent = [T([-62, -90]), T([62, -90]), T([0, -150]), T([-hw, 104]), T([hw, 104])]
  const box = {
    x1: Math.min(...extent.map((q) => q[0])),
    y1: Math.min(...extent.map((q) => q[1])),
    x2: Math.max(...extent.map((q) => q[0])),
    y2: Math.max(...extent.map((q) => q[1])),
  }
  return { wires, handle, collar, hole: { cx: round(hole[0]), cy: round(hole[1]), r: round(2.6 * scale) }, box }
}

// ---------------------------------------------------------------------------
// Compose (coordinates follow the proportions of the supplied logo)
// ---------------------------------------------------------------------------
const S = bigS(206, 95, 317)
const HAT = hat({ x1: 154, y1: 140, x2: 292, y2: 276 }, -22)
const WHISK = whisk([304, 354], 0.74, 45)
const WORD_BASELINE = 490
const WORD_CAP = 52
const SUB_BASELINE = 533
const SUB_CAP = 19
const WORD = trackedText(fontText, 'SCOTCHS', 330, WORD_BASELINE, WORD_CAP, 13)
const SUB = trackedText(fontText, 'KITCHEN', 330, SUB_BASELINE, SUB_CAP, 11)
// "— KITCHEN —": the rules run out to the width of SCOTCHS, vertically centred on KITCHEN.
const RULE_Y = round(SUB_BASELINE - SUB_CAP / 2)
const RULES = [
  { x1: round(WORD.left + 4), x2: round(SUB.left - 16) },
  { x1: round(SUB.right + 16), x2: round(WORD.right - 4) },
]

const union = (...boxes: Box[]): Box => ({
  x1: Math.min(...boxes.map((b) => b.x1)),
  y1: Math.min(...boxes.map((b) => b.y1)),
  x2: Math.max(...boxes.map((b) => b.x2)),
  y2: Math.max(...boxes.map((b) => b.y2)),
})
const pad = (b: Box, p: number) => ({ x: round(b.x1 - p), y: round(b.y1 - p), w: round(b.x2 - b.x1 + 2 * p), h: round(b.y2 - b.y1 + 2 * p) })
const emblem = union(S.box, HAT.box, WHISK.box)
const EMBLEM_BOX = pad(emblem, 8)
const STACK_BOX = pad(union(emblem, { x1: WORD.left, y1: WORD_BASELINE - WORD_CAP, x2: WORD.right, y2: SUB_BASELINE + 2 }), 10)

const GOLD_STOPS = [
  ['0', '#e6c98f'],
  ['0.5', '#caa66b'],
  ['1', '#a9823f'],
] as const

function emblemMarkup(fill: string, maskId: string) {
  return `
  <mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="660" height="612">
    <rect width="660" height="612" fill="#fff"/>
    <path d="${HAT.silhouette}" fill="#000" stroke="#000" stroke-width="12" stroke-linejoin="round"/>
    <g fill="none" stroke="#000" stroke-width="11" stroke-linecap="round">${WHISK.wires.map((d) => `<path d="${d}"/>`).join('')}</g>
    <path d="${WHISK.handle}" fill="#000" stroke="#000" stroke-width="8"/>
    <path d="${WHISK.collar}" fill="#000" stroke="#000" stroke-width="8"/>
  </mask>
  <path d="${S.d}" fill="${fill}" mask="url(#${maskId})"/>
  <g fill="none" stroke="${fill}" stroke-width="5.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="${HAT.outline}"/>${HAT.pleats.map((d) => `<path d="${d}" stroke-width="3.6"/>`).join('')}
  </g>
  <g fill="none" stroke="${fill}" stroke-width="3.2" stroke-linecap="round">${WHISK.wires.map((d) => `<path d="${d}"/>`).join('')}</g>
  <path d="${WHISK.collar}" fill="${fill}"/>
  <path d="${WHISK.handle}" fill="${fill}"/>`
}

function gradientDef(id: string, box: { x: number; y: number; w: number; h: number }) {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${box.x}" y1="${box.y}" x2="${box.x + box.w}" y2="${box.y + box.h}">${GOLD_STOPS.map(
    ([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`,
  ).join('')}</linearGradient>`
}

const stackedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${STACK_BOX.x} ${STACK_BOX.y} ${STACK_BOX.w} ${STACK_BOX.h}" role="img" aria-label="SCOTCHS KITCHEN">
  <defs>${gradientDef('gold', STACK_BOX)}</defs>
  ${emblemMarkup('url(#gold)', 'knockout')}
  <path d="${WORD.d}" fill="url(#gold)"/>
  <path d="${SUB.d}" fill="url(#gold)"/>
  ${RULES.map((r) => `<rect x="${r.x1}" y="${RULE_Y - 1}" width="${round(r.x2 - r.x1)}" height="2" fill="url(#gold)"/>`).join('')}
</svg>
`

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${EMBLEM_BOX.x} ${EMBLEM_BOX.y} ${EMBLEM_BOX.w} ${EMBLEM_BOX.h}" role="img" aria-label="SCOTCHS KITCHEN">
  <defs>${gradientDef('gold', EMBLEM_BOX)}</defs>
  ${emblemMarkup('url(#gold)', 'knockout')}
</svg>
`

// Browser tab bars are light or dark: pick the gold that reads on each.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${EMBLEM_BOX.x} ${EMBLEM_BOX.y} ${EMBLEM_BOX.w} ${EMBLEM_BOX.h}">
  <style>.a{stop-color:#b08a4a}.b{stop-color:#94703a}.c{stop-color:#77571f}@media (prefers-color-scheme:dark){.a{stop-color:#ecd39f}.b{stop-color:#d4b27a}.c{stop-color:#b48e4b}}</style>
  <defs><linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="${EMBLEM_BOX.x}" y1="${EMBLEM_BOX.y}" x2="${EMBLEM_BOX.x + EMBLEM_BOX.w}" y2="${EMBLEM_BOX.y + EMBLEM_BOX.h}"><stop offset="0" class="a"/><stop offset="0.5" class="b"/><stop offset="1" class="c"/></linearGradient></defs>
  ${emblemMarkup('url(#gold)', 'knockout')}
</svg>
`

mkdirSync(join(root, 'public', 'brand'), { recursive: true })
writeFileSync(join(root, 'public', 'brand', 'scotchs-kitchen-logo.svg'), stackedSvg)
writeFileSync(join(root, 'public', 'brand', 'scotchs-kitchen-mark.svg'), markSvg)
writeFileSync(join(root, 'public', 'favicon.svg'), faviconSvg)

// Path data for inline, themeable React components.
const art = {
  emblemBox: EMBLEM_BOX,
  stackBox: STACK_BOX,
  s: S.d,
  hatOutline: HAT.outline,
  hatPleats: HAT.pleats,
  hatSilhouette: HAT.silhouette,
  whiskWires: WHISK.wires,
  whiskHandle: WHISK.handle,
  whiskCollar: WHISK.collar,
  word: WORD.d,
  wordBox: { left: round(WORD.left), right: round(WORD.right), baseline: WORD_BASELINE, capHeight: WORD_CAP },
  sub: SUB.d,
  subBox: { left: round(SUB.left), right: round(SUB.right), baseline: SUB_BASELINE, capHeight: SUB_CAP },
  rules: RULES,
  ruleY: RULE_Y,
}
writeFileSync(
  join(root, 'src', 'components', 'brand', 'logo-art.ts'),
  `// AUTO-GENERATED by scripts/build-logo.ts — vector redraw of the SCOTCHS KITCHEN logo.\n// Do not edit by hand.\nexport const LOGO_ART = ${JSON.stringify(art, null, 2)} as const\n`,
)
console.log('Logo written: public/brand/scotchs-kitchen-logo.svg, public/brand/scotchs-kitchen-mark.svg, public/favicon.svg, src/components/brand/logo-art.ts')
