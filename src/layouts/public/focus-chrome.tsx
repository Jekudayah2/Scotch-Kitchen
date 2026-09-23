import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { KitchenLogo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/features/theme/theme-toggle'

/** Checkout and payment return: logo, reassurance and one way back. Nothing else competes. */
export function FocusHeader() {
  const { pathname } = useLocation()
  const inCheckout = pathname === '/checkout'
  return (
    <header className="border-b border-line bg-canvas">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link
          to="/"
          aria-label="SCOTCH’s Kitchen home"
          className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <KitchenLogo className="h-9" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="mr-2 hidden items-center gap-1.5 text-sm font-semibold text-ink-3 md:inline-flex">
            <LockKeyhole className="size-4" aria-hidden="true" />
            Secure checkout
          </span>
          <ThemeToggle />
          {inCheckout && (
            <Button asChild variant="ghost" size="sm" leadingIcon={<ArrowLeft aria-hidden="true" />}>
              <Link to="/cart">Back to bag</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

export function FocusFooter() {
  return (
    <footer className="border-t border-line">
      <p className="container-page py-6 text-center text-xs text-ink-3">
        Secure payment powered by Paystack · © {new Date().getFullYear()} SCOTCH’s Kitchen
      </p>
    </footer>
  )
}
