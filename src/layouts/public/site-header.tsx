import { Bike, LayoutDashboard, LogOut, Menu as MenuIcon, Package, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useMatches } from 'react-router'
import { KitchenLogo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/auth-provider'
import { CartButton } from '@/features/cart/cart-ui'
import { ThemeToggle } from '@/features/theme/theme-toggle'
import { useScrolled } from '@/hooks/use-media'
import { cn } from '@/utils/cn'
import { AccountMenu, useSignOut } from './account-menu'
import { PRIMARY_NAV } from './nav-items'

/**
 * Transparent over the page at the top; after scrolling it becomes a compact
 * frosted bar (restrained blur, hairline border, soft shadow).
 */
/** Pages can ask for the header to share their hero's visual world (route `handle.scene`). */
function useRouteScene() {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const scene = (matches[i]?.handle as { scene?: 'wine' | 'cream' } | undefined)?.scene
    if (scene) return scene
  }
  return undefined
}

export function SiteHeader() {
  const scrolled = useScrolled(10)
  const routeScene = useRouteScene()
  const scene = scrolled ? undefined : routeScene
  const [menuOpen, setMenuOpen] = useState(false)
  const auth = useAuth()
  const handleSignOut = useSignOut()

  return (
    <header
      data-scene={scene}
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow] duration-300',
        scrolled ? 'glass-bar shadow-[0_1px_0_var(--line),0_14px_30px_-26px_rgb(var(--shadow-rgb)/0.5)]' : scene ? 'bg-canvas' : 'bg-transparent',
      )}
    >
      <div className={cn('container-page flex items-center gap-4 transition-[height] duration-300', scrolled ? 'h-16' : 'h-[4.5rem] lg:h-20')}>
        <Link
          to="/"
          className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          aria-label="SCOTCH’s Kitchen home"
        >
          <KitchenLogo className={cn('transition-[height] duration-300', scrolled ? 'h-9' : 'h-10 lg:h-12')} />
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden lg:block xl:ml-10">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
                {item.emphasis ? (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'mx-1.5 inline-flex h-10 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-ink shadow-soft',
                        'transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0 active:scale-[0.97]',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:hover:translate-y-0',
                        isActive && 'ring-2 ring-primary/35 ring-offset-2 ring-offset-canvas',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ) : (
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'relative inline-flex h-10 items-center rounded-lg px-3 text-[0.95rem] font-semibold transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                        "after:absolute after:bottom-0.5 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-red after:opacity-0 after:transition-opacity after:content-['']",
                        isActive ? 'text-ink after:opacity-100' : 'text-ink-2 hover:text-ink',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <ThemeToggle />
          <CartButton />
          <div className="hidden lg:block">
            <AccountMenu />
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu" width="sm">
        <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex h-12 items-center rounded-control px-4 text-base font-semibold',
                  isActive ? 'bg-primary-soft text-primary-text' : 'text-ink hover:bg-surface-2',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="my-2 h-px bg-line" />
          {auth.status === 'signed_in' ? (
            <>
              <MobileLink to="/account" icon={<UserRound />} onNavigate={() => setMenuOpen(false)}>
                My Account
              </MobileLink>
              <MobileLink to="/account/orders" icon={<Package />} onNavigate={() => setMenuOpen(false)}>
                My Orders
              </MobileLink>
              {auth.isAdmin && (
                <MobileLink to="/admin" icon={<LayoutDashboard />} onNavigate={() => setMenuOpen(false)}>
                  Admin Dashboard
                </MobileLink>
              )}
              {auth.isRider && (
                <MobileLink to="/rider" icon={<Bike />} onNavigate={() => setMenuOpen(false)}>
                  Rider Dashboard
                </MobileLink>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  void handleSignOut()
                }}
                className="flex h-12 items-center gap-3 rounded-control px-4 text-base font-semibold text-danger-text hover:bg-danger-soft"
              >
                <LogOut className="size-5" aria-hidden="true" />
                Sign Out
              </button>
            </>
          ) : (
            <MobileLink to="/sign-in" icon={<UserRound />} onNavigate={() => setMenuOpen(false)}>
              Sign in
            </MobileLink>
          )}
        </nav>
      </Sheet>
    </header>
  )
}

function MobileLink({ to, icon, children, onNavigate }: { to: string; icon: ReactNode; children: ReactNode; onNavigate: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex h-12 items-center gap-3 rounded-control px-4 text-base font-semibold text-ink hover:bg-surface-2 [&_svg]:size-5 [&_svg]:text-ink-3"
    >
      {icon}
      {children}
    </Link>
  )
}
