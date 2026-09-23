import { ArrowLeft, ArrowRight, LockKeyhole, ShoppingBag } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-provider'
import { CartLineItem, CartTotals } from '@/features/cart/cart-ui'
import { useCart } from '@/features/cart/cart-provider'
import { SectionHeading } from '@/features/storefront/section-heading'
import { useDocumentTitle } from '@/hooks/use-document-title'

export default function CartPage() {
  useDocumentTitle('Your cart')
  const cart = useCart()
  const { status } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="container-page py-10 lg:py-14">
      <SectionHeading as="h1" eyebrow="Checkout" title="Your cart" />

      {cart.isLoading && cart.lines.length > 0 ? (
        <div className="mt-10 grid gap-4 lg:max-w-2xl">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : cart.lines.length === 0 ? (
        <Card className="mt-10 max-w-2xl">
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Add ZOBOPOP or Creamypop from the menu to get started."
            action={
              <Button asChild>
                <Link to="/order">Browse the menu</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
          <Card className="p-5 sm:p-7">
            {cart.hasUnavailable && (
              <Notice tone="warning" className="mb-6" title="Some items can’t be ordered right now">
                They’re left out of your total. Remove them to continue tidily.
              </Notice>
            )}
            <ul className="space-y-6 divide-y divide-line [&>li:not(:first-child)]:pt-6">
              {cart.items.map((item) => (
                <CartLineItem key={item.line.variantId} item={item} />
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Button asChild variant="ghost" leadingIcon={<ArrowLeft aria-hidden="true" />}>
                <Link to="/order">Keep shopping</Link>
              </Button>
              <Button variant="ghost" className="text-ink-3" onClick={() => void cart.clear()}>
                Clear cart
              </Button>
            </div>
          </Card>

          <Card className="space-y-5 p-5 sm:p-7 lg:sticky lg:top-28">
            <h2 className="font-display text-xl font-bold text-ink">Summary</h2>
            <CartTotals />
            <Button
              size="xl"
              className="w-full"
              disabled={cart.itemCount === 0}
              onClick={() => navigate('/checkout')}
              trailingIcon={<ArrowRight aria-hidden="true" />}
            >
              {status === 'signed_in' ? 'Continue to checkout' : 'Sign in to check out'}
            </Button>
            <p className="flex items-center justify-center gap-2 text-xs font-medium text-ink-3">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              Prices are confirmed by the kitchen when you place your order.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
