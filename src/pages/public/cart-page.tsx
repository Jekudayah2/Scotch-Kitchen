import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-provider'
import { CartLineItem, CartTotals, EmptyBag } from '@/features/cart/cart-ui'
import { useCart } from '@/features/cart/cart-provider'
import { useDocumentTitle } from '@/hooks/use-document-title'

export default function CartPage() {
  useDocumentTitle('Your bag')
  const cart = useCart()
  const { status } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="container-page pt-6 pb-16 sm:pt-10 lg:pb-24">
      <header>
        <p className="eyebrow text-primary-text">Your order</p>
        <h1 className="display-lg mt-3 text-ink">Your kitchen bag</h1>
      </header>

      {cart.isLoading && cart.lines.length > 0 ? (
        <div className="mt-8 grid gap-4 lg:max-w-2xl" aria-busy="true" aria-label="Loading your bag">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : cart.lines.length === 0 ? (
        <div className="mt-8 max-w-2xl rounded-card border border-line bg-surface">
          <EmptyBag />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-8">
          <div className="rounded-card border border-line bg-surface p-5 sm:p-7">
            {cart.hasUnavailable && (
              <Notice tone="warning" className="mb-6" title="Some items can’t be ordered right now">
                They’re left out of your total. Remove them to tidy up your bag.
              </Notice>
            )}
            <ul className="divide-y divide-line [&>li]:py-5 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">
              {cart.items.map((item) => (
                <CartLineItem key={item.line.variantId} item={item} />
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Button asChild variant="ghost" leadingIcon={<ArrowLeft aria-hidden="true" />}>
                <Link to="/order">Keep shopping</Link>
              </Button>
              <Button variant="ghost" className="text-ink-3" onClick={() => void cart.clear()}>
                Empty bag
              </Button>
            </div>
          </div>

          <div className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-soft sm:p-7 lg:sticky lg:top-24">
            <h2 className="font-display text-xl font-bold text-ink">Summary</h2>
            <CartTotals />
            <Button
              size="xl"
              className="w-full"
              disabled={cart.itemCount === 0}
              onClick={() => navigate('/checkout')}
              trailingIcon={<ArrowRight aria-hidden="true" />}
            >
              {status === 'signed_in' ? 'Continue to Checkout' : 'Sign in to Check Out'}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-ink-3">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Secure payment powered by Paystack
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
