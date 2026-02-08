/**
 * Debounced address suggest hook using TanStack Query
 *
 * Automatically debounces user input by 300ms and fetches suggestions
 * from PDOK Locatieserver when query is 3+ characters.
 *
 * Features:
 * - 300ms debounce to reduce API calls during typing
 * - Minimum 3 characters before API call
 * - Automatic cancellation of in-flight requests when query changes
 * - 30s stale time (suggests don't change frequently)
 */

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { suggestAddresses } from '@/lib/api'
import type { SuggestResult } from '@/lib/types/property'

export function useAddressSuggest(query: string) {
  // Internal state for debounced query
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce effect: 300ms delay before updating debouncedQuery
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Get access token from auth context
  const { accessToken } = useAuth()

  // TanStack Query with automatic cancellation support
  return useQuery<SuggestResult[], Error>({
    queryKey: ['address-suggest', debouncedQuery],
    queryFn: async ({ signal }) => {
      return suggestAddresses(debouncedQuery, accessToken, signal)
    },
    enabled: debouncedQuery.length >= 3,
    staleTime: 30_000, // 30 seconds - suggests don't change often
  })
}
