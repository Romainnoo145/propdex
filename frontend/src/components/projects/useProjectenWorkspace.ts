/**
 * useProjectenWorkspace — all state and computed data for the Projecten page.
 * Municipality resolution is delegated to useMunicipalityResolver.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useProjects } from '@/hooks/useProjects'
import {
  useUnreadCounts,
  useProjectChanges,
  useSetGemeenteMonitoringSubscription,
} from '@/hooks/useNotifications'
import { useScanHistory } from '@/hooks/useScans'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { useProvincieGeoJSON } from '@/hooks/useProvincieGeoJSON'
import {
  useMunicipalityWorkspaceStats,
  type ProvinceOption,
  type GemeenteScopeCard,
} from '@/hooks/useMunicipalityWorkspaceStats'
import { useWijkGeoJSON } from '@/hooks/useWijkGeoJSON'
import { toast } from 'sonner'
import type { ProjectResponse } from '@/lib/types/project'
import { useWorkspace } from '@/lib/workspace/useWorkspace'
import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'
import { useMunicipalityResolver } from './useMunicipalityResolver'

const FAVORITE_GEMEENTEN_KEY = 'propdex:favorite-gemeenten'
const RECENT_GEMEENTEN_KEY = 'propdex:recent-gemeenten'
const MAX_RECENT_GEMEENTEN = 6

export const DEMO_PROJECTS: ProjectResponse[] = [
  {
    id: 'demo-1', name: 'Herontwikkeling Venlo Centrum',
    description: 'Haalbaarheidsonderzoek voor 12 panden in het kernwinkelgebied',
    created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-08T14:30:00Z',
    report_count: 8, parent_id: null, gemeente_code: null, wijk_naam: null,
    is_monitored: false, unread_count: 0, children: [],
  },
  {
    id: 'demo-2', name: 'Woningbouw Maastricht Zuid',
    description: 'Nieuwbouwlocaties rondom Randwyck station',
    created_at: '2026-01-15T09:00:00Z', updated_at: '2026-02-05T16:00:00Z',
    report_count: 5, parent_id: null, gemeente_code: null, wijk_naam: null,
    is_monitored: false, unread_count: 0, children: [],
  },
  {
    id: 'demo-3', name: 'Monumenten Inventarisatie Utrecht', description: null,
    created_at: '2026-02-06T11:00:00Z', updated_at: '2026-02-06T11:00:00Z',
    report_count: 3, parent_id: null, gemeente_code: null, wijk_naam: null,
    is_monitored: false, unread_count: 0, children: [],
  },
]

export function useProjectenWorkspace() {
  const { roleMeta } = useWorkspace()
  const { data, isLoading } = useProjects()
  const { data: unreadData } = useUnreadCounts()
  const { data: scanHistory } = useScanHistory({ limit: 100, status: 'completed' })
  const setMonitoringSubscription = useSetGemeenteMonitoringSubscription()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })

  const selectedGemeenteId = search.gemeente_id ?? null
  const selectedGemeenteCode = normalizeGemeenteCode(search.gemeente_code)
  const selectedProvinceCode = search.provincie_code?.trim() || null
  const selectedWijkId = search.wijk_id ?? null

  const { data: selectedGemeenteChanges } = useProjectChanges(selectedGemeenteId)
  const [favoriteGemeenteCodes, setFavoriteGemeenteCodes] = useState<string[]>([])
  const [recentGemeenteCodes, setRecentGemeenteCodes] = useState<string[]>([])
  const [preferencesHydrated, setPreferencesHydrated] = useState(false)

  const setSelectedProvinceCode = useCallback((provinceCode: string | null) => {
    navigate({ to: '/projecten', search: (prev) => ({ ...prev, provincie_code: provinceCode?.trim() || undefined }), replace: true })
  }, [navigate])

  const isDemo = !data && !isLoading
  const allProjects = data?.projects ?? (isDemo ? DEMO_PROJECTS : [])
  const topLevelProjects = allProjects.filter((p) => p.parent_id === null)
  const shouldLoadBoundaries = allProjects.length > 0

  const { data: gemeenteGeojson } = useGemeenteGeoJSON(shouldLoadBoundaries)
  const { data: provincieGeojson } = useProvincieGeoJSON(shouldLoadBoundaries)

  // Hydrate localStorage preferences
  useEffect(() => {
    try {
      const rawFavorites = window.localStorage.getItem(FAVORITE_GEMEENTEN_KEY)
      if (rawFavorites) {
        const parsed = JSON.parse(rawFavorites) as unknown
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item) => (typeof item === 'string' ? normalizeGemeenteCode(item) : null)).filter((item): item is string => !!item)
          setFavoriteGemeenteCodes(Array.from(new Set(normalized)))
        }
      }
      const rawRecent = window.localStorage.getItem(RECENT_GEMEENTEN_KEY)
      if (rawRecent) {
        const parsed = JSON.parse(rawRecent) as unknown
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item) => (typeof item === 'string' ? normalizeGemeenteCode(item) : null)).filter((item): item is string => !!item)
          setRecentGemeenteCodes(Array.from(new Set(normalized)).slice(0, MAX_RECENT_GEMEENTEN))
        }
      }
    } catch { /* Ignore malformed localStorage */ }
    finally { setPreferencesHydrated(true) }
  }, [])

  useEffect(() => {
    if (!preferencesHydrated) return
    try { window.localStorage.setItem(FAVORITE_GEMEENTEN_KEY, JSON.stringify(favoriteGemeenteCodes)) } catch { /* ignore */ }
  }, [favoriteGemeenteCodes, preferencesHydrated])

  useEffect(() => {
    if (!preferencesHydrated) return
    try { window.localStorage.setItem(RECENT_GEMEENTEN_KEY, JSON.stringify(recentGemeenteCodes)) } catch { /* ignore */ }
  }, [recentGemeenteCodes, preferencesHydrated])

  const {
    resolveGemeenteCodeForProject, resolveGemeenteCodeWithScanFallback,
    municipalityProjectsByCode, standaloneWijkProjectsByCode,
    regularProjects, childrenByParentId,
  } = useMunicipalityResolver({ allProjects, topLevelProjects, gemeenteGeojson, scanHistory: scanHistory?.scans })

  const scanWijkNamesByGemeenteCode = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const scan of scanHistory?.scans ?? []) {
      if (scan.status !== 'completed' || !scan.gemeente_code || !scan.wijk_naam) continue
      const gemeenteCode = normalizeGemeenteCode(scan.gemeente_code)
      if (!gemeenteCode) continue
      const set = map.get(gemeenteCode) ?? new Set<string>()
      set.add(normalizeAreaName(scan.wijk_naam))
      map.set(gemeenteCode, set)
    }
    return map
  }, [scanHistory?.scans])

  const unreadByProjectId = useMemo(() => new Map((unreadData?.per_project ?? []).map((row) => [row.project_id, row.unread_count])), [unreadData?.per_project])

  const provinceOptions = useMemo<ProvinceOption[]>(() => {
    if (!provincieGeojson) return []
    const provinces: ProvinceOption[] = []
    for (const feature of provincieGeojson.features) {
      const rawCode = String(feature.properties?.statcode ?? feature.properties?.code ?? feature.properties?.provcode ?? '').trim()
      const rawName = String(feature.properties?.statnaam ?? feature.properties?.naam ?? feature.properties?.name ?? '').trim()
      const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined
      if (!rawName || !geometry) continue
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue
      provinces.push({ code: rawCode || `PROV-${normalizeAreaName(rawName)}`, naam: rawName, geometry })
    }
    return provinces.sort((a, b) => a.naam.localeCompare(b.naam, 'nl-NL'))
  }, [provincieGeojson])

  useEffect(() => {
    if (selectedGemeenteId) return
    if (provinceOptions.length === 0) { if (selectedProvinceCode !== null) setSelectedProvinceCode(null); return }
    if (selectedProvinceCode && provinceOptions.some((p) => p.code === selectedProvinceCode)) return
    const limburg = provinceOptions.find((p) => normalizeAreaName(p.naam) === 'limburg')
    setSelectedProvinceCode((limburg ?? provinceOptions[0])?.code ?? null)
  }, [provinceOptions, selectedProvinceCode, selectedGemeenteId, setSelectedProvinceCode])

  const selectedProvince = useMemo(
    () => provinceOptions.find((p) => p.code === selectedProvinceCode) ?? provinceOptions[0] ?? null,
    [provinceOptions, selectedProvinceCode]
  )

  const { allGemeenteCards, selectedGemeenteCard, selectedGemeenteWijkReportCounts, provinceStatsByCode } =
    useMunicipalityWorkspaceStats({
      gemeenteGeojson: gemeenteGeojson ?? null,
      provinceOptions,
      municipalityProjectsByCode,
      childrenByParentId,
      standaloneWijkProjectsByCode,
      unreadByProjectId,
      scanWijkNamesByGemeenteCode,
      selectedGemeenteCode,
    })

  const selectedProvinceGemeenteCards = useMemo(
    () => selectedProvince ? allGemeenteCards.filter((c) => c.provinceCode === selectedProvince.code) : [],
    [allGemeenteCards, selectedProvince]
  )

  const hasGemeenteDetail = Boolean(selectedGemeenteId || (selectedGemeenteCode && selectedGemeenteCard))

  const municipalityProjectsById = useMemo(
    () => new Map(Array.from(municipalityProjectsByCode.values()).map((p) => [p.id, p])),
    [municipalityProjectsByCode]
  )

  const detailGemeenteCodeForWijken = useMemo(() => {
    if (selectedGemeenteId) {
      const p = municipalityProjectsById.get(selectedGemeenteId)
      return p ? resolveGemeenteCodeForProject(p) : null
    }
    return selectedGemeenteCode
  }, [selectedGemeenteId, selectedGemeenteCode, municipalityProjectsById, resolveGemeenteCodeForProject])

  const { data: detailWijkGeojson } = useWijkGeoJSON(detailGemeenteCodeForWijken)

  const selectedProvinceGemeenteCodeSet = useMemo(() => new Set(selectedProvinceGemeenteCards.map((c) => c.code)), [selectedProvinceGemeenteCards])

  const standaloneWijkCountInSelectedProvince = useMemo(
    () => Array.from(standaloneWijkProjectsByCode.entries()).reduce((sum, [code, projects]) => selectedProvinceGemeenteCodeSet.has(code) ? sum + projects.length : sum, 0),
    [standaloneWijkProjectsByCode, selectedProvinceGemeenteCodeSet]
  )

  const totaalMeldingen = unreadData?.total_unread ?? 0
  const totaalProvincies = provinceOptions.length
  const gemeentenInSelectedProvince = selectedProvinceGemeenteCards.length
  const workspaceTitle = roleMeta.summaryLabel === 'Borgingsworkspace' ? 'Dossiers' : 'Projecten'
  const workspaceSubtitle = `${roleMeta.summaryLabel} · ${allProjects.length} ${allProjects.length === 1 ? 'project' : 'projecten'} in totaal${selectedProvince ? ` · ${gemeentenInSelectedProvince} gemeenten in ${selectedProvince.naam}` : ''}`

  const favoriteCodeSet = useMemo(() => new Set(favoriteGemeenteCodes), [favoriteGemeenteCodes])

  const recentCards = useMemo(() => {
    const byCode = new Map(selectedProvinceGemeenteCards.map((c) => [c.code, c]))
    return recentGemeenteCodes.map((code) => byCode.get(code)).filter((c): c is GemeenteScopeCard => !!c)
  }, [recentGemeenteCodes, selectedProvinceGemeenteCards])

  const orderedSelectedProvinceCards = useMemo(() => {
    const recentIndex = new Map(recentGemeenteCodes.map((code, i) => [code, i]))
    return [...selectedProvinceGemeenteCards].sort((a, b) => {
      const favA = favoriteCodeSet.has(a.code) ? 1 : 0
      const favB = favoriteCodeSet.has(b.code) ? 1 : 0
      if (favA !== favB) return favB - favA
      const recA = recentIndex.get(a.code)
      const recB = recentIndex.get(b.code)
      if (recA !== undefined || recB !== undefined) {
        if (recA === undefined) return 1
        if (recB === undefined) return -1
        return recA - recB
      }
      return a.naam.localeCompare(b.naam, 'nl-NL')
    })
  }, [selectedProvinceGemeenteCards, favoriteCodeSet, recentGemeenteCodes])

  const favoriteSelectedProvinceCards = useMemo(() => orderedSelectedProvinceCards.filter((c) => favoriteCodeSet.has(c.code)), [orderedSelectedProvinceCards, favoriteCodeSet])
  const nonFavoriteSelectedProvinceCards = useMemo(() => orderedSelectedProvinceCards.filter((c) => !favoriteCodeSet.has(c.code)), [orderedSelectedProvinceCards, favoriteCodeSet])

  const toggleFavoriteGemeente = useCallback((gemeenteCode: string) => {
    const normalizedCode = normalizeGemeenteCode(gemeenteCode)
    if (!normalizedCode) return
    setFavoriteGemeenteCodes((prev) => prev.includes(normalizedCode) ? prev.filter((c) => c !== normalizedCode) : [normalizedCode, ...prev])
  }, [])

  const registerRecentGemeente = useCallback((gemeenteCode: string) => {
    const normalizedCode = normalizeGemeenteCode(gemeenteCode)
    if (!normalizedCode) return
    setRecentGemeenteCodes((prev) => [normalizedCode, ...prev.filter((c) => c !== normalizedCode)].slice(0, MAX_RECENT_GEMEENTEN))
  }, [])

  const handleSetGemeenteMonitoring = useCallback((gemeenteCode: string | null, gemeenteNaam: string, enabled: boolean) => {
    const normalizedCode = normalizeGemeenteCode(gemeenteCode)
    if (!normalizedCode) { toast.error('Gemeentecode ontbreekt'); return }
    setMonitoringSubscription.mutate(
      { gemeente_code: normalizedCode, gemeente_naam: gemeenteNaam, enabled },
      {
        onSuccess: (result) => {
          toast.success(result.enabled
            ? `Meldingen geactiveerd voor ${result.gemeente_naam} (${result.monitored_projects}/${result.total_projects} projecten)`
            : `Meldingen uitgeschakeld voor ${result.gemeente_naam}`)
        },
        onError: (error) => toast.error(error.message || 'Instellen van meldingen mislukt'),
      }
    )
  }, [setMonitoringSubscription])

  return {
    isLoading, isDemo, allProjects, unreadData, scanHistory, navigate,
    selectedGemeenteId, selectedGemeenteCode, selectedProvinceCode, selectedWijkId,
    hasGemeenteDetail, regularProjects, workspaceTitle, workspaceSubtitle,
    totaalMeldingen, totaalProvincies, gemeentenInSelectedProvince,
    provinceOptions, selectedProvince, provinceStatsByCode,
    allGemeenteCards, selectedProvinceGemeenteCards, recentCards,
    favoriteSelectedProvinceCards, nonFavoriteSelectedProvinceCards, favoriteCodeSet,
    standaloneWijkCountInSelectedProvince,
    gemeenteGeojson, provincieGeojson, detailWijkGeojson,
    municipalityProjectsById, childrenByParentId, standaloneWijkProjectsByCode,
    scanWijkNamesByGemeenteCode, selectedGemeenteWijkReportCounts,
    selectedGemeenteCard, selectedGemeenteChanges, setMonitoringSubscription,
    setSelectedProvinceCode, resolveGemeenteCodeForProject, resolveGemeenteCodeWithScanFallback,
    toggleFavoriteGemeente, registerRecentGemeente, handleSetGemeenteMonitoring,
  }
}
