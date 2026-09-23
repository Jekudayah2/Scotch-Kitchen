import { Outlet, useLocation } from 'react-router'
import { CartDrawer, FloatingOrderSummary } from '@/features/cart/cart-ui'
import { AnnouncementBar } from '@/features/storefront/announcement-bar'
import { cn } from '@/utils/cn'
import { FocusFooter, FocusHeader } from './focus-chrome'
import { MobileBottomNav } from './mobile-bottom-nav'
import { FOCUS_ROUTES } from './nav-items'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

export function PublicLayout() {
  const { pathname } = useLocation()
  const focused = FOCUS_ROUTES.some((route) => pathname.startsWith(route))
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[60] rounded-control bg-ink px-4 py-2 text-sm font-semibold text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {!focused && <AnnouncementBar />}
      {focused ? <FocusHeader /> : <SiteHeader />}
      <main id="main" className={cn('flex-1', !focused && 'pb-28 lg:pb-0')}>
        <Outlet />
      </main>
      {focused ? <FocusFooter /> : <SiteFooter />}
      <MobileBottomNav />
      <FloatingOrderSummary />
      <CartDrawer />
    </div>
  )
}
