import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const message = error instanceof Error ? error.message : String(error)
      // Don't show toast for 401s, auth layer usually handles redirects
      if (message.includes('401')) return
      // Don't show toast for notes queries (may fail for non-saved parcels)
      if (Array.isArray(query.queryKey) && query.queryKey[0] === 'favorite-notes') return
      console.error('[QueryCache] Failed query:', query.queryKey, error)
      toast.error(`Fout bij ophalen van gegevens: ${message}`)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(`Actie mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`)
    },
  }),
})
