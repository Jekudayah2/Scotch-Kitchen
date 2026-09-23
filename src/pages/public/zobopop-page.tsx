import { MapPin, Refrigerator, Sprout } from 'lucide-react'
import { m } from 'motion/react'
import { useRef } from 'react'
import { ZobopopWordmark } from '@/components/brand/brand-marks'
import { ErrorState } from '@/components/ui/feedback'
import { ProductImage } from '@/features/products/components'
import { PurchasePanel } from '@/features/products/purchase-panel'
import { useCatalog } from '@/features/products/queries'
import { HeadlineLine, Reveal, useParallax } from '@/features/storefront/motion'
import { BrandUnavailable, CrossSell, PackagingFacts, ProductPageSkeleton, useSelectedVariant } from '@/features/storefront/product-page'
import { useDocumentTitle } from '@/hooks/use-document-title'

/** Printed on the ZOBOPOP label. */
const LABEL_FACTS = [
  { icon: Sprout, label: 'Ghanaian recipe' },
  { icon: MapPin, label: 'Made in Ghana' },
  { icon: Refrigerator, label: 'Keep refrigerated' },
]

export default function ZobopopPage() {
  useDocumentTitle('ZOBOPOP')
  const catalog = useCatalog()
  const brand = catalog.data?.brandBySlug.get('zobopop')
  const product = brand?.products[0]
  const [variant, selectVariant] = useSelectedVariant(product)
  const media = useRef<HTMLDivElement>(null)
  const drift = useParallax(media, 40)

  if (catalog.isPending) return <ProductPageSkeleton scene="wine" />
  if (catalog.isError) {
    return <ErrorState className="min-h-[60vh]" title="We couldn’t load ZOBOPOP" error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
  }
  if (!brand || !product || !variant) return <BrandUnavailable />

  const others = catalog.data.brands.filter((b) => b.id !== brand.id)

  return (
    <div data-brand="zobopop">
      <section data-scene="wine" aria-labelledby="zobopop-title" className="relative isolate overflow-hidden rounded-b-[2rem] bg-canvas sm:rounded-b-[3rem]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_25%_45%,var(--scene-wine-2),transparent_72%)]" />
        <div className="container-page grid items-center gap-8 pt-4 pb-16 sm:pt-8 lg:grid-cols-2 lg:gap-16 lg:pt-10 lg:pb-24">
          <div ref={media} className="relative mx-auto w-full max-w-[20rem] sm:max-w-[26rem] lg:max-w-[34rem]">
            <m.div style={{ y: drift }}>
              <ProductImage
                image={variant.image ?? product.primaryImage}
                brandSlug={brand.slug}
                brandName={brand.name}
                priority
                className="feather-edges aspect-[4/5] bg-transparent"
                sizes="(min-width: 1024px) 34rem, 80vw"
              />
            </m.div>
          </div>

          <div>
            <p className="eyebrow text-ink-3">SCOTCH’s Kitchen</p>
            <h1 id="zobopop-title" className="mt-4">
              <HeadlineLine>
                {brand.logo_url ? <img src={brand.logo_url} alt={brand.name} className="h-20 w-auto sm:h-24" /> : <ZobopopWordmark size="hero" tone="light" className="text-[clamp(4rem,2rem+9vw,8.5rem)]" />}
              </HeadlineLine>
            </h1>
            <p className="display-md mt-4 text-ink">{product.subtitle ?? brand.tagline}</p>
            {product.description && <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-2">{product.description}</p>}
            <PurchasePanel
              className="mt-8 max-w-xl"
              product={product}
              variant={variant}
              onVariantChange={selectVariant}
              selectorLabel="Choose your size"
            />
          </div>
        </div>

        <div className="container-page pb-16 lg:pb-24">
          <Reveal>
            <div className="border-t border-line pt-10 lg:pt-14">
              <p className="display-campaign-sm max-w-4xl text-ink">
                Refreshing nature <span className="text-ink-3">in every sip.</span>
              </p>
              <p className="mt-5 max-w-xl text-lg text-ink-2">Refreshingly natural. Authentically Ghanaian.</p>
              <PackagingFacts facts={LABEL_FACTS} className="mt-8" />
            </div>
          </Reveal>
        </div>
      </section>
      <CrossSell brands={others} />
    </div>
  )
}
