import {
  ArrowRight,
  Bike,
  Box,
  CreditCard,
  IceCreamBowl,
  LocateFixed,
  MapPin,
  MapPinned,
  Milk,
  Radio,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Sprout,
  Wallet,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BrandTile, BrandWordmark, CreamypopWordmark, Watermark, ZobopopWordmark } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { store } from '@/config/store'
import type { CatalogBrand, CatalogProduct } from '@/features/products/catalog'
import { useStoreSettings } from '@/features/products/queries'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'
import { FlavourCarousel } from './flavour-carousel'
import { IngredientStory } from './ingredient-story'
import { ProductShowcase } from './product-showcase'
import { SectionHeading } from './section-heading'

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function PriceChip({ to, label, price, className }: { to: string; label: string; price: number | null | undefined; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'glass absolute z-10 inline-flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2 shadow-float transition-transform hover:-translate-y-0.5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-ink">
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[0.95rem] font-bold text-ink">{label}</span>
        <span className="tabular text-xs font-semibold text-ink-3">{price != null ? `from ${formatCedis(price)}` : ' '}</span>
      </span>
    </Link>
  )
}

export function HomeHero({ brands, loading }: { brands: CatalogBrand[]; loading: boolean }) {
  const reduceMotion = useReducedMotion()
  const zobopop = brands.find((b) => b.slug === 'zobopop')
  const creamypop = brands.find((b) => b.slug === 'creamypop')
  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const } }

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[44rem] bg-[radial-gradient(50%_55%_at_80%_22%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_72%)]"
      />
      <div className="container-page relative grid items-center gap-14 pt-8 pb-16 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-16 lg:pb-24">
        <div>
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink-2 shadow-soft ring-1 ring-line"
          >
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Delivering around {store.areaLabel}
          </motion.p>
          <motion.h1 {...rise(0.05)} id="hero-title" className="display-xl mt-6 text-ink">
            Two Ghanaian favourites.
            <br />
            <span className="font-serif font-normal tracking-[-0.02em] text-primary-text italic">One kitchen.</span>
          </motion.h1>
          <motion.p {...rise(0.12)} className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            ZOBOPOP, our premium hibiscus drink, and Creamypop, our creamy ice cream. Made by SCOTCH’s Kitchen and delivered to the exact
            pin you drop.
          </motion.p>
          <motion.div {...rise(0.18)} className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="xl" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <Link to="/order">Order now</Link>
            </Button>
            <Button asChild size="xl" variant="secondary">
              <a href="#brands">Meet the brands</a>
            </Button>
          </motion.div>
          <motion.ul {...rise(0.24)} className="mt-10 grid max-w-xl grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, label: 'Secure Paystack checkout' },
              { icon: LocateFixed, label: 'Delivery to your exact pin' },
              { icon: Radio, label: 'Live order tracking' },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm font-semibold text-ink-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Product stage: official photography as brand art. Prices on the chips come from the database. */}
        <div className="relative mx-auto aspect-square w-full max-w-[34rem] lg:aspect-auto lg:h-[36rem] lg:max-w-none">
          <motion.figure
            initial={reduceMotion ? false : { opacity: 0, rotate: 0, y: 20 }}
            animate={{ opacity: 1, rotate: 2, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-0 right-0 w-[60%] overflow-hidden rounded-5xl shadow-float ring-1 ring-black/5"
          >
            <img
              src="/images/products/zobopop-500ml.webp"
              alt="A bottle of ZOBOPOP premium hibiscus drink with hibiscus flowers"
              width={444}
              height={555}
              fetchPriority="high"
              className="aspect-[4/5] w-full object-cover"
            />
          </motion.figure>
          <motion.figure
            initial={reduceMotion ? false : { opacity: 0, rotate: 0, y: 30 }}
            animate={{ opacity: 1, rotate: -4, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-[4%] left-0 w-[52%] overflow-hidden rounded-4xl shadow-float ring-1 ring-black/5"
          >
            <img
              src="/images/products/creamypop-strawberry.jpg"
              alt="A tub of Creamypop strawberry ice cream"
              width={1280}
              height={960}
              className="aspect-square w-full object-cover"
            />
          </motion.figure>
          <motion.figure
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-[10%] left-[6%] hidden w-[30%] -rotate-3 overflow-hidden rounded-3xl shadow-lift ring-1 ring-black/5 sm:block"
          >
            <img
              src="/images/products/creamypop-vanilla.webp"
              alt="A tub of Creamypop vanilla ice cream"
              width={733}
              height={553}
              className="aspect-square w-full object-cover"
            />
          </motion.figure>
          {loading ? (
            <Skeleton className="absolute bottom-[34%] right-[4%] h-12 w-44 rounded-full" />
          ) : (
            <>
              {zobopop && <PriceChip to="/zobopop" label="ZOBOPOP" price={zobopop.fromPrice} className="right-[3%] bottom-[30%]" />}
              {creamypop && <PriceChip to="/creamypop" label="Creamypop" price={creamypop.fromPrice} className="bottom-0 left-[38%] sm:left-[40%]" />}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
function variantSummary(brand: CatalogBrand) {
  const variants = brand.products.flatMap((p) => p.variants)
  const flavours = variants.map((v) => v.flavour).filter(Boolean)
  if (flavours.length) return `${flavours.join(' & ')} · ${variants[0]?.size_label ?? ''}`.trim()
  return variants.map((v) => v.size_label ?? v.name).join(' & ')
}

export function BrandCard({ brand }: { brand: CatalogBrand }) {
  const to = brand.slug === 'zobopop' || brand.slug === 'creamypop' ? `/${brand.slug}` : `/brands/${brand.slug}`
  const isZobopop = brand.slug === 'zobopop'
  const isCreamypop = brand.slug === 'creamypop'
  return (
    <article
      data-brand={brand.slug}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-5xl p-6 shadow-lift ring-1 sm:p-8',
        isZobopop && 'bg-[linear-gradient(150deg,#4e0e19_0%,#7c1629_60%,#9b2238_100%)] text-white ring-black/10',
        isCreamypop && 'bg-cp-cream text-ink ring-line',
        !isZobopop && !isCreamypop && 'bg-surface text-ink ring-line',
      )}
    >
      <div className="relative aspect-[16/11] overflow-hidden rounded-4xl ring-1 ring-black/5">
        {brand.primaryImage ? (
          <img
            src={brand.primaryImage.url}
            alt={brand.primaryImage.alt_text}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-surface-2">
            <BrandTile slug={brand.slug} />
          </div>
        )}
      </div>
      <div className="mt-7 flex flex-1 flex-col gap-3">
        {isZobopop ? (
          <ZobopopWordmark size="lg" tone="light" />
        ) : isCreamypop ? (
          <CreamypopWordmark size="lg" />
        ) : (
          <BrandWordmark slug={brand.slug} name={brand.name} logoUrl={brand.logo_url} size="lg" />
        )}
        {brand.tagline && <p className={cn('text-lg font-semibold', isZobopop ? 'text-[#f4c9a8]' : 'text-brand-text')}>{brand.tagline}</p>}
        {brand.description && <p className={cn('max-w-md leading-relaxed', isZobopop ? 'text-[#f0d9d4]' : 'text-ink-2')}>{brand.description}</p>}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-5">
          <p className={cn('text-sm font-semibold', isZobopop ? 'text-[#f0d9d4]' : 'text-ink-3')}>
            <span className={cn('tabular block font-display text-2xl font-bold', isZobopop ? 'text-white' : 'text-ink')}>
              from {formatCedis(brand.fromPrice)}
            </span>
            {variantSummary(brand)}
          </p>
          <Button asChild variant={isZobopop ? 'light' : 'brand'} size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
            <Link to={to}>Explore {brand.name}</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

export function BrandsSection({ brands, loading }: { brands: CatalogBrand[]; loading: boolean }) {
  return (
    <section id="brands" className="relative scroll-mt-20 overflow-hidden bg-surface-2 py-20 lg:py-28" aria-labelledby="brands-title">
      <Watermark text="SCOTCH’S KITCHEN" className="top-6 left-1/2 -translate-x-1/2 text-[7rem] sm:text-[11rem]" />
      <div className="container-page relative">
        <SectionHeading
          id="brands-title"
          eyebrow="The brands"
          title="Our brands"
          description="Two product lines under one roof. Each has its own character, and both come from the same kitchen."
          align="center"
          doodle
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {loading
            ? [0, 1].map((i) => <Skeleton key={i} className="h-[34rem] rounded-5xl" />)
            : brands.map((brand) => <BrandCard key={brand.id} brand={brand} />)}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Brand menus with a sticky brand column
// ---------------------------------------------------------------------------
function StickyBrandColumn({
  brand,
  children,
  className,
}: {
  brand: CatalogBrand
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('lg:sticky lg:top-28 lg:self-start', className)}>
      <BrandTile slug={brand.slug} size="lg" />
      <h2 id={`${brand.slug}-menu`} className="display-lg mt-8 text-ink">
        {brand.name} <span className="font-serif font-normal tracking-[-0.02em] text-brand-text italic">menu</span>
      </h2>
      {brand.tagline && <p className="mt-3 text-lg font-semibold text-brand-text">{brand.tagline}</p>}
      {children}
    </div>
  )
}

export function ZobopopMenuSection({ brand, product }: { brand: CatalogBrand; product: CatalogProduct }) {
  return (
    <section data-brand="zobopop" className="relative overflow-hidden py-20 lg:py-28" aria-labelledby="zobopop-menu">
      <Watermark text="ZOBOPOP" className="bottom-4 -left-10 text-[8rem] sm:text-[13rem]" />
      <div className="container-page relative grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <StickyBrandColumn brand={brand}>
          <p className="mt-5 max-w-sm leading-relaxed text-ink-2">{brand.description}</p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Sizes and prices">
            {product.variants.map((v) => (
              <li key={v.id} className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-soft ring-1 ring-line">
                {v.size_label ?? v.name}
                <span className="tabular text-brand-text">{formatCedis(v.price_pesewas)}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="link" className="mt-6" trailingIcon={<ArrowRight aria-hidden="true" />}>
            <Link to="/zobopop">The full ZOBOPOP story</Link>
          </Button>
        </StickyBrandColumn>
        <div className="space-y-16">
          <ProductShowcase product={product} />
          <div className="space-y-6">
            <h3 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-ink">
              The signature blend<span className="text-brand">.</span>
            </h3>
            <IngredientStory ingredients={product.ingredients} compact />
          </div>
        </div>
      </div>
    </section>
  )
}

export function LabelFacts({ className, columns = 4 }: { className?: string; columns?: 2 | 4 }) {
  const facts = [
    { icon: Milk, title: 'Real milk', text: 'Made with real milk for a rich, creamy taste.' },
    { icon: IceCreamBowl, title: 'Creamy goodness', text: 'Smooth scoops from the first spoon.' },
    { icon: Snowflake, title: 'Keep frozen', text: 'Straight into the freezer when it arrives.' },
    { icon: Box, title: 'Perfectly portioned', text: 'A 200ml tub, just right for one.' },
  ]
  return (
    <ul className={cn('grid grid-cols-2 gap-3', columns === 4 && 'sm:grid-cols-4', className)} aria-label="On every tub">
      {facts.map(({ icon: Icon, title, text }) => (
        <li key={title} className="rounded-3xl bg-surface p-4 shadow-soft ring-1 ring-line">
          <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand-text">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-3 font-display font-bold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-snug text-ink-3">{text}</p>
        </li>
      ))}
    </ul>
  )
}

export function CreamypopMenuSection({ brand, product }: { brand: CatalogBrand; product: CatalogProduct }) {
  return (
    <section data-brand="creamypop" className="relative overflow-hidden bg-cp-cream py-20 lg:py-28" aria-labelledby="creamypop-menu">
      <Watermark text="Creamypop" className="-right-10 bottom-4 text-[8rem] sm:text-[12rem]" />
      <div className="container-page relative grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
        <StickyBrandColumn brand={brand} className="lg:order-2">
          <p className="mt-5 max-w-sm leading-relaxed text-ink-2">{brand.description}</p>
          <Button asChild variant="link" className="mt-6" trailingIcon={<ArrowRight aria-hidden="true" />}>
            <Link to="/creamypop">All about Creamypop</Link>
          </Button>
        </StickyBrandColumn>
        <div className="space-y-12 lg:order-1">
          <FlavourCarousel variants={product.variants} description={product.description} />
          <LabelFacts columns={2} />
        </div>
      </div>
    </section>
  )
}

/** Generic menu section for any future brand added in the database. */
export function GenericBrandSection({ brand }: { brand: CatalogBrand }) {
  return (
    <section data-brand={brand.slug} className="relative overflow-hidden py-20 lg:py-28" aria-labelledby={`${brand.slug}-menu`}>
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <StickyBrandColumn brand={brand}>
          {brand.description && <p className="mt-5 max-w-sm leading-relaxed text-ink-2">{brand.description}</p>}
        </StickyBrandColumn>
        <div className="space-y-16">
          {brand.products.map((product) => (
            <ProductShowcase key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Why SCOTCH's Kitchen
// ---------------------------------------------------------------------------
const INGREDIENT_SWATCH: Record<string, string> = {
  hibiscus: 'var(--ing-hibiscus)',
  cloves: 'var(--ing-clove)',
  ginger: 'var(--ing-ginger)',
  cinnamon: 'var(--ing-cinnamon)',
  mint: 'var(--ing-mint)',
  mango: 'var(--ing-mango)',
  lemon: 'var(--ing-lemon)',
  pineapple: 'var(--ing-pineapple)',
}

function WhyCard({
  icon: Icon,
  title,
  children,
  aside,
  className,
}: {
  icon: typeof Sprout
  title: string
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <li className={cn('flex flex-col gap-6 rounded-4xl border border-line bg-surface p-7 shadow-soft md:flex-row md:items-center', className)}>
      <div className="flex-1">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-text">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-5 font-display text-xl font-bold text-ink">{title}</p>
        <p className="mt-2 max-w-lg leading-relaxed text-ink-2">{children}</p>
      </div>
      {aside && <div className="hidden shrink-0 md:block md:w-[44%]">{aside}</div>}
    </li>
  )
}

export function WhySection({ ingredients = [] }: { ingredients?: CatalogProduct['ingredients'] }) {
  const steps = ['Payment confirmed', 'Preparing', 'Out for delivery', 'Delivered']
  return (
    <section className="py-20 lg:py-28" aria-labelledby="why-title">
      <div className="container-page">
        <SectionHeading id="why-title" eyebrow="Why order from us" title="Why SCOTCH’s Kitchen" />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <WhyCard
            icon={Sprout}
            title="Real ingredients, named"
            className="sm:col-span-2"
            aside={
              ingredients.length > 0 && (
                <ul className="flex flex-wrap justify-end gap-2" aria-label="ZOBOPOP ingredients">
                  {ingredients.map((ingredient) => (
                    <li key={ingredient.id} className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-sm font-semibold text-ink ring-1 ring-line">
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full"
                        style={{ background: INGREDIENT_SWATCH[ingredient.name.toLowerCase()] ?? 'var(--accent)' }}
                      />
                      {ingredient.name}
                    </li>
                  ))}
                </ul>
              )
            }
          >
            ZOBOPOP names everything in the bottle, and Creamypop is made with real milk. No mystery flavours.
          </WhyCard>
          <WhyCard icon={MapPinned} title="Your exact pin">
            Use your GPS, search, or tap the map. Riders navigate to the coordinates you confirm, not a guess from an address.
          </WhyCard>
          <WhyCard icon={CreditCard} title="Secure checkout">
            You pay on Paystack’s secure page. Your order is only marked paid after we verify the payment with Paystack.
          </WhyCard>
          <WhyCard
            icon={Bike}
            title="Track every step"
            className="sm:col-span-2"
            aside={
              <ol className="space-y-2" aria-label="Order steps">
                {steps.map((step, i) => (
                  <li key={step} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                        i === steps.length - 1 ? 'bg-success text-white' : 'bg-primary-soft text-primary-text',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="h-10 flex-1 content-center rounded-2xl bg-surface-2 px-3.5 text-sm font-semibold text-ink ring-1 ring-line">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            }
          >
            From payment confirmed to preparing, out for delivery and delivered, your order page updates as it happens.
          </WhyCard>
        </ul>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// How ordering works — big wine panel with a dashed timeline
// ---------------------------------------------------------------------------
export function HowItWorksPanel() {
  const steps = [
    { icon: ShoppingBag, title: 'Choose your favourites', text: 'ZOBOPOP in 330ml or 500ml, Creamypop in Vanilla or Strawberry.' },
    { icon: MapPin, title: 'Drop your delivery pin', text: 'GPS, search or tap the map, then confirm the exact spot.' },
    { icon: Wallet, title: 'Pay securely with Paystack', text: 'We verify your payment before the kitchen starts.' },
    { icon: Bike, title: 'Track it to your door', text: 'Watch it go from preparing to out for delivery to delivered.' },
  ]
  return (
    <section className="container-page py-8 lg:py-12" aria-labelledby="how-title">
      <div className="relative overflow-hidden rounded-5xl bg-[#4e0e19] px-6 py-12 text-white sm:px-10 lg:px-16 lg:py-16 dark:bg-[#26090f]">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(194,58,82,0.5),transparent_70%)]"
        />
        <Watermark text="ORDER" className="-bottom-8 -left-6 text-[10rem] [-webkit-text-stroke-color:rgba(255,255,255,0.07)]" />
        <div className="relative grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col justify-center">
            <p className="eyebrow text-[#f4c9a8]">How it works</p>
            <h2 id="how-title" className="display-lg mt-4">
              From our kitchen to your pin<span className="text-[#f4c9a8]">.</span>
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#f0d9d4]">
              Four steps, no phone calls needed. You’ll see every update on your order page.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="light" size="xl" trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link to="/order">Start your order</Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="ghost"
                className="text-white ring-1 ring-white/30 hover:bg-white/10 hover:text-white"
              >
                <Link to="/track-order">Track an order</Link>
              </Button>
            </div>
          </div>
          <ol className="relative space-y-8">
            <span aria-hidden="true" className="absolute top-6 bottom-6 left-6 border-l-2 border-dashed border-white/25" />
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative flex gap-5">
                <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#4e0e19] shadow-float">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="pt-1">
                  <p className="text-xs font-bold tracking-[0.16em] text-[#f4c9a8] uppercase">Step {i + 1}</p>
                  <p className="mt-1 font-display text-xl font-bold">{title}</p>
                  <p className="mt-1 text-[#f0d9d4]">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Delivery information
// ---------------------------------------------------------------------------
export function DeliveryInfoSection({ products }: { products: CatalogProduct[] }) {
  const settings = useStoreSettings()
  const flatFee = settings.data?.delivery_fee_mode === 'FLAT' ? settings.data.flat_delivery_fee_pesewas : null
  const storage = products.filter((p) => p.storage_note)
  return (
    <section id="delivery" className="scroll-mt-20 py-20 lg:py-28" aria-labelledby="delivery-title">
      <div className="container-page">
        <SectionHeading id="delivery-title" eyebrow="Delivery" title="Where we deliver" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <div className="rounded-4xl border border-line bg-surface p-7 shadow-soft">
            <MapPin className="size-6 text-primary-text" aria-hidden="true" />
            <p className="mt-4 font-display text-xl font-bold text-ink">Around {store.areaLabel}</p>
            <p className="mt-2 leading-relaxed text-ink-2">
              Drop your pin at checkout. Riders use the exact coordinates you confirm, so landmarks and instructions help too.
            </p>
          </div>
          <div className="rounded-4xl border border-line bg-surface p-7 shadow-soft">
            <Bike className="size-6 text-primary-text" aria-hidden="true" />
            <p className="mt-4 font-display text-xl font-bold text-ink">
              {flatFee != null ? `Delivery: ${formatCedis(flatFee)}` : 'Delivery fee by location'}
            </p>
            <p className="mt-2 leading-relaxed text-ink-2">
              {flatFee != null
                ? 'A flat fee per order, shown in your total before you pay.'
                : 'Confirmed for your exact pin after you order. If it’s set after you’ve paid, it’s collected on delivery as a separate balance.'}
            </p>
          </div>
          <div className="rounded-4xl border border-line bg-surface p-7 shadow-soft">
            <Snowflake className="size-6 text-primary-text" aria-hidden="true" />
            <p className="mt-4 font-display text-xl font-bold text-ink">Handle with care</p>
            {storage.length ? (
              <ul className="mt-2 space-y-1 leading-relaxed text-ink-2">
                {storage.map((p) => (
                  <li key={p.id}>
                    <strong className="font-semibold text-ink">{p.brand.name}:</strong> {p.storage_note?.toLowerCase()}.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-ink-2">Storage guidance is printed on every pack.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
