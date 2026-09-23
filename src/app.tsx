import { QueryClientProvider } from '@tanstack/react-query'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { isSupabaseConfigured } from '@/config/env'
import { AuthProvider } from '@/features/auth/auth-provider'
import { CartProvider } from '@/features/cart/cart-provider'
import { ThemeProvider, useTheme } from '@/features/theme/theme-provider'
import { queryClient } from '@/lib/query-client'
import { SetupRequiredPage } from '@/pages/system-pages'
import { router } from '@/router'

function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: 'font-sans rounded-2xl' } }}
    />
  )
}

export function App() {
  if (!isSupabaseConfigured) {
    return (
      <ThemeProvider>
        <SetupRequiredPage />
      </ThemeProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            {/* Lean motion bundle (m.* components only); transforms are dropped for reduced-motion users. */}
            <LazyMotion features={domAnimation} strict>
              <MotionConfig reducedMotion="user">
                <RouterProvider router={router} />
              </MotionConfig>
            </LazyMotion>
            <ThemedToaster />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
