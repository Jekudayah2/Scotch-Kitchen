import { useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { BrandWordmark } from '@/components/brand/brand-marks'
import { ErrorState } from '@/components/ui/feedback'
import type { CatalogProduct } from '@/features/products/catalog'
import { ProductImage } from '@/features/products/components'
import { PurchasePanel } from '@/features/products/purchase-panel'
import { useCatalog } from '@/features/products/queries'
import { BRAND_WORLDS } from '@/features/storefront/brand-panels'
import { Reveal } from '@/features/storefront/motion'
import { BrandUnavailable, CrossSell, ProductPageSkeleton } from '@/features/storefront/product-page'
import { useDocumentTitle } from '@/hooks/use-document-title'

function ProductBlock({ product, priority }: { product: CatalogProduct; priority: boolean }) {
  // Several products share this page, so each keeps its own selection.
  const [variantId, setVariantId] = useState(() => (product.variants.find((v) => v.orderable) ?? product.variants[0])?.id)
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0]
  if (!variant) return null
  const byFlavour = product.variants.some((v) => v.flavour)

  return (
    <article aria-labelledby={`product-${product.id}`} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <ProductImage
        image={variant.image ?? product.primaryImage}
        brandSlug={product.brand.slug}
        brandName={product.brand.name}
        priority={priority}
        className="aspect-[4/3] rounded-media shadow-soft"
        sizes="(min-width: 1024px) 40rem, 92vw"
      />
      <div>
        <h2 id={`product-${product.id}`} className="display-md text-ink">
          {product.name}
        </h2>
        {product.subtitle && <p className="mt-2 text-lg font-semibold text-brand-text">{product.subtitle}</p>}
        {product.description && <p className="mt-4 max-w-lg leading-relaxed text-ink-2">{product.description}</p>}
        <PurchasePanel
          className="mt-7 max-w-xl"
          product={product}
          variant={variant}
          onVariantChange={setVariantId}
          selectorLabel={byFlavour ? 'Choose your flavour' : 'Choose your size'}
          showVariantImages={byFlavour}
        />
      </div>
    </article>
  )
}

/** Template page for product brands added later through the database. */
export default function BrandPage() {
  const { slug = '' } = useParams()
  const catalog = useCatalog()
  const brand = catalog.data?.brandBySlug.get(slug)
  useDocumentTitle(brand?.name ?? 'Brand')

  const world = BRAND_WORLDS[slug]
  if (world) return <Navigate to={world.path} replace />
  if (catalog.isPending) return <ProductPageSkeleton />
  if (catalog.isError) {
    return <ErrorState className="min-h-[60vh]" error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
  }
  if (!brand) return <BrandUnavailable />

  const others = catalog.data.brands.filter((b) => b.id !== brand.id)
  return (
    <div data-brand={brand.slug}>
      <section aria-labelledby="brand-title" className="border-b border-line bg-surface-2/60">
        <div className="container-page py-12 lg:py-20">
          <h1 id="brand-title">
            <BrandWordmark slug={brand.slug} name={brand.name} logoUrl={brand.logo_url} size="xl" />
          </h1>
          {brand.tagline && <p className="display-md mt-4 text-ink">{brand.tagline}</p>}
          {brand.description && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{brand.description}</p>}
        </div>
      </section>
      <div className="container-page space-y-16 py-12 lg:space-y-24 lg:py-20">
        {brand.products.map((product, i) => (
          <Reveal key={product.id}>
            <ProductBlock product={product} priority={i === 0} />
          </Reveal>
        ))}
      </div>
      <CrossSell brands={others} />
    </div>
  )
}
