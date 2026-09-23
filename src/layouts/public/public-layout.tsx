import { Outlet } from 'react-router'
import { MobileBottomNav } from './mobile-bottom-nav'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-sm font-semibold text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1 pb-24 lg:pb-0">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileBottomNav />
    </div>
  )
}
