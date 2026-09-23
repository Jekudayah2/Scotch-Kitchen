import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { isSupabaseConfigured } from '@/config/env'
import { AuthProvider } from '@/features/auth/auth-provider'
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
          <RouterProvider router={router} />
          <ThemedToaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
