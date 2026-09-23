import { ArrowRight, ShieldCheck, UtensilsCrossed } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BrandWordmark } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/feedback'
import { CartContents, CartTotals } from '@/features/cart/cart-ui'
import { useCart } from '@/features/cart/cart-provider'
import { useCatalog, useStoreSettings } from '@/features/products/queries'
import { ProductCard } from '@/features/products/variant-card'
import { brandPath } from '@/features/storefront/brand-panels'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useKeyboardOpen } from '@/hooks/use-media'
import { cn } from '@/utils/cn'
import { formatCedis } from '@/utils/money'

function OrderSummary() {
  const cart = useCart()
  const navigate = useNavigate()
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-bold text-ink">Your order</h2>
        {cart.itemCount > 0 && (
          <span className="text-sm font-semibold text-ink-3">
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>
      <div className="max-h-[46vh] overflow-y-auto">
        <CartContents emptyAction={false} />
      </div>
      {cart.lines.length > 0 && (
        <div className="space-y-4 border-t border-line p-5">
          <CartTotals />
          <Button
            className="w-full"
            size="lg"
            disabled={cart.itemCount === 0}
            onClick={() => navigate('/checkout')}
            trailingIcon={<ArrowRight aria-hidden="true" />}
          >
            Continue to Checkout
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-ink-3">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Secure payment powered by Paystack
          </p>
        </div>
      )}
    </div>
  )
}

/** Phones: a floating summary just above the bottom navigation while the bag has items. */
function MobileOrderBar() {
  const { itemCount, subtotal, setDrawerOpen } = useCart()
  const keyboardOpen = useKeyboardOpen()
  if (!itemCount || keyboardOpen) return null
  return (
    <div className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.25rem)] z-30 animate-rise-in lg:hidden">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="glass mx-auto flex h-14 w-full max-w-md items-center justify-between gap-3 rounded-[1.1rem] pr-2 pl-4 shadow-float transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="text-left leading-tight">
          <span className="block text-sm font-bold text-ink">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} in your bag
          </span>
          <span className="tabular block text-xs font-semibold text-ink-3">Subtotal {formatCedis(subtotal)}</span>
        </span>
        <span className="inline-flex h-10 items-center gap-1.5 rounded-[0.75rem] bg-primary px-4 text-sm font-semibold text-primary-ink">
          View bag
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </button>
    </div>
  )
}

export default function OrderPage() {
  useDocumentTitle('Order')
  const catalog = useCatalog()
  const settings = useStoreSettings()
  const [params, setParams] = useSearchParams()
  const brands = catalog.data?.brands ?? []
  const requested = params.get('brand')
  const filter = requested && brands.some((b) => b.slug === requested) ? requested : 'all'
  const visible = filter === 'all' ? brands : brands.filter((b) => b.slug === filter)

  return (
    <div className="container-page pt-6 pb-16 sm:pt-10 lg:pb-24">
      <header className="max-w-2xl">
        <p className="eyebrow text-primary-text">SCOTCH’s Kitchen</p>
        <h1 className="display-lg mt-3 text-ink">Order</h1>
        <p className="mt-3 text-lg text-ink-2">Choose your drinks and treats. You’ll drop your delivery pin at checkout.</p>
      </header>

      {settings.data?.accepting_orders === false && (
        <Notice tone="warning" className="mt-6 max-w-2xl" title="We’re not taking orders right now">
          You can still fill your bag. Checkout reopens as soon as the kitchen does.
        </Notice>
      )}

      {brands.length > 1 && (
        <div className="scrollbar-none -mx-4 mt-7 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter by brand">
          {[{ slug: 'all', name: 'Everything' }, ...brands].map((b) => (
            <button
              key={b.slug}
              type="button"
              aria-pressed={filter === b.slug}
              onClick={() => setParams(b.slug === 'all' ? {} : { brand: b.slug }, { replace: true, preventScrollReset: true })}
              className={cn(
                'inline-flex h-11 shrink-0 items-center rounded-control px-5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                filter === b.slug ? 'bg-ink text-canvas shadow-soft' : 'bg-surface text-ink-2 ring-1 ring-line hover:text-ink hover:ring-line-strong',
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
        <div className="space-y-14">
          {catalog.isPending ? (
            <div className="grid gap-5 sm:grid-cols-2" aria-busy="true" aria-label="Loading the menu">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[25rem] rounded-card" />
              ))}
            </div>
          ) : catalog.isError ? (
            <ErrorState title="We couldn’t load the menu" error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
          ) : visible.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="Nothing on the menu right now" description="Please check back soon." />
          ) : (
            visible.map((brand, brandIndex) => (
              <section key={brand.id} data-brand={brand.slug} aria-labelledby={`menu-${brand.slug}`}>
                <header className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id={`menu-${brand.slug}`}>
                      <BrandWordmark slug={brand.slug} name={brand.name} logoUrl={brand.logo_url} size="md" />
                    </h2>
                    {brand.tagline && <p className="mt-1 text-sm font-semibold text-ink-3">{brand.tagline}</p>}
                  </div>
                  <Link
                    to={brandPath(brand.slug)}
                    className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    About {brand.name}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </header>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {brand.products
                    .flatMap((p) => p.variants)
                    .map((variant, i) => (
                      <ProductCard key={variant.id} variant={variant} priority={brandIndex === 0 && i < 2} />
                    ))}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="hidden lg:block" aria-label="Your order">
          <div className="sticky top-24">
            <OrderSummary />
          </div>
        </aside>
      </div>
      <MobileOrderBar />
    </div>
  )
}
