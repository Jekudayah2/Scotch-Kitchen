import type { ComponentType } from 'react'
import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router'
import { PageLoader } from '@/components/ui/feedback'
import { RequireAuth } from '@/features/auth/guards'
import { AuthLayout } from '@/layouts/auth-layout'
import { PublicLayout } from '@/layouts/public/public-layout'
import { NotFoundPage, RouteErrorPage } from '@/pages/system-pages'

/** Route-level code splitting: each page is its own chunk. */
const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loader()).default })

function RootShell() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootShell />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        element: <PublicLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, lazy: page(() => import('@/pages/public/home-page')) },
          {
            element: (
              <RequireAuth>
                <Outlet />
              </RequireAuth>
            ),
            children: [],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        element: <AuthLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { path: 'sign-in', lazy: page(() => import('@/pages/auth/sign-in-page')) },
          { path: 'sign-up', lazy: page(() => import('@/pages/auth/sign-up-page')) },
          { path: 'forgot-password', lazy: page(() => import('@/pages/auth/forgot-password-page')) },
          { path: 'reset-password', lazy: page(() => import('@/pages/auth/reset-password-page')) },
          { path: 'auth/callback', lazy: page(() => import('@/pages/auth/auth-callback-page')) },
        ],
      },
    ],
  },
])
