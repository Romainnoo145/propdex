import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
    searchJurisprudence,
    getJurisprudenceDoc,
    getGemeenteRulingsFeed,
    triggerJurisprudenceAnalysis,
    pollJurisprudenceAnalysis,
    type JurisprudenceResult,
    type JurisprudenceDocument,
    type JurisprudenceAnalysisResponse,
    type GemeenteRulingsFeedResponse,
} from '@/lib/api'

export function useJurisprudenceSearch(query: string, enabled = true) {
    const { accessToken } = useAuth()

    return useQuery<{ status: string; results: JurisprudenceResult[] }, Error>({
        queryKey: ['jurisprudence', 'search', query],
        queryFn: async () => {
            if (!query.trim()) return { status: 'empty', results: [] }
            return searchJurisprudence(query, accessToken!, 25)
        },
        enabled: !!accessToken && enabled && query.trim().length > 3,
        staleTime: 5 * 60 * 1000, // 5 min cache
        retry: 1, // Only retry once since rate limits are tight
    })
}

export function useGemeenteRulingsFeed(gemeenteNaam: string) {
    const { accessToken } = useAuth()

    return useQuery<GemeenteRulingsFeedResponse, Error>({
        queryKey: ['jurisprudence', 'feed', gemeenteNaam],
        queryFn: () => getGemeenteRulingsFeed(gemeenteNaam, accessToken),
        enabled: !!accessToken && gemeenteNaam.length > 0,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    })
}

export function useJurisprudenceDoc(ecli: string | null) {
    const { accessToken } = useAuth()

    return useQuery<{ status: string; document: JurisprudenceDocument }, Error>({
        queryKey: ['jurisprudence', 'doc', ecli],
        queryFn: async () => {
            if (!ecli) throw new Error('ECLI is required')
            return getJurisprudenceDoc(ecli, accessToken!)
        },
        enabled: !!accessToken && !!ecli,
        staleTime: 60 * 60 * 1000, // 1 hour cache, documents don't change
        retry: 1,
    })
}

/**
 * Poll an AI jurisprudence analysis job for completion.
 *
 * Polls every 3s while status is queued/in_progress.
 * Stops polling on complete/failed or when jobId is null.
 */
export function useJurisprudenceAnalysis(jobId: string | null) {
    const { accessToken } = useAuth()

    return useQuery<JurisprudenceAnalysisResponse, Error>({
        queryKey: ['jurisprudence-analysis', jobId],
        queryFn: () => pollJurisprudenceAnalysis(jobId!, accessToken),
        enabled: !!jobId && !!accessToken,
        refetchInterval: (query) => {
            if (query.state.error) return false
            const status = query.state.data?.status
            if (status === 'complete' || status === 'failed') return false
            return 3000
        },
        refetchIntervalInBackground: true,
    })
}

/**
 * Mutation to trigger AI jurisprudence analysis.
 *
 * Returns a standard TanStack mutation for the component to call `.mutateAsync()`.
 */
export function useTriggerAnalysis() {
    const { accessToken } = useAuth()

    return useMutation<
        JurisprudenceAnalysisResponse,
        Error,
        { ecliList: string[]; gemeenteNaam: string }
    >({
        mutationFn: ({ ecliList, gemeenteNaam }) =>
            triggerJurisprudenceAnalysis(ecliList, gemeenteNaam, accessToken),
    })
}
