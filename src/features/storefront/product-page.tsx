import { Store, type LucideIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import type { CatalogBrand, CatalogProduct, CatalogVariant } from '@/features/products/catalog'
import { cn } from '@/utils/cn'
import { BrandPanel } from './brand-panels'
import { Reveal } from './motion'

/**
 * The selected size/flavour lives in the URL (?variant=zp-500), so a product
 * link can point at a specific option and Back behaves as expected.
 */
export function useSelectedVariant(product: CatalogProduct | undefined): [CatalogVariant | undefined, (variantId: string) => void] {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('variant')?.toLowerCase()
  const variants = product?.variants ?? []
  const selected =
    variants.find((v) => v.sku.toLowerCase() === wanted) ?? variants.find((v) => v.orderable) ?? variants[0]

  const select = (variantId: string) => {
    const next = variants.find((v) => v.id === variantId)
    if (!next) return
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        updated.set('variant', next.sku.toLowerCase())
        return updated
      },
      { replace: true, preventScrollReset: true },
    )
  }
  return [selected, select]
}

/** Short facts printed on the official packaging, shown as quiet chips. */
export function PackagingFacts({ facts, className }: { facts: Array<{ icon: LucideIcon; label: string }>; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {facts.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-3.5 text-sm font-semibold text-ink-2">
          <Icon className="size-4 text-brand-text" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  )
}

/** "Also from SCOTCH's Kitchen": the other brands, as panels. */
export function CrossSell({ brands }: { brands: CatalogBrand[] }) {
  if (brands.length === 0) return null
  return (
    <section aria-labelledby="cross-sell-title" className="container-page py-16 sm:py-20 lg:py-24">
      <Reveal>
        <p className="eyebrow text-primary-text">Also from SCOTCH’s Kitchen</p>
        <h2 id="cross-sell-title" className="display-md mt-3 text-ink">
          Complete your order
        </h2>
      </Reveal>
      <div className={cn('mt-8 grid gap-5', brands.length > 1 && 'lg:grid-cols-2')}>
        {brands.map((brand) => (
          <Reveal key={brand.id}>
            <BrandPanel brand={brand} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export function ProductPageSkeleton({ scene }: { scene?: 'wine' | 'cream' }) {
  return (
    <div data-scene={scene} className="bg-canvas">
      <div className="container-page grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20" aria-busy="true" aria-label="Loading">
        <Skeleton className="mx-auto aspect-[4/5] w-full max-w-md rounded-media" />
        <div className="space-y-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-3/4" />
          <Skeleton className="h-6 w-2/3" />
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Skeleton className="h-20 rounded-[1rem]" />
            <Skeleton className="h-20 rounded-[1rem]" />
          </div>
          <Skeleton className="h-14 w-full rounded-[0.875rem]" />
        </div>
      </div>
    </div>
  )
}

export function BrandUnavailable() {
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={Store}
      title="This brand isn’t on the menu right now"
      description="Have a look at what we’re serving today."
      action={
        <Button asChild>
          <Link to="/order">Browse Products</Link>
        </Button>
      }
    />
  )
}
