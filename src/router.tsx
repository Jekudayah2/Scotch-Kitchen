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
          { path: 'zobopop', lazy: page(() => import('@/pages/public/zobopop-page')) },
          { path: 'creamypop', lazy: page(() => import('@/pages/public/creamypop-page')) },
          { path: 'brands/:slug', lazy: page(() => import('@/pages/public/brand-page')) },
          { path: 'order', lazy: page(() => import('@/pages/public/order-page')) },
          { path: 'cart', lazy: page(() => import('@/pages/public/cart-page')) },
          { path: 'track-order', lazy: page(() => import('@/pages/orders/track-order-page')) },
          {
            element: (
              <RequireAuth>
                <Outlet />
              </RequireAuth>
            ),
            children: [
              { path: 'checkout', lazy: page(() => import('@/pages/checkout/checkout-page')) },
              { path: 'checkout/callback', lazy: page(() => import('@/pages/checkout/payment-callback-page')) },
              { path: 'track-order/:reference', lazy: page(() => import('@/pages/orders/order-detail-page')) },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      // Development-only Paystack stand-in for the QA preview (removed from production builds).
      ...(import.meta.env.DEV && import.meta.env.MODE === 'qa'
        ? [{ path: 'dev/paystack', lazy: page(() => import('@/dev/qa/paystack-simulator-page')) }]
        : []),
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
