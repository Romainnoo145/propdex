import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchSplitsingReport } from '@/lib/reportsV2'

export function useSplitsingReport(parcelId: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery({
    queryKey: ['splitsing-report', parcelId],
    queryFn: () => fetchSplitsingReport(parcelId as string, accessToken),
    enabled: !!parcelId,
    staleTime: 5 * 60 * 1000,
  })
}
