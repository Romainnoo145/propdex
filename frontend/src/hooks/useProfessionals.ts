/**
 * TanStack Query hook for professionals (kwaliteitsborgers) directory
 *
 * Query key: ['professionals', filters]
 * Stale time: 10 minutes — directory changes rarely
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchProfessionals } from '@/lib/api'
import type { ProfessionalFilters, ProfessionalListResponse } from '@/lib/types/professional'

/**
 * Fetch professionals directory with optional gemeente and gevolgklasse filters
 *
 * @param filters - Optional gemeente text and gevolgklasse (GK1/GK2/GK3) filters
 */
export function useProfessionals(filters: ProfessionalFilters = {}) {
  const { accessToken } = useAuth()

  return useQuery<ProfessionalListResponse, Error>({
    queryKey: ['professionals', filters],
    queryFn: () => fetchProfessionals(filters, accessToken),
    staleTime: 10 * 60 * 1000, // 10 min — directory changes rarely
    enabled: !!accessToken,
  })
}
