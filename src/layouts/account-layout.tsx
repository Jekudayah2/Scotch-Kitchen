import { Bell, LayoutGrid, MapPin, Package } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useNotifications } from '@/features/account/api'
import { useAuth } from '@/features/auth/auth-provider'
import { cn } from '@/utils/cn'

const ACCOUNT_NAV = [
  { to: '/account', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/account/orders', label: 'Orders', icon: Package },
  { to: '/account/locations', label: 'Saved places', icon: MapPin },
  { to: '/account/notifications', label: 'Notifications', icon: Bell },
]

/** "My SCOTCH's Kitchen": the customer's own space. */
export function AccountLayout() {
  const auth = useAuth()
  const notifications = useNotifications()
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0

  return (
    <div className="container-page pt-6 pb-16 sm:pt-10 lg:pb-24">
      <header>
        <p className="eyebrow text-primary-text">{auth.firstName ? `Hi, ${auth.firstName}` : 'Welcome'}</p>
        <h1 className="display-lg mt-3 text-ink">My SCOTCH’s Kitchen</h1>
        <p className="mt-2 text-lg text-ink-2">Your kitchen orders, all in one place.</p>
      </header>

      <nav aria-label="Account" className="scrollbar-none -mx-4 mt-7 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-[1rem] bg-surface-2 p-1 ring-1 ring-line">
          {ACCOUNT_NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-10 items-center gap-2 rounded-[0.8rem] px-4 text-sm font-semibold transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                    isActive ? 'bg-surface text-ink shadow-soft' : 'text-ink-3 hover:text-ink',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {to === '/account/notifications' && unread > 0 && (
                  <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-red px-1 text-[0.68rem] font-bold text-white">
                    <span className="sr-only">, </span>
                    {unread > 9 ? '9+' : unread}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  )
}
