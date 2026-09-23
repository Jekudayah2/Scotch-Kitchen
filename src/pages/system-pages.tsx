import { Compass, RotateCw, ServerCog } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { KitchenLogo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { missingEnv } from '@/config/env'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <section className="container-page relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden py-20 text-center">
      <p aria-hidden="true" className="display-campaign pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(10rem,6rem+20vw,20rem)] text-ink/[0.05] select-none">
        404
      </p>
      <span className="relative grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-text">
        <Compass className="size-7" aria-hidden="true" />
      </span>
      <h1 className="display-lg relative mt-6">
        This page wandered off<span className="text-primary-text">.</span>
      </h1>
      <p className="relative mt-4 max-w-md text-ink-3">The link may be old or mistyped. The menu is still right where you left it.</p>
      <div className="relative mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/order">Browse Products</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </section>
  )
}

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(message)
}

/** Route-level error boundary. Never shows stack traces to customers. */
export function RouteErrorPage() {
  const error = useRouteError()
  useDocumentTitle('Something went wrong')

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  const updated = isChunkLoadError(error)
  if (import.meta.env.DEV) console.error(error)

  return (
    <section className="container-page flex min-h-dvh flex-col items-center justify-center gap-5 py-20 text-center">
      <KitchenLogo variant="stacked" label="SCOTCH’s Kitchen" className="h-28" />
      <h1 className="display-md mt-4">{updated ? 'A newer version is available.' : 'Something went wrong.'}</h1>
      <p className="max-w-md text-ink-3">
        {updated ? 'SCOTCH’s Kitchen was just updated. Reload to get the latest version.' : 'Please reload the page. If it keeps happening, try again in a few minutes.'}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()} leadingIcon={<RotateCw aria-hidden="true" />}>
          Reload
        </Button>
        <Button asChild variant="secondary">
          <a href="/">Back home</a>
        </Button>
      </div>
    </section>
  )
}

/** Shown when the deployment is missing its public Supabase configuration. */
export function SetupRequiredPage() {
  return (
    <main className="container-page flex min-h-dvh flex-col items-center justify-center gap-6 py-16 text-center">
      <KitchenLogo variant="stacked" label="SCOTCH’s Kitchen" className="h-28" />
      <span className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning-text">
        <ServerCog className="size-7" aria-hidden="true" />
      </span>
      <h1 className="display-md">Connect Supabase to continue</h1>
      <p className="max-w-lg text-ink-3">
        This deployment is missing its public Supabase settings. Copy <code className="font-mono text-sm">.env.example</code> to{' '}
        <code className="font-mono text-sm">.env.local</code>, fill in the values below, and restart the app. See the README for step-by-step setup.
      </p>
      <ul className="w-full max-w-md space-y-2 text-left">
        {missingEnv.map((name) => (
          <li key={name} className="rounded-2xl border border-line bg-surface px-4 py-3 font-mono text-sm text-ink">
            {name}
          </li>
        ))}
      </ul>
    </main>
  )
}
