import { ArrowRight, LocateFixed, Radio, ShieldCheck } from 'lucide-react'
import { m } from 'motion/react'
import { useRef } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import type { CatalogBrand } from '@/features/products/catalog'
import { duration, ease } from '@/lib/motion'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'
import { HeroSplitStage } from './hero-split-stage'
import { HeadlineLine, useParallax } from './motion'

const ASSURANCES = [
  { icon: ShieldCheck, label: 'Secure Paystack checkout' },
  { icon: LocateFixed, label: 'Delivery to your exact pin' },
  { icon: Radio, label: 'Live order tracking' },
]

/** Glass price chip over the product stage. The price is the brand's lowest live price. */
function StageChip({ to, name, fromPrice, className }: { to: string; name: string; fromPrice: number | null | undefined; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'glass absolute z-10 inline-flex items-center gap-2.5 rounded-control py-2 pr-3.5 pl-2 shadow-float',
        'transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:hover:translate-y-0',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-[0.6rem] bg-primary text-primary-ink">
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-ink">{name}</span>
        <span className="tabular min-h-4 text-xs font-semibold text-ink-3">{fromPrice != null ? `from ${formatCedis(fromPrice)}` : ''}</span>
      </span>
    </Link>
  )
}

/**
 * "Made to Refresh." Campaign headline beside the official product
 * photography. Images drift apart slightly while scrolling on desktop.
 */
export function HomeHero({ brands }: { brands: CatalogBrand[] }) {
  const stage = useRef<HTMLDivElement>(null)
  const bottleY = useParallax(stage, 28)
  const tubY = useParallax(stage, 72)
  const zobopop = brands.find((b) => b.slug === 'zobopop')
  const creamypop = brands.find((b) => b.slug === 'creamypop')

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_82%_18%,color-mix(in_oklab,var(--primary)_13%,transparent),transparent_72%)]"
      />
      {/*
        Phones: title, then the products, then the details, so the official
        photography is part of the first screen. Desktop: title and details on
        the left, products on the right.
      */}
      <div className="container-page relative grid pt-4 pb-14 [grid-template-areas:'title'_'stage'_'body'] sm:pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-x-10 lg:pt-10 lg:pb-24 lg:[grid-template-areas:'title_stage'_'body_stage']">
        <div className="[grid-area:title] lg:self-end">
          <m.p
            className="eyebrow text-primary-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: duration.slow, ease: ease.out }}
          >
            From SCOTCH’s Kitchen
          </m.p>
          <h1 id="hero-title" className="display-campaign mt-3 text-ink sm:mt-5">
            <HeadlineLine>Made to</HeadlineLine>
            <HeadlineLine delay={0.08} className="text-primary-text">
              Refresh<span className="text-red">.</span>
            </HeadlineLine>
          </h1>
        </div>

        {/* Official photography only; prices are live from the catalog. */}
        <div className="mt-5 [grid-area:stage] sm:mt-8 lg:mt-0 lg:self-center">
          <div className="sm:max-w-[34rem] lg:hidden">
            <HeroSplitStage zobopop={zobopop} creamypop={creamypop} />
          </div>
          <div ref={stage} className="relative hidden aspect-[10/11] w-full lg:block">
            <m.figure
              style={{ y: bottleY }}
              initial={{ scale: 0.97 }}
              animate={{ scale: 1 }}
              transition={{ duration: duration.cinematic, ease: ease.out }}
              className="absolute top-0 right-0 aspect-[4/5] w-[70%] overflow-hidden rounded-media bg-[#2a0a10] shadow-float"
            >
              <img
                src="/images/products/zobopop-bottle.webp"
                alt="A bottle of ZOBOPOP premium hibiscus drink beside hibiscus flowers"
                width={439}
                height={550}
                fetchPriority="high"
                decoding="async"
                className="size-full object-cover"
              />
            </m.figure>
            <m.figure
              style={{ y: tubY }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: duration.cinematic, ease: ease.out, delay: 0.15 }}
              className="absolute bottom-0 left-0 aspect-square w-[48%] overflow-hidden rounded-card bg-surface-2 shadow-float ring-[6px] ring-canvas"
            >
              <img
                src="/images/products/creamypop-strawberry.jpg"
                alt="A tub of Creamypop strawberry ice cream"
                width={1280}
                height={960}
                decoding="async"
                className="size-full object-cover"
              />
            </m.figure>
            {zobopop && <StageChip to="/zobopop" name={zobopop.name} fromPrice={zobopop.fromPrice} className="top-[8%] left-[12%]" />}
            {creamypop && <StageChip to="/creamypop" name={creamypop.name} fromPrice={creamypop.fromPrice} className="right-[4%] bottom-[6%]" />}
          </div>
        </div>

        <m.div
          className="[grid-area:body] lg:self-start"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.slow, ease: ease.out, delay: 0.3 }}
        >
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2 sm:text-xl">Fresh Ghanaian drinks and treats, delivered.</p>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
            <Button asChild size="xl" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <Link to="/order">Order Now</Link>
            </Button>
            <Button asChild size="xl" variant="secondary">
              <a href="#brands">Explore Products</a>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-6 lg:mt-10">
            {ASSURANCES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                <Icon className="size-4.5 text-primary-text" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </m.div>
      </div>
    </section>
  )
}
