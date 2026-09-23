import { ErrorState } from '@/components/ui/feedback'
import { useCatalog } from '@/features/products/queries'
import {
  BrandsSection,
  CreamypopMenuSection,
  DeliveryInfoSection,
  GenericBrandSection,
  HomeHero,
  HowItWorksPanel,
  WhySection,
  ZobopopMenuSection,
} from '@/features/storefront/home-sections'
import { useDocumentTitle } from '@/hooks/use-document-title'

export default function HomePage() {
  useDocumentTitle(null)
  const catalog = useCatalog()
  const brands = catalog.data?.brands ?? []
  const loading = catalog.isPending

  return (
    <>
      <HomeHero brands={brands} loading={loading} />
      {catalog.isError ? (
        <ErrorState title="We couldn’t load the menu" error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
      ) : (
        <>
          <BrandsSection brands={brands} loading={loading} />
          {brands.map((brand) => {
            const product = brand.products[0]
            if (!product) return null
            if (brand.slug === 'zobopop') return <ZobopopMenuSection key={brand.id} brand={brand} product={product} />
            if (brand.slug === 'creamypop') return <CreamypopMenuSection key={brand.id} brand={brand} product={product} />
            return <GenericBrandSection key={brand.id} brand={brand} />
          })}
        </>
      )}
      <WhySection ingredients={catalog.data?.brandBySlug.get('zobopop')?.products[0]?.ingredients} />
      <HowItWorksPanel />
      <DeliveryInfoSection products={catalog.data?.products ?? []} />
    </>
  )
}
