import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, PageLoader } from '@/components/ui/feedback'
import { safeNextPath } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-provider'
import { useDocumentTitle } from '@/hooks/use-document-title'

function readProviderError(params: URLSearchParams) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('error_description') ?? hash.get('error_description') ?? params.get('error') ?? hash.get('error')
}

/**
 * Landing page for Google OAuth and email-confirmation links. Supabase exchanges
 * the PKCE code automatically; we wait for the session, then continue.
 */
export default function AuthCallbackPage() {
  useDocumentTitle('Signing you in')
  const [params] = useSearchParams()
  const { status } = useAuth()
  const [timedOut, setTimedOut] = useState(false)
  const providerError = readProviderError(params)
  const next = safeNextPath(params.get('next'))

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(timer)
  }, [])

  if (status === 'signed_in') return <Navigate to={next} replace />

  if (providerError || (timedOut && status === 'signed_out')) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="We couldn’t finish signing you in"
        description={providerError ? providerError.replace(/\+/g, ' ') : 'The sign-in link may have expired or already been used.'}
        action={
          <Button asChild>
            <Link to="/sign-in">Try again</Link>
          </Button>
        }
      />
    )
  }

  return <PageLoader label="Signing you in" />
}
