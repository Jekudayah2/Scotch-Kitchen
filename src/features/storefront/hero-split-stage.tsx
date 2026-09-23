import { ArrowUpRight } from 'lucide-react'
import { m } from 'motion/react'
import { useId } from 'react'
import { Link } from 'react-router'
import { CreamypopWordmark, ZobopopWordmark } from '@/components/brand/brand-marks'
import { KitchenMark } from '@/components/brand/logo'
import type { CatalogBrand } from '@/features/products/catalog'
import { ease } from '@/lib/motion'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'

/*
 * Phones: the two brand worlds meet on a diagonal inside one card, so the
 * products are on the first screen without scrolling. ZOBOPOP's bottle
 * dissolves into hibiscus wine; Creamypop's tubs sit fanned on cream; the
 * parent-brand seal joins them. Each side is its own link with a live price.
 */

const WINE_CUT = 'polygon(0 0, 62% 0, 44% 100%, 0 100%)'

function FromPrice({ price }: { price: number | null | undefined }) {
  return (
    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-ink-2">
      {price != null ? (
        <>
          from <span className="tabular text-sm font-bold text-ink">{formatCedis(price)}</span>
        </>
      ) : (
        <span className="h-4 w-16 animate-pulse rounded bg-surface-3/60" />
      )}
      <ArrowUpRight className="size-3.5 opacity-70" aria-hidden="true" />
    </span>
  )
}

/** "FRESH · GHANAIAN · DELIVERED ·" around the gold emblem. Decorative. */
function KitchenSeal({ className }: { className?: string }) {
  const ring = `seal-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  return (
    <m.div
      aria-hidden="true"
      className={cn('logo-on-light grid place-items-center rounded-full bg-[#fff8f1] shadow-float ring-1 ring-black/5', className)}
      initial={{ rotate: -140, scale: 0.6, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ duration: 1.1, ease: ease.out, delay: 0.35 }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <defs>
          <path id={ring} d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
        </defs>
        <text className="fill-[#4e0e19] font-display text-[9.5px] font-bold uppercase">
          <textPath href={`#${ring}`} textLength={236} lengthAdjust="spacing">
            Fresh · Ghanaian · Delivered ·
          </textPath>
        </text>
      </svg>
      <KitchenMark className="h-[42%]" />
    </m.div>
  )
}

export function HeroSplitStage({ zobopop, creamypop }: { zobopop?: CatalogBrand; creamypop?: CatalogBrand }) {
  return (
    <m.div
      className="relative isolate aspect-[3/2] w-full overflow-hidden rounded-media shadow-lift ring-1 ring-black/5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: ease.out, delay: 0.1 }}
    >
      {/* Cream world: the whole card underneath. */}
      <Link
        to="/creamypop"
        data-scene="cream"
        data-brand="creamypop"
        aria-label={`Creamypop ice cream${creamypop?.fromPrice != null ? `, from ${formatCedis(creamypop.fromPrice)}` : ''}`}
        className="group absolute inset-0 bg-canvas focus-visible:outline-none"
      >
        <m.img
          src="/images/products/creamypop-strawberry.jpg"
          alt=""
          width={1280}
          height={960}
          decoding="async"
          className="absolute top-[7%] right-[3%] aspect-square w-[26%] rounded-[0.8rem] object-cover shadow-lift ring-2 ring-white"
          initial={{ rotate: 0, scale: 0.9, opacity: 0 }}
          animate={{ rotate: 6, scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: ease.out, delay: 0.25 }}
        />
        <m.img
          src="/images/products/creamypop-vanilla.webp"
          alt=""
          width={733}
          height={553}
          decoding="async"
          className="absolute top-[27%] right-[16%] aspect-square w-[26%] rounded-[0.8rem] object-cover shadow-lift ring-2 ring-white"
          initial={{ rotate: 0, scale: 0.9, opacity: 0 }}
          animate={{ rotate: -7, scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: ease.out, delay: 0.35 }}
        />
        <span className="absolute right-[4%] bottom-[6%] flex flex-col items-end rounded-md group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-ring">
          <CreamypopWordmark className="text-[length:clamp(1.3rem,6.2vw,2.1rem)]" />
          <FromPrice price={creamypop?.fromPrice} />
        </span>
      </Link>

      {/* Hibiscus-wine world, cut on the diagonal (the cut also limits where it can be tapped). */}
      <Link
        to="/zobopop"
        data-scene="wine"
        data-brand="zobopop"
        aria-label={`ZOBOPOP premium hibiscus drink${zobopop?.fromPrice != null ? `, from ${formatCedis(zobopop.fromPrice)}` : ''}`}
        className="group absolute inset-0 isolate bg-canvas focus-visible:outline-none"
        style={{ clipPath: WINE_CUT }}
      >
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_30%_65%,var(--scene-wine-2),transparent_75%)]" />
        <m.img
          src="/images/products/zobopop-bottle.webp"
          alt=""
          width={439}
          height={550}
          fetchPriority="high"
          decoding="async"
          className="feather-edges absolute bottom-0 left-[11%] aspect-[4/5] h-[84%] w-auto object-cover"
          initial={{ y: 14, opacity: 0.2 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: ease.out, delay: 0.15 }}
        />
        <span className="absolute top-[6%] left-[4%] flex flex-col rounded-md group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-ring">
          <ZobopopWordmark tone="light" className="text-[length:clamp(1.45rem,7vw,2.3rem)]" />
          <FromPrice price={zobopop?.fromPrice} />
        </span>
      </Link>

      <KitchenSeal className="absolute top-1/2 left-[53%] z-10 size-[clamp(3.75rem,18vw,5.25rem)] -translate-x-1/2 -translate-y-1/2" />
    </m.div>
  )
}
