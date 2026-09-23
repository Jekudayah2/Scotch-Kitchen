import { ArrowRight, UtensilsCrossed } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { BrandTile, BrandWordmark } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/feedback'
import { CartContents, CartTotals, MobileCartBar } from '@/features/cart/cart-ui'
import { useCart } from '@/features/cart/cart-provider'
import { useCatalog, useStoreSettings } from '@/features/products/queries'
import { VariantCard } from '@/features/products/variant-card'
import { SectionHeading } from '@/features/storefront/section-heading'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/utils/cn'

function OrderSidebar() {
  const cart = useCart()
  const navigate = useNavigate()
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-bold text-ink">Your order</h2>
      </div>
      <div className="max-h-[48vh] overflow-y-auto">
        <CartContents />
      </div>
      {cart.lines.length > 0 && (
        <div className="space-y-3 border-t border-line p-5">
          <CartTotals />
          <Button className="w-full" size="lg" disabled={cart.itemCount === 0} onClick={() => navigate('/checkout')} trailingIcon={<ArrowRight aria-hidden="true" />}>
            Checkout
          </Button>
        </div>
      )}
    </Card>
  )
}

export default function OrderPage() {
  useDocumentTitle('Order')
  const catalog = useCatalog()
  const settings = useStoreSettings()
  const [params, setParams] = useSearchParams()
  const filter = params.get('brand') ?? 'all'
  const brands = catalog.data?.brands ?? []
  const visible = filter === 'all' ? brands : brands.filter((b) => b.slug === filter)

  return (
    <div className="container-page py-10 lg:py-14">
      <SectionHeading
        as="h1"
        eyebrow="The menu"
        title="Order"
        description="Everything from the kitchen in one place. Add what you like, then drop your delivery pin at checkout."
      />

      {settings.data?.accepting_orders === false && (
        <Notice tone="warning" className="mt-8 max-w-2xl" title="We’re not taking orders right now">
          You can still add items to your cart. Checkout reopens as soon as the kitchen does.
        </Notice>
      )}

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by brand">
        {[{ slug: 'all', name: 'Everything' }, ...brands].map((b) => (
          <button
            key={b.slug}
            type="button"
            aria-pressed={filter === b.slug}
            onClick={() => setParams(b.slug === 'all' ? {} : { brand: b.slug }, { replace: true, preventScrollReset: true })}
            className={cn(
              'inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              filter === b.slug ? 'bg-ink text-canvas' : 'bg-surface text-ink-2 ring-1 ring-line hover:text-ink hover:ring-line-strong',
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
        <div className="space-y-16">
          {catalog.isPending ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[26rem] rounded-4xl" />
              ))}
            </div>
          ) : catalog.isError ? (
            <ErrorState title="We couldn’t load the menu" error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
          ) : visible.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="Nothing on the menu here yet" description="Check back soon." />
          ) : (
            visible.map((brand, brandIndex) => (
              <section key={brand.id} data-brand={brand.slug} aria-labelledby={`menu-${brand.slug}`}>
                <header className="flex items-center gap-4">
                  <BrandTile slug={brand.slug} size="sm" />
                  <div>
                    <h2 id={`menu-${brand.slug}`}>
                      <BrandWordmark slug={brand.slug} name={brand.name} logoUrl={brand.logo_url} size="md" />
                    </h2>
                    {brand.tagline && <p className="text-sm font-semibold text-ink-3">{brand.tagline}</p>}
                  </div>
                </header>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {brand.products
                    .flatMap((p) => p.variants)
                    .map((variant, i) => (
                      <VariantCard key={variant.id} variant={variant} priority={brandIndex === 0 && i < 2} />
                    ))}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="hidden lg:block" aria-label="Your order">
          <div className="sticky top-28">
            <OrderSidebar />
          </div>
        </aside>
      </div>
      <MobileCartBar />
    </div>
  )
}
