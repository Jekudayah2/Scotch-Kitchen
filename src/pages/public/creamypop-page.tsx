import { Box, IceCreamCone, Milk, Snowflake } from 'lucide-react'
import { CreamypopWordmark } from '@/components/brand/brand-marks'
import { ErrorState } from '@/components/ui/feedback'
import { ProductImage } from '@/features/products/components'
import { PurchasePanel } from '@/features/products/purchase-panel'
import { useCatalog } from '@/features/products/queries'
import { HeadlineLine, Reveal } from '@/features/storefront/motion'
import { BrandUnavailable, CrossSell, PackagingFacts, ProductPageSkeleton, useSelectedVariant } from '@/features/storefront/product-page'
import { useDocumentTitle } from '@/hooks/use-document-title'

/** Printed on the Creamypop tub. */
const LABEL_FACTS = [
  { icon: Milk, label: 'Real milk' },
  { icon: IceCreamCone, label: 'Creamy goodness' },
  { icon: Box, label: 'Perfectly portioned' },
  { icon: Snowflake, label: 'Keep frozen' },
]

export default function CreamypopPage() {
  useDocumentTitle('Creamypop')
  const catalog = useCatalog()
  const brand = catalog.data?.brandBySlug.get('creamypop')
  const product = brand?.products[0]
  const [variant, selectVariant] = useSelectedVariant(product)

  if (catalog.isPending) return <ProductPageSkeleton scene="cream" />
  if (catalog.isError) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="We couldn’t load Creamypop"
        error={catalog.error}
        onRetry={() => void catalog.refetch()}
        retrying={catalog.isFetching}
      />
    )
  }
  if (!brand || !product || !variant) return <BrandUnavailable />

  const others = catalog.data.brands.filter((b) => b.id !== brand.id)
  const image = variant.image ?? product.primaryImage

  return (
    <div data-brand="creamypop">
      <section data-scene="cream" aria-labelledby="creamypop-title" className="rounded-b-[2rem] bg-canvas sm:rounded-b-[3rem]">
        <div className="container-page grid items-center gap-8 pt-4 pb-16 sm:pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-10 lg:pb-24">
          {/* The photo follows the chosen flavour. */}
          <div className="relative mx-auto w-full max-w-[34rem]">
            <ProductImage
              key={image?.url ?? 'placeholder'}
              image={image}
              brandSlug={brand.slug}
              brandName={brand.name}
              priority
              className="aspect-[4/3] animate-fade-in rounded-media shadow-lift"
              sizes="(min-width: 1024px) 34rem, 92vw"
            />
          </div>

          <div>
            <p className="eyebrow text-brand-text">{product.name}</p>
            <h1 id="creamypop-title" className="mt-4">
              <HeadlineLine>
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-20 w-auto sm:h-24" />
                ) : (
                  <CreamypopWordmark size="hero" className="text-[clamp(3.5rem,1.8rem+6.4vw,6.5rem)]" />
                )}
              </HeadlineLine>
            </h1>
            <p className="display-md mt-4 text-ink">{product.subtitle ?? brand.tagline}</p>
            {product.description && <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-2">{product.description}</p>}
            <PurchasePanel
              className="mt-8 max-w-xl"
              product={product}
              variant={variant}
              onVariantChange={selectVariant}
              selectorLabel="Choose your flavour"
              showVariantImages
            />
          </div>
        </div>

        <div className="container-page pb-16 lg:pb-24">
          <Reveal>
            <div className="border-t border-line pt-10 lg:pt-14">
              <p className="display-campaign-sm max-w-4xl text-ink">
                Creamy. Fresh. <span className="text-brand-text">Ghanaian.</span>
              </p>
              <p className="mt-5 max-w-xl text-lg text-ink-2">Made with real milk for a rich and creamy taste.</p>
              <PackagingFacts facts={LABEL_FACTS} className="mt-8" />
            </div>
          </Reveal>
        </div>
      </section>
      <CrossSell brands={others} />
    </div>
  )
}
