import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
    searchJurisprudence,
    getJurisprudenceDoc,
    type JurisprudenceResult,
    type JurisprudenceDocument,
} from '@/lib/api'

export function useJurisprudenceSearch(query: string, enabled = true) {
    const { accessToken } = useAuth()

    return useQuery<{ status: string; results: JurisprudenceResult[] }, Error>({
        queryKey: ['jurisprudence', 'search', query],
        queryFn: async () => {
            if (!query.trim()) return { status: 'empty', results: [] }
            return searchJurisprudence(query, accessToken!)
        },
        enabled: !!accessToken && enabled && query.trim().length > 3,
        staleTime: 5 * 60 * 1000, // 5 min cache
        retry: 1, // Only retry once since rate limits are tight
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
