import { useId, type ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { LOGO_ART as A } from './logo-art'

/*
 * SCOTCH'S Kitchen logo, drawn inline from the vector redraw in logo-art.ts
 * (built by scripts/build-logo.ts). Transparent: no tile, no surround.
 * The gold comes from --logo-gold-* tokens, deeper on light surfaces and
 * brighter on dark ones, so it stays legible in both themes.
 */

type Box = { x: number; y: number; w: number; h: number }
type Tone = 'auto' | 'on-dark'

const MASK = { x: 0, y: 0, width: 660, height: 612 }

/** Horizontal lockup: the text block sits right of the emblem, scaled up. */
const TEXT = { left: A.wordBox.left, top: A.wordBox.baseline - A.wordBox.capHeight, bottom: A.subBox.baseline + 1 }
const TEXT_W = A.wordBox.right - A.wordBox.left
const TEXT_H = TEXT.bottom - TEXT.top
const LOCKUP_SCALE = 2
const LOCKUP_GAP = 44
const LOCKUP_BOX: Box = {
  x: A.emblemBox.x,
  y: A.emblemBox.y,
  w: A.emblemBox.w + LOCKUP_GAP + TEXT_W * LOCKUP_SCALE,
  h: A.emblemBox.h,
}
const LOCKUP_TEXT_TRANSFORM = `translate(${A.emblemBox.x + A.emblemBox.w + LOCKUP_GAP} ${A.emblemBox.y + (A.emblemBox.h - TEXT_H * LOCKUP_SCALE) / 2}) scale(${LOCKUP_SCALE}) translate(${-TEXT.left} ${-TEXT.top})`

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
}

function GoldGradient({ id, box }: { id: string; box: Box }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={box.x} y1={box.y} x2={box.x + box.w} y2={box.y + box.h}>
      <stop offset="0" style={{ stopColor: 'var(--logo-gold-1)' }} />
      <stop offset="0.5" style={{ stopColor: 'var(--logo-gold-2)' }} />
      <stop offset="1" style={{ stopColor: 'var(--logo-gold-3)' }} />
    </linearGradient>
  )
}

function Emblem({ fill, maskId }: { fill: string; maskId: string }) {
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" {...MASK}>
        <rect {...MASK} fill="#fff" />
        <path d={A.hatSilhouette} fill="#000" stroke="#000" strokeWidth={12} strokeLinejoin="round" />
        <g fill="none" stroke="#000" strokeWidth={11} strokeLinecap="round">
          {A.whiskWires.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path d={A.whiskHandle} fill="#000" stroke="#000" strokeWidth={8} />
        <path d={A.whiskCollar} fill="#000" stroke="#000" strokeWidth={8} />
      </mask>
      <path d={A.s} fill={fill} mask={`url(#${maskId})`} />
      <g fill="none" stroke={fill} strokeWidth={5.2} strokeLinejoin="round" strokeLinecap="round">
        <path d={A.hatOutline} />
        {A.hatPleats.map((d) => (
          <path key={d} d={d} strokeWidth={3.6} />
        ))}
      </g>
      <g fill="none" stroke={fill} strokeWidth={3.2} strokeLinecap="round">
        {A.whiskWires.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d={A.whiskCollar} fill={fill} />
      <path d={A.whiskHandle} fill={fill} />
    </>
  )
}

function Wordmark({ fill }: { fill: string }) {
  return (
    <>
      <path d={A.word} fill={fill} />
      <path d={A.sub} fill={fill} />
      {A.rules.map((r) => (
        <rect key={r.x1} x={r.x1} y={A.ruleY - 1} width={r.x2 - r.x1} height={2} fill={fill} />
      ))}
    </>
  )
}

function Svg({ box, label, tone, className, children }: { box: Box; label?: string; tone: Tone; className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={cn('block h-10 w-auto shrink-0', tone === 'on-dark' && 'logo-on-dark', className)}
      style={{ aspectRatio: `${box.w} / ${box.h}` }}
    >
      {children}
    </svg>
  )
}

interface LogoProps {
  /** Accessible name. Omit when a parent (e.g. a link) already names it. */
  label?: string
  /** `on-dark` forces the bright gold, for dark surfaces in light mode. */
  tone?: Tone
  /** Size with a height class, e.g. `h-10`; the width follows. */
  className?: string
}

/** The emblem alone: "S" with the chef's hat and whisk. Favicon, app bars, tight spaces. */
export function KitchenMark({ label, tone = 'auto', className }: LogoProps) {
  const gradient = useSvgId('sk-gold')
  const mask = useSvgId('sk-knockout')
  return (
    <Svg box={A.emblemBox} label={label} tone={tone} className={className}>
      <defs>
        <GoldGradient id={gradient} box={A.emblemBox} />
      </defs>
      <Emblem fill={`url(#${gradient})`} maskId={mask} />
    </Svg>
  )
}

/**
 * Full logo. `stacked` is the original composition (footer, sign-in, system
 * pages); `horizontal` puts SCOTCHS / KITCHEN beside the emblem (header).
 */
export function KitchenLogo({ variant = 'horizontal', label, tone = 'auto', className }: LogoProps & { variant?: 'stacked' | 'horizontal' }) {
  const gradient = useSvgId('sk-gold')
  const textGradient = useSvgId('sk-gold-text')
  const mask = useSvgId('sk-knockout')
  const box = variant === 'stacked' ? A.stackBox : LOCKUP_BOX
  const fill = `url(#${gradient})`
  return (
    <Svg box={box} label={label} tone={tone} className={className}>
      <defs>
        <GoldGradient id={gradient} box={box} />
        {/* userSpaceOnUse resolves in the referencing element's space, so the scaled text needs its own. */}
        {variant === 'horizontal' && <GoldGradient id={textGradient} box={{ x: TEXT.left, y: TEXT.top, w: TEXT_W, h: TEXT_H }} />}
      </defs>
      <Emblem fill={fill} maskId={mask} />
      {variant === 'stacked' ? (
        <Wordmark fill={fill} />
      ) : (
        <g transform={LOCKUP_TEXT_TRANSFORM}>
          <Wordmark fill={`url(#${textGradient})`} />
        </g>
      )}
    </Svg>
  )
}
