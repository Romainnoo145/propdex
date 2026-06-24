import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchDakkapelReport } from '@/lib/reportsV2'

export function useDakkapelReport(parcelId: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery({
    queryKey: ['dakkapel-report', parcelId],
    queryFn: () => fetchDakkapelReport(parcelId as string, accessToken),
    enabled: !!parcelId,
    staleTime: 5 * 60 * 1000,
  })
}
