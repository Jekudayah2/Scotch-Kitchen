import { ArrowRight, MapPin, Package, PackageCheck, PencilLine, Phone } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAccountSummary, useMyOrders } from '@/features/account/api'
import { EditProfileSheet } from '@/features/account/edit-profile-sheet'
import { OrderCard } from '@/features/account/order-card'
import { useAuth } from '@/features/auth/auth-provider'
import { isActiveOrder } from '@/features/orders/status'
import { useDocumentTitle } from '@/hooks/use-document-title'

function Stat({ icon: Icon, label, value, to }: { icon: typeof Package; label: string; value: number | undefined; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-card border border-line bg-surface p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:hover:translate-y-0 sm:p-5"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-soft text-primary-text">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        {value === undefined ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <span className="tabular block font-display text-2xl leading-none font-extrabold text-ink">{value}</span>
        )}
        <span className="mt-1 block text-sm font-semibold text-ink-3">{label}</span>
      </span>
    </Link>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function AccountHomePage() {
  useDocumentTitle('My account')
  const auth = useAuth()
  const summary = useAccountSummary()
  const orders = useMyOrders(12)
  const [editing, setEditing] = useState(false)

  const active = (orders.data ?? []).filter(isActiveOrder)
  const recent = (orders.data ?? []).filter((o) => !isActiveOrder(o)).slice(0, 3)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_1fr] lg:items-start lg:gap-10">
      <aside className="space-y-5 lg:sticky lg:top-24">
        <div className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar src={auth.profile?.avatar_url} name={auth.displayName} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-ink">{auth.displayName || 'Your account'}</p>
              <p className="truncate text-sm text-ink-3">{auth.user?.email}</p>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
            <Phone className="size-4 text-ink-3" aria-hidden="true" />
            {auth.profile?.phone || <span className="text-ink-3">No phone number yet</span>}
          </p>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setEditing(true)} leadingIcon={<PencilLine aria-hidden="true" />}>
            Edit details
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Stat icon={Package} label="Active orders" value={summary.data?.active_orders} to="/account/orders" />
          <Stat icon={PackageCheck} label="Delivered orders" value={summary.data?.completed_orders} to="/account/orders?tab=completed" />
          <Stat icon={MapPin} label="Saved places" value={summary.data?.saved_locations} to="/account/locations" />
        </div>
      </aside>

      <div className="space-y-10">
        {orders.isError ? (
          <ErrorState title="We couldn’t load your orders" error={orders.error} onRetry={() => void orders.refetch()} retrying={orders.isFetching} />
        ) : (
          <>
            <Section title="On the way">
              {orders.isPending ? (
                <Skeleton className="h-44 rounded-card" />
              ) : active.length === 0 ? (
                <div className="rounded-card border border-line bg-surface">
                  <EmptyState
                    compact
                    icon={Package}
                    title="No orders on the way"
                    description="When you order, you can follow it here from the kitchen to your door."
                    action={
                      <Button asChild trailingIcon={<ArrowRight aria-hidden="true" />}>
                        <Link to="/order">Order Now</Link>
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {active.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              )}
            </Section>

            {recent.length > 0 && (
              <Section
                title="Recent orders"
                action={
                  <Button asChild variant="ghost" size="sm" trailingIcon={<ArrowRight aria-hidden="true" />}>
                    <Link to="/account/orders?tab=all">All orders</Link>
                  </Button>
                }
              >
                <div className="space-y-4">
                  {recent.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>

      <EditProfileSheet open={editing} onOpenChange={setEditing} />
    </div>
  )
}
