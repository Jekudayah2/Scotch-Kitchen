import type { ReactNode } from 'react'
import { ErrorState } from '@/components/ui/feedback'
import { useCatalog } from '@/features/products/queries'
import { CreamypopFeature, ZobopopFeature } from '@/features/storefront/brand-features'
import { BrandPanels } from '@/features/storefront/brand-panels'
import { HomeHero } from '@/features/storefront/home-hero'
import { DeliverySection, OrderBand, WhySection } from '@/features/storefront/home-sections'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/utils/cn'

type RenderSheet = (className: string) => ReactNode

export default function HomePage() {
  useDocumentTitle(null)
  const catalog = useCatalog()
  const brands = catalog.data?.brands ?? []
  const loading = catalog.isPending

  // Brand worlds in catalog order, as stacked sheets: each slides over the one before.
  const worlds = brands.flatMap((brand): Array<{ id: string; render: RenderSheet }> => {
    if (brand.slug === 'zobopop') return [{ id: brand.id, render: (className) => <ZobopopFeature key={brand.id} brand={brand} className={className} /> }]
    if (brand.slug === 'creamypop') return [{ id: brand.id, render: (className) => <CreamypopFeature key={brand.id} brand={brand} className={className} /> }]
    return []
  })

  return (
    <>
      <HomeHero brands={brands} />
      {catalog.isError ? (
        <div className="container-page py-16">
          <ErrorState title="We couldn’t load the menu" error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
        </div>
      ) : (
        <>
          <BrandPanels brands={brands} loading={loading} />
          {worlds.map(({ render }, i) =>
            render(cn('scene-sheet', i > 0 && '-mt-8 sm:-mt-12', i === worlds.length - 1 && 'rounded-b-[2rem] sm:rounded-b-[3rem]')),
          )}
          <WhySection />
          <OrderBand variants={catalog.data?.variants ?? []} loading={loading} />
        </>
      )}
      <DeliverySection />
    </>
  )
}
