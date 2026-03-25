/**
 * Subsidie Explorer types and hook.
 *
 * Fetches from: GET /api/gemeente/subsidies/development
 * Transforms the flat list into an explorer response with
 * client-side faceting (only ~20 items, no server-side filtering needed).
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

/* ─── Types ─────────────────────────────────────────────────── */

export interface SubsidieExplorerItem {
  id: string
  title: string
  intro: string | null
  url: string | null
  sectors: string[]
  targets: string[]
}

export interface SubsidieFacetItem {
  value: string
  count: number
}

export interface SubsidieExplorerFacets {
  sectors: SubsidieFacetItem[]
  targets: SubsidieFacetItem[]
}

export interface SubsidieExplorerResponse {
  results: SubsidieExplorerItem[]
  total_count: number
  facets: SubsidieExplorerFacets
}

export interface SubsidieFilters {
  sector?: string
  target?: string
}

/* ─── Raw API response ──────────────────────────────────────── */

interface RawSubsidieResponse {
  subsidies: SubsidieExplorerItem[]
  total: number
  source: string
}

/* ─── Faceting ──────────────────────────────────────────────── */

function buildFacets(
  items: SubsidieExplorerItem[],
  activeSector: string | undefined,
  activeTarget: string | undefined,
): SubsidieExplorerFacets {
  // Sector counts: filtered by activeTarget only (cross-faceted)
  const sectorMap = new Map<string, number>()
  for (const item of items) {
    if (activeTarget && !item.targets.includes(activeTarget)) continue
    for (const s of item.sectors) {
      sectorMap.set(s, (sectorMap.get(s) ?? 0) + 1)
    }
  }

  // Target counts: filtered by activeSector only (cross-faceted)
  const targetMap = new Map<string, number>()
  for (const item of items) {
    if (activeSector && !item.sectors.includes(activeSector)) continue
    for (const t of item.targets) {
      targetMap.set(t, (targetMap.get(t) ?? 0) + 1)
    }
  }

  return {
    sectors: [...sectorMap.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    targets: [...targetMap.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/* ─── Hook ──────────────────────────────────────────────────── */

export function useSubsidieExplorer(filters: SubsidieFilters = {}) {
  const { accessToken } = useAuth()

  const query = useQuery<RawSubsidieResponse, Error>({
    queryKey: ['subsidie-explorer'],
    queryFn: () =>
      apiFetch<RawSubsidieResponse>(
        '/api/gemeente/subsidies/development',
        { method: 'GET', accessToken },
      ),
    staleTime: 30 * 60 * 1000, // 30 min
    enabled: !!accessToken,
  })

  const allItems = query.data?.subsidies ?? []

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      if (filters.sector && !item.sectors.includes(filters.sector)) return false
      if (filters.target && !item.targets.includes(filters.target)) return false
      return true
    })
  }, [allItems, filters.sector, filters.target])

  const facets = useMemo(
    () => buildFacets(allItems, filters.sector, filters.target),
    [allItems, filters.sector, filters.target],
  )

  const data: SubsidieExplorerResponse | undefined = query.data
    ? { results: filtered, total_count: filtered.length, facets }
    : undefined

  return {
    data,
    allCount: allItems.length,
    isLoading: query.isLoading,
    error: query.error,
  }
}
