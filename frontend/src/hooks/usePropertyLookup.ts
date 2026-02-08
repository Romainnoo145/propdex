/**
 * Property lookup mutation hook using TanStack Query
 *
 * Wraps POST /api/properties/lookup with mutation pattern.
 * Automatically caches result by address ID for future lookups.
 *
 * Features:
 * - Mutation pattern for user-triggered lookups
 * - Automatic cache population by nummeraanduiding_id
 * - Error handling with typed Error response
 * - Integration with authenticated API client
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { lookupProperty } from '@/lib/api'
import type { AddressInput, PropertyReportResponse } from '@/lib/types/property'

export function usePropertyLookup() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<PropertyReportResponse, Error, AddressInput>({
    mutationFn: async (input: AddressInput) => {
      return lookupProperty(input, accessToken)
    },
    onSuccess: (data) => {
      // Cache the report by address ID for future lookups
      // This allows instant loading if user navigates back to same address
      queryClient.setQueryData(
        ['property', data.address.nummeraanduiding_id],
        data
      )
    },
  })
}
