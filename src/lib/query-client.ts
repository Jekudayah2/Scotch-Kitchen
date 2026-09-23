import { QueryClient } from '@tanstack/react-query'
import { isPermissionError } from '@/utils/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => failureCount < 2 && !isPermissionError(error),
    },
    mutations: {
      retry: 0,
    },
  },
})
