import { ArrowLeft, LayoutDashboard, LogOut, Phone } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-provider'
import { AvailabilityControl } from '@/features/rider/components'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useSignOut } from '@/layouts/public/account-menu'

export default function RiderAccountPage() {
  useDocumentTitle('Rider account')
  const auth = useAuth()
  const signOut = useSignOut()
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-ink">Account</h1>
      <section className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
        <Avatar src={auth.profile?.avatar_url} name={auth.displayName} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-ink">{auth.displayName}</p>
          <p className="truncate text-sm text-ink-3">{auth.user?.email}</p>
          {auth.profile?.phone && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-2">
              <Phone className="size-3.5" aria-hidden="true" />
              {auth.profile.phone}
            </p>
          )}
        </div>
      </section>
      <section aria-label="Availability" className="space-y-2 rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold text-ink">Availability</h2>
        <AvailabilityControl />
        <p className="text-xs text-ink-3">Go Offline when you finish for the day, so the kitchen doesn’t assign you new drops.</p>
      </section>
      <div className="grid gap-2">
        {auth.isAdmin && (
          <Button asChild variant="secondary" size="lg" leadingIcon={<LayoutDashboard aria-hidden="true" />}>
            <Link to="/admin">Admin dashboard</Link>
          </Button>
        )}
        <Button asChild variant="secondary" size="lg" leadingIcon={<ArrowLeft aria-hidden="true" />}>
          <Link to="/">Back to the store</Link>
        </Button>
        <Button variant="danger-soft" size="lg" onClick={() => void signOut()} leadingIcon={<LogOut aria-hidden="true" />}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
