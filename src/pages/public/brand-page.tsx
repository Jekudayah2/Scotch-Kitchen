import { Store } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'
import { BrandTile, BrandWordmark } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback'
import { useCatalog } from '@/features/products/queries'
import { ProductShowcase } from '@/features/storefront/product-showcase'
import { useDocumentTitle } from '@/hooks/use-document-title'

/** Template page for product brands added later through the database. */
export default function BrandPage() {
  const { slug = '' } = useParams()
  const catalog = useCatalog()
  const brand = catalog.data?.brandBySlug.get(slug)
  useDocumentTitle(brand?.name ?? 'Brand')

  if (slug === 'zobopop' || slug === 'creamypop') return <Navigate to={`/${slug}`} replace />
  if (catalog.isPending) return <PageLoader />
  if (catalog.isError) return <ErrorState className="min-h-[60vh]" error={catalog.error} onRetry={() => void catalog.refetch()} />
  if (!brand) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={Store}
        title="We couldn’t find that brand"
        description="It may not be on the menu right now."
        action={
          <Button asChild>
            <Link to="/order">See the menu</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div data-brand={brand.slug}>
      <section className="bg-surface-2 py-16 lg:py-24">
        <div className="container-page flex flex-col items-start gap-6">
          <BrandTile slug={brand.slug} size="lg" />
          <h1>
            <BrandWordmark slug={brand.slug} name={brand.name} logoUrl={brand.logo_url} size="hero" />
          </h1>
          {brand.tagline && <p className="font-display text-2xl font-bold text-brand-text">{brand.tagline}</p>}
          {brand.description && <p className="max-w-2xl text-lg text-ink-2">{brand.description}</p>}
        </div>
      </section>
      <div className="container-page space-y-20 py-16 lg:py-24">
        {brand.products.map((product, i) => (
          <ProductShowcase key={product.id} product={product} priority={i === 0} />
        ))}
      </div>
    </div>
  )
}
