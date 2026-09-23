import {
  ArrowLeft,
  Bike,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Package,
  ReceiptText,
  Search,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { KitchenLogo } from '@/components/brand/logo'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Input } from '@/components/ui/field'
import { useAdminLiveOrders, useAdminOverview } from '@/features/admin/api'
import { useAuth } from '@/features/auth/auth-provider'
import { ThemeToggle } from '@/features/theme/theme-toggle'
import { useSignOut } from '@/layouts/public/account-menu'
import { cn } from '@/utils/cn'

interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  count?: (o: NonNullable<ReturnType<typeof useAdminOverview>['data']>) => number
}

const NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText, count: (o) => o.paid },
  { to: '/admin/deliveries', label: 'Deliveries', icon: Bike, count: (o) => o.out_for_delivery },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/riders', label: 'Riders', icon: UserCog },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/analytics', label: 'Analytics', icon: ChartColumn },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const overview = useAdminOverview()
  return (
    <nav aria-label="Admin" className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end, count }) => {
        const n = count && overview.data ? count(overview.data) : 0
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex h-11 items-center gap-3 rounded-control px-3 text-[0.95rem] font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                isActive ? 'bg-surface-2 text-ink shadow-[inset_2px_0_0_var(--red)]' : 'text-ink-3 hover:bg-surface hover:text-ink',
              )
            }
          >
            <Icon className="size-[1.15rem] shrink-0" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {n > 0 && (
              <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-red px-1.5 text-[0.7rem] font-bold text-white">
                {n > 99 ? '99+' : n}
                <span className="sr-only"> waiting</span>
              </span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

function SidebarFooter() {
  const auth = useAuth()
  const signOut = useSignOut()
  return (
    <div className="space-y-2 border-t border-line pt-4">
      <div className="flex items-center gap-3 px-1">
        <Avatar src={auth.profile?.avatar_url} name={auth.displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{auth.displayName}</p>
          <p className="truncate text-xs text-ink-3">{auth.isRider ? 'Admin · Rider' : 'Admin'}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <Button asChild variant="ghost" size="sm" className="flex-1 justify-start text-ink-2" leadingIcon={<ArrowLeft aria-hidden="true" />}>
          <Link to="/">Store</Link>
        </Button>
        {auth.isRider && (
          <Button asChild variant="ghost" size="sm" className="flex-1 justify-start text-ink-2" leadingIcon={<Bike aria-hidden="true" />}>
            <Link to="/rider">Rider app</Link>
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" className="text-ink-2" aria-label="Sign out" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

function OrderSearch({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const term = value.trim()
    navigate(term ? `/admin/orders?filter=all&q=${encodeURIComponent(term)}` : '/admin/orders')
  }
  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <label htmlFor="admin-search" className="sr-only">
        Search orders by reference, customer, phone or item
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <Input id="admin-search" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search orders, customers, phones" className="h-10 pl-9" />
    </form>
  )
}

/** SCOTCH's Kitchen operations HQ. RequireRole guards it in the router; RLS guards the data. */
export function AdminLayout() {
  useAdminLiveOrders('layout')
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[16.5rem_1fr]">
      <a
        href="#admin-main"
        className="sr-only z-[60] rounded-control bg-ink px-4 py-2 text-sm font-semibold text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside data-scene="wine" className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto bg-canvas px-4 py-5 lg:flex">
        <Link to="/admin" aria-label="SCOTCH’s Kitchen admin home" className="rounded-xl px-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <KitchenLogo className="h-10" />
        </Link>
        <p className="eyebrow -mt-2 px-1 text-ink-3">Operations</p>
        <div className="flex-1">
          <NavList />
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="glass-bar sticky top-0 z-30 border-b border-line">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open admin menu" onClick={() => setMenuOpen(true)}>
              <MenuIcon aria-hidden="true" />
            </Button>
            <Link to="/admin" aria-label="Admin home" className="lg:hidden">
              <KitchenLogo className="h-8" />
            </Link>
            <OrderSearch className="ml-auto hidden w-full max-w-md md:block lg:ml-0" />
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success-text sm:inline-flex">
                <span className="relative flex size-2" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Live
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="admin-main" key={pathname.split('/')[2] ?? 'overview'} className="flex-1 animate-fade-in px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <OrderSearch className="mb-5 md:hidden" />
          <Outlet />
        </main>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Admin" side="right" width="sm" className="data-[scene]:bg-canvas">
        <div data-scene="wine" className="flex min-h-full flex-col gap-6 bg-canvas p-4">
          <NavList onNavigate={() => setMenuOpen(false)} />
          <SidebarFooter />
        </div>
      </Sheet>
    </div>
  )
}
