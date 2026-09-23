import { ShoppingBag } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { useCart } from '@/features/cart/cart-provider'
import { cn } from '@/utils/cn'
import { BOTTOM_NAV, FOCUS_ROUTES } from './nav-items'

/**
 * App-like floating navigation for phones: four destinations plus a cart
 * button within thumb reach. Clears the home indicator via safe-area insets.
 */
export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { itemCount, setDrawerOpen } = useCart()
  if (FOCUS_ROUTES.some((route) => pathname.startsWith(route))) return null

  return (
    <nav aria-label="Primary" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden">
      <div className="glass mx-auto flex max-w-md items-center gap-1.5 rounded-[1.4rem] p-1.5 shadow-float">
        <ul className="grid flex-1 grid-cols-4">
          {BOTTOM_NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-14 flex-col items-center justify-center gap-0.5 rounded-[1rem] text-[0.7rem] font-semibold transition-colors',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                    isActive ? 'bg-surface text-primary-text shadow-soft' : 'text-ink-3 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="relative grid size-14 shrink-0 place-items-center rounded-[1rem] bg-primary text-primary-ink shadow-soft transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={itemCount ? `Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Open cart, empty'}
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          {itemCount > 0 && (
            <span
              key={itemCount}
              className="tabular absolute -top-1 -right-1 grid h-5 min-w-5 animate-bump place-items-center rounded-full bg-red px-1 text-[0.68rem] font-bold text-white ring-2 ring-canvas motion-reduce:animate-none"
            >
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  )
}
