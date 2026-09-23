import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { ErrorState, PageLoader } from '@/components/ui/feedback'
import type { AppRole } from '@/types/domain'
import { useAuth } from './auth-provider'

function useSignInRedirect() {
  const location = useLocation()
  return `/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`
}

/** Convenience guard for signed-in areas. RLS remains the real protection. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const signIn = useSignInRedirect()
  if (status === 'loading') return <PageLoader label="Checking your session" />
  if (status === 'signed_out') return <Navigate to={signIn} replace />
  return <>{children}</>
}

const ROLE_COPY: Record<AppRole, { area: string; description: string }> = {
  ADMIN: {
    area: 'SCOTCH’s Kitchen Admin',
    description: 'This area is for kitchen administrators. If you should have access, ask an existing admin to add you.',
  },
  RIDER: {
    area: 'SCOTCH’s Kitchen Rider',
    description: 'This area is for delivery riders. If you ride for SCOTCH’s Kitchen, ask an admin to add your account as a rider.',
  },
  CUSTOMER: { area: 'your account', description: 'Please sign in with a customer account.' },
}

export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const { status, roles, rolesLoaded, rolesError, refetchProfile } = useAuth()
  const signIn = useSignInRedirect()

  if (status === 'loading' || (status === 'signed_in' && !rolesLoaded)) return <PageLoader label="Checking your access" />
  if (status === 'signed_out') return <Navigate to={signIn} replace />
  if (rolesError && roles.length === 0) {
    return <ErrorState title="We couldn’t check your access" error={rolesError} onRetry={() => void refetchProfile()} className="min-h-[60vh]" />
  }
  if (!roles.includes(role)) {
    const copy = ROLE_COPY[role]
    return (
      <div className="container-page flex min-h-[70vh] flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning-text">
          <ShieldAlert className="size-7" aria-hidden="true" />
        </span>
        <h1 className="display-md">No access to {copy.area}</h1>
        <p className="max-w-md text-ink-3">{copy.description}</p>
        <Button asChild variant="secondary">
          <Link to="/">Back to the store</Link>
        </Button>
      </div>
    )
  }
  return <>{children}</>
}
