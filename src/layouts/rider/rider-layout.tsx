import { History, House, Map as MapIcon, Package, UserRound } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { KitchenMark } from '@/components/brand/logo'
import { useMyRiderProfile, useRiderLive, useRiderSummary } from '@/features/rider/api'
import { ThemeToggle } from '@/features/theme/theme-toggle'
import { cn } from '@/utils/cn'

const TABS = [
  { to: '/rider', label: 'Home', icon: House, end: true },
  { to: '/rider/deliveries', label: 'Deliveries', icon: Package },
  { to: '/rider/map', label: 'Map', icon: MapIcon },
  { to: '/rider/history', label: 'History', icon: History },
  { to: '/rider/account', label: 'Account', icon: UserRound },
]

const AVAILABILITY_DOT = { AVAILABLE: 'bg-success', BUSY: 'bg-warning', OFFLINE: 'bg-ink-3' } as const
const AVAILABILITY_LABEL = { AVAILABLE: 'Available', BUSY: 'Busy', OFFLINE: 'Offline' } as const

/** The rider app: one-handed, outdoor-readable, everything within thumb reach. */
export function RiderLayout() {
  useRiderLive()
  const profile = useMyRiderProfile()
  const summary = useRiderSummary()
  const availability = profile.data?.availability ?? 'OFFLINE'
  const waiting = summary.data ? summary.data.ready_for_pickup + summary.data.out_for_delivery : 0

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#rider-main"
        className="sr-only z-[60] rounded-control bg-ink px-4 py-2 text-sm font-semibold text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="glass-bar sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link to="/rider" aria-label="Rider home" className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <KitchenMark className="h-8" />
            <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-ink">Rider</span>
          </Link>
          <Link
            to="/rider/account"
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-full bg-surface px-3 text-sm font-semibold text-ink ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Availability: ${AVAILABILITY_LABEL[availability]}. Change it`}
          >
            <span className={cn('size-2.5 rounded-full', AVAILABILITY_DOT[availability])} aria-hidden="true" />
            {AVAILABILITY_LABEL[availability]}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="rider-main" className="mx-auto max-w-2xl px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav aria-label="Rider" className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold transition-colors',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                    isActive ? 'text-primary-text' : 'text-ink-3 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="size-5.5" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                    {label}
                    {to === '/rider/deliveries' && waiting > 0 && (
                      <span className="tabular absolute top-1.5 left-1/2 ml-2 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-red px-1 text-[0.62rem] font-bold text-white">
                        {waiting}
                        <span className="sr-only"> to do</span>
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
