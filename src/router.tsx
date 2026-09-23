import type { ComponentType } from 'react'
import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router'
import { PageLoader } from '@/components/ui/feedback'
import { RouteProgress } from '@/components/ui/route-progress'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { AccountLayout } from '@/layouts/account-layout'
import { AuthLayout } from '@/layouts/auth-layout'
import { PublicLayout } from '@/layouts/public/public-layout'
import { NotFoundPage, RouteErrorPage } from '@/pages/system-pages'

/** Route-level code splitting: each page is its own chunk. */
const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loader()).default })

function RootShell() {
  return (
    <>
      <ScrollRestoration />
      <RouteProgress />
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
          { path: 'zobopop', handle: { scene: 'wine' }, lazy: page(() => import('@/pages/public/zobopop-page')) },
          { path: 'creamypop', handle: { scene: 'cream' }, lazy: page(() => import('@/pages/public/creamypop-page')) },
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
              {
                path: 'account',
                element: <AccountLayout />,
                children: [
                  { index: true, lazy: page(() => import('@/pages/account/account-home-page')) },
                  { path: 'orders', lazy: page(() => import('@/pages/account/account-orders-page')) },
                  { path: 'locations', lazy: page(() => import('@/pages/account/saved-locations-page')) },
                  { path: 'notifications', lazy: page(() => import('@/pages/account/notifications-page')) },
                ],
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      // Operations HQ: its own shell, code-split so customers never download it.
      {
        path: 'admin',
        errorElement: <RouteErrorPage />,
        element: (
          <RequireRole role="ADMIN">
            <Outlet />
          </RequireRole>
        ),
        children: [
          {
            lazy: async () => ({ Component: (await import('@/layouts/admin/admin-layout')).AdminLayout }),
            children: [
              { index: true, lazy: page(() => import('@/pages/admin/overview-page')) },
              { path: 'orders', lazy: page(() => import('@/pages/admin/orders-page')) },
              { path: 'deliveries', lazy: page(() => import('@/pages/admin/deliveries-page')) },
              { path: 'products', lazy: page(() => import('@/pages/admin/products-page')) },
              { path: 'customers', lazy: page(() => import('@/pages/admin/customers-page')) },
              { path: 'riders', lazy: page(() => import('@/pages/admin/riders-page')) },
              { path: 'payments', lazy: page(() => import('@/pages/admin/payments-page')) },
              { path: 'analytics', lazy: page(() => import('@/pages/admin/analytics-page')) },
              { path: 'settings', lazy: page(() => import('@/pages/admin/settings-page')) },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
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
