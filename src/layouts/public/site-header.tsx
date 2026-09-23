import { Bike, LayoutDashboard, LogOut, Menu as MenuIcon, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { KitchenLogo } from '@/components/brand/brand-marks'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/auth-provider'
import { ThemeToggle } from '@/features/theme/theme-toggle'
import { cn } from '@/utils/cn'
import { AccountMenu, useSignOut } from './account-menu'
import { PRIMARY_NAV } from './nav-items'

export function SiteHeader({ cartSlot }: { cartSlot?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const auth = useAuth()
  const handleSignOut = useSignOut()

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-[color-mix(in_oklab,var(--canvas)_82%,transparent)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--canvas)_70%,transparent)]">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
        <Link to="/" className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label="SCOTCH’s Kitchen home">
          <KitchenLogo />
        </Link>

        <nav aria-label="Primary" className="glass hidden rounded-full p-1.5 shadow-soft lg:block">
          <ul className="flex items-center gap-0.5">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                      isActive ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <ThemeToggle />
          {cartSlot}
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
                  'flex h-12 items-center rounded-2xl px-4 text-base font-semibold',
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
                className="flex h-12 items-center gap-3 rounded-2xl px-4 text-base font-semibold text-danger-text hover:bg-danger-soft"
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
    <Link to={to} onClick={onNavigate} className="flex h-12 items-center gap-3 rounded-2xl px-4 text-base font-semibold text-ink hover:bg-surface-2 [&_svg]:size-5 [&_svg]:text-ink-3">
      {icon}
      {children}
    </Link>
  )
}
