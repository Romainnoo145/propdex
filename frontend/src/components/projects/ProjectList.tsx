import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useProjects, useDeleteProject } from '@/hooks/useProjects'
import {
  useUnreadCounts,
  useProjectChanges,
  useSetGemeenteMonitoringSubscription,
} from '@/hooks/useNotifications'
import { useProjectScans, useScanHistory, useTriggerScan } from '@/hooks/useScans'
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
import type { ScanListItem } from '@/lib/types/scan'
import { useWorkspace } from '@/lib/workspace/useWorkspace'
import ProjectEditModal from './ProjectEditModal'
import ChangeTimeline from '@/components/notifications/ChangeTimeline'
import { Skeleton } from '@/components/feedback/Skeleton'
import { MetricChip } from '@/components/primitives'
import {
  geoJsonToSvgPath,
  geoJsonToSvgDualPath,
  calculateBboxFromGeometry,
  resolveWijkBbox,
} from '@/lib/geo-utils'
import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'
import { toMapGemeenteWijkSearch } from '@/lib/navigation/mapSearch'
import { toProjectenGemeenteSearch, toProjectenRootSearch } from '@/lib/navigation/workspaceSearch'
import { GemeenteCard } from './GemeenteCard'
import { GemeenteCardGrid, GemeenteCardGridSkeleton } from './GemeenteCardGrid'
import { GemeenteDetailView } from './GemeenteDetailView'
import { WijkDetailView } from './WijkDetailView'
import { DrilldownBreadcrumb } from './DrilldownBreadcrumb'

// Demo projects shown when API is unavailable (no auth)
const DEMO_PROJECTS: ProjectResponse[] = [
  {
    id: 'demo-1',
    name: 'Herontwikkeling Venlo Centrum',
    description: 'Haalbaarheidsonderzoek voor 12 panden in het kernwinkelgebied',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-08T14:30:00Z',
    report_count: 8,
    parent_id: null,
    gemeente_code: null,
    wijk_naam: null,
    is_monitored: false,
    unread_count: 0,
    children: [],
  },
  {
    id: 'demo-2',
    name: 'Woningbouw Maastricht Zuid',
    description: 'Nieuwbouwlocaties rondom Randwyck station',
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-02-05T16:00:00Z',
    report_count: 5,
    parent_id: null,
    gemeente_code: null,
    wijk_naam: null,
    is_monitored: false,
    unread_count: 0,
    children: [],
  },
  {
    id: 'demo-3',
    name: 'Monumenten Inventarisatie Utrecht',
    description: null,
    created_at: '2026-02-06T11:00:00Z',
    updated_at: '2026-02-06T11:00:00Z',
    report_count: 3,
    parent_id: null,
    gemeente_code: null,
    wijk_naam: null,
    is_monitored: false,
    unread_count: 0,
    children: [],
  },
]

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
})

const FAVORITE_GEMEENTEN_KEY = 'propdex:favorite-gemeenten'
const RECENT_GEMEENTEN_KEY = 'propdex:recent-gemeenten'
const MAX_RECENT_GEMEENTEN = 6

function isMunicipalityLikeProjectName(
  projectName: string,
  municipalityName: string,
  municipalityCode: string
): boolean {
  const normalizedProjectName = normalizeAreaName(projectName)
  const normalizedMunicipalityName = normalizeAreaName(municipalityName)
  const codeDigits = municipalityCode.replace(/^GM/i, '')

  return (
    normalizedProjectName === normalizedMunicipalityName ||
    normalizedProjectName === `gemeente ${normalizedMunicipalityName}` ||
    normalizedProjectName === codeDigits ||
    normalizedProjectName === `gemeente ${codeDigits}`
  )
}

/**
 * Project list with expandable report rows.
 * Dark theme — Industrial Amber design system (grey-* tokens).
 * Falls back to demo data when API is unavailable.
 */
export default function ProjectList() {
  const { roleMeta } = useWorkspace()
  const { data, isLoading } = useProjects()
  const { data: unreadData } = useUnreadCounts()
  const { data: scanHistory } = useScanHistory({ limit: 100, status: 'completed' })
  const deleteMutation = useDeleteProject()
  const setMonitoringSubscription = useSetGemeenteMonitoringSubscription()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })
  const selectedGemeenteId = search.gemeente_id ?? null
  const selectedGemeenteCode = normalizeGemeenteCode(search.gemeente_code)
  const selectedProvinceCode = search.provincie_code?.trim() || null
  const selectedWijkId = search.wijk_id ?? null
  const { data: selectedGemeenteChanges } = useProjectChanges(selectedGemeenteId)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(null)
  const [favoriteGemeenteCodes, setFavoriteGemeenteCodes] = useState<string[]>([])
  const [recentGemeenteCodes, setRecentGemeenteCodes] = useState<string[]>([])
  const [preferencesHydrated, setPreferencesHydrated] = useState(false)

  const setSelectedProvinceCode = useCallback((provinceCode: string | null) => {
    navigate({
      to: '/projecten',
      search: (prev) => ({
        ...prev,
        provincie_code: provinceCode?.trim() || undefined,
      }),
      replace: true,
    })
  }, [navigate])

  const isDemo = !data && !isLoading
  const allProjects = data?.projects ?? (isDemo ? DEMO_PROJECTS : [])

  // Separate top-level projects (no parent) from hierarchical projects
  const topLevelProjects = allProjects.filter((p) => p.parent_id === null)

  const shouldLoadBoundaries = allProjects.length > 0
  const { data: gemeenteGeojson } = useGemeenteGeoJSON(shouldLoadBoundaries)
  const { data: provincieGeojson } = useProvincieGeoJSON(shouldLoadBoundaries)

  useEffect(() => {
    try {
      const rawFavorites = window.localStorage.getItem(FAVORITE_GEMEENTEN_KEY)
      if (rawFavorites) {
        const parsed = JSON.parse(rawFavorites) as unknown
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => (typeof item === 'string' ? normalizeGemeenteCode(item) : null))
            .filter((item): item is string => !!item)
          setFavoriteGemeenteCodes(Array.from(new Set(normalized)))
        }
      }

      const rawRecent = window.localStorage.getItem(RECENT_GEMEENTEN_KEY)
      if (rawRecent) {
        const parsed = JSON.parse(rawRecent) as unknown
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => (typeof item === 'string' ? normalizeGemeenteCode(item) : null))
            .filter((item): item is string => !!item)
          setRecentGemeenteCodes(Array.from(new Set(normalized)).slice(0, MAX_RECENT_GEMEENTEN))
        }
      }
    } catch {
      // Ignore malformed localStorage payloads.
    } finally {
      setPreferencesHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!preferencesHydrated) return
    try {
      window.localStorage.setItem(
        FAVORITE_GEMEENTEN_KEY,
        JSON.stringify(favoriteGemeenteCodes)
      )
    } catch {
      // Ignore localStorage write errors.
    }
  }, [favoriteGemeenteCodes, preferencesHydrated])

  useEffect(() => {
    if (!preferencesHydrated) return
    try {
      window.localStorage.setItem(
        RECENT_GEMEENTEN_KEY,
        JSON.stringify(recentGemeenteCodes)
      )
    } catch {
      // Ignore localStorage write errors.
    }
  }, [recentGemeenteCodes, preferencesHydrated])

  const municipalityNameByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const feature of gemeenteGeojson?.features ?? []) {
      const rawCode = String(feature.properties?.statcode ?? '').trim()
      const rawName = String(feature.properties?.statnaam ?? '').trim()
      const code = normalizeGemeenteCode(rawCode)
      if (!code || !rawName) continue
      map.set(code, rawName)
    }
    return map
  }, [gemeenteGeojson])

  const wijkNameToUniqueGemeenteCode = useMemo(() => {
    const byName = new Map<string, Set<string>>()

    for (const scan of scanHistory?.scans ?? []) {
      if (!scan.wijk_naam || !scan.gemeente_code) continue
      const code = normalizeGemeenteCode(scan.gemeente_code)
      if (!code) continue
      const normalizedWijkName = normalizeAreaName(scan.wijk_naam)
      const codes = byName.get(normalizedWijkName) ?? new Set<string>()
      codes.add(code)
      byName.set(normalizedWijkName, codes)
    }

    for (const project of allProjects) {
      const code = normalizeGemeenteCode(project.gemeente_code)
      if (!code) continue
      const wijkName = project.wijk_naam ?? (project.parent_id ? project.name : null)
      if (!wijkName) continue
      const normalizedWijkName = normalizeAreaName(wijkName)
      const codes = byName.get(normalizedWijkName) ?? new Set<string>()
      codes.add(code)
      byName.set(normalizedWijkName, codes)
    }

    const uniqueMap = new Map<string, string>()
    for (const [wijkName, codes] of byName.entries()) {
      if (codes.size !== 1) continue
      const [uniqueCode] = Array.from(codes)
      if (!uniqueCode) continue
      uniqueMap.set(wijkName, uniqueCode)
    }

    return uniqueMap
  }, [scanHistory?.scans, allProjects])

  const resolveGemeenteCodeForProject = (project: ProjectResponse): string | null => {
    const directCode = normalizeGemeenteCode(project.gemeente_code)
    if (directCode) return directCode
    if (!gemeenteGeojson) return null

    const target = normalizeAreaName(project.name)
    const match = gemeenteGeojson.features.find((f) => {
      const statnaam = String(f.properties?.statnaam ?? '')
      return normalizeAreaName(statnaam) === target
    })

    return normalizeGemeenteCode(match?.properties?.statcode as string | undefined)
  }

  const resolveGemeenteCodeWithScanFallback = (project: ProjectResponse): string | null => {
    const directCode = resolveGemeenteCodeForProject(project)
    const normalizedWijkName = normalizeAreaName(project.wijk_naam ?? project.name)
    const byWijkNameCode = wijkNameToUniqueGemeenteCode.get(normalizedWijkName) ?? null
    const byProjectScanCode = scanMetaByProjectId.get(project.id)?.gemeenteCode ?? null

    if (directCode) {
      const municipalityName = municipalityNameByCode.get(directCode)
      const looksLikeMunicipality =
        municipalityName
          ? isMunicipalityLikeProjectName(project.name, municipalityName, directCode)
          : false
      if (!looksLikeMunicipality && byWijkNameCode && byWijkNameCode !== directCode) {
        return byWijkNameCode
      }
      return directCode
    }

    return byWijkNameCode ?? byProjectScanCode
  }

  const inferIsWijkProject = (project: ProjectResponse): boolean => {
    if (project.parent_id) return true
    if (project.wijk_naam) return true
    const scanMeta = scanMetaByProjectId.get(project.id)
    if (scanMeta?.wijkNaam) return true
    if (knownWijkNames.has(normalizeAreaName(project.name))) return true

    const gemeenteCode = resolveGemeenteCodeWithScanFallback(project)
    if (!gemeenteCode) return false
    const municipalityName = municipalityNameByCode.get(gemeenteCode)
    if (!municipalityName) return false

    return !isMunicipalityLikeProjectName(project.name, municipalityName, gemeenteCode)
  }

  const unreadByProjectId = useMemo(() => {
    return new Map(
      (unreadData?.per_project ?? []).map((row) => [row.project_id, row.unread_count])
    )
  }, [unreadData?.per_project])

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, ProjectResponse[]>()
    for (const project of allProjects) {
      if (!project.parent_id) continue
      const existing = map.get(project.parent_id) ?? []
      existing.push(project)
      map.set(project.parent_id, existing)
    }
    return map
  }, [allProjects])

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

  const scanMetaByProjectId = useMemo(() => {
    const map = new Map<
      string,
      { gemeenteCode: string | null; wijkNaam: string | null; score: number; scanDateMs: number }
    >()
    for (const scan of scanHistory?.scans ?? []) {
      if (!scan.project_id) continue
      const current = map.get(scan.project_id)
      const next = {
        gemeenteCode: normalizeGemeenteCode(scan.gemeente_code),
        wijkNaam: scan.wijk_naam ?? null,
        score: scan.wijk_naam ? 2 : 0,
        scanDateMs: Date.parse(scan.scan_date),
      }
      if (!current) {
        map.set(scan.project_id, next)
        continue
      }
      if (next.score > current.score) {
        map.set(scan.project_id, next)
        continue
      }
      if (next.score === current.score && next.scanDateMs > current.scanDateMs) {
        map.set(scan.project_id, next)
      }
    }

    return new Map(
      Array.from(map.entries()).map(([projectId, value]) => [
        projectId,
        { gemeenteCode: value.gemeenteCode, wijkNaam: value.wijkNaam },
      ])
    )
  }, [scanHistory?.scans])

  const knownWijkNames = useMemo(() => {
    const set = new Set<string>()
    for (const project of allProjects) {
      if (project.wijk_naam) {
        set.add(normalizeAreaName(project.wijk_naam))
      } else if (project.parent_id) {
        set.add(normalizeAreaName(project.name))
      }
    }
    for (const scan of scanHistory?.scans ?? []) {
      if (!scan.wijk_naam) continue
      set.add(normalizeAreaName(scan.wijk_naam))
    }
    return set
  }, [allProjects, scanHistory?.scans])

  const municipalityProjectsByCode = useMemo(() => {
    const map = new Map<string, ProjectResponse>()
    for (const project of topLevelProjects) {
      if (inferIsWijkProject(project)) continue
      const code = resolveGemeenteCodeWithScanFallback(project)
      if (!code) continue
      const existing = map.get(code)
      if (!existing || (!existing.is_monitored && project.is_monitored)) {
        map.set(code, project)
      }
    }
    return map
  }, [
    topLevelProjects,
    gemeenteGeojson,
    scanMetaByProjectId,
    knownWijkNames,
    municipalityNameByCode,
    wijkNameToUniqueGemeenteCode,
  ])

  const standaloneWijkProjectsByCode = useMemo(() => {
    const map = new Map<string, ProjectResponse[]>()
    for (const project of topLevelProjects) {
      if (!inferIsWijkProject(project)) continue
      const code = resolveGemeenteCodeWithScanFallback(project)
      if (!code) continue
      const existing = map.get(code) ?? []
      existing.push(project)
      map.set(code, existing)
    }
    return map
  }, [
    topLevelProjects,
    gemeenteGeojson,
    scanMetaByProjectId,
    knownWijkNames,
    municipalityNameByCode,
    wijkNameToUniqueGemeenteCode,
  ])

  const provinceOptions = useMemo<ProvinceOption[]>(() => {
    if (!provincieGeojson) return []

    const provinces: ProvinceOption[] = []
    for (const feature of provincieGeojson.features) {
      const rawCode = String(
        feature.properties?.statcode ??
        feature.properties?.code ??
        feature.properties?.provcode ??
        ''
      ).trim()
      const rawName = String(
        feature.properties?.statnaam ??
        feature.properties?.naam ??
        feature.properties?.name ??
        ''
      ).trim()
      const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined
      if (!rawName || !geometry) continue
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue
      const code = rawCode || `PROV-${normalizeAreaName(rawName)}`
      provinces.push({ code, naam: rawName, geometry })
    }

    return provinces.sort((a, b) => a.naam.localeCompare(b.naam, 'nl-NL'))
  }, [provincieGeojson])

  useEffect(() => {
    if (selectedGemeenteId) return
    if (provinceOptions.length === 0) {
      if (selectedProvinceCode !== null) setSelectedProvinceCode(null)
      return
    }
    if (
      selectedProvinceCode &&
      provinceOptions.some((province) => province.code === selectedProvinceCode)
    ) {
      return
    }
    const limburg = provinceOptions.find(
      (province) => normalizeAreaName(province.naam) === 'limburg'
    )
    setSelectedProvinceCode((limburg ?? provinceOptions[0])?.code ?? null)
  }, [provinceOptions, selectedProvinceCode, selectedGemeenteId])

  const selectedProvince = useMemo(
    () =>
      provinceOptions.find((province) => province.code === selectedProvinceCode) ??
      provinceOptions[0] ??
      null,
    [provinceOptions, selectedProvinceCode]
  )

  const {
    allGemeenteCards,
    selectedGemeenteCard,
    selectedGemeenteWijkReportCounts,
    provinceStatsByCode,
  } = useMunicipalityWorkspaceStats({
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
    () =>
      selectedProvince
        ? allGemeenteCards.filter((card) => card.provinceCode === selectedProvince.code)
        : [],
    [allGemeenteCards, selectedProvince]
  )

  const hasGemeenteDetail = Boolean(
    selectedGemeenteId || (selectedGemeenteCode && selectedGemeenteCard)
  )

  const municipalityProjectsById = useMemo(() => {
    return new Map(
      Array.from(municipalityProjectsByCode.values()).map((project) => [project.id, project])
    )
  }, [municipalityProjectsByCode])

  const detailGemeenteCodeForWijken = useMemo(() => {
    if (selectedGemeenteId) {
      const gemeenteProject = municipalityProjectsById.get(selectedGemeenteId)
      if (!gemeenteProject) return null
      return resolveGemeenteCodeForProject(gemeenteProject)
    }
    return selectedGemeenteCode
  }, [
    selectedGemeenteId,
    selectedGemeenteCode,
    municipalityProjectsById,
    gemeenteGeojson,
  ])

  const { data: detailWijkGeojson } = useWijkGeoJSON(detailGemeenteCodeForWijken)

  const regularProjects = useMemo(() => {
    return topLevelProjects.filter((project) => {
      if (inferIsWijkProject(project)) return false
      return resolveGemeenteCodeWithScanFallback(project) === null
    })
  }, [
    topLevelProjects,
    gemeenteGeojson,
    scanMetaByProjectId,
    knownWijkNames,
    municipalityNameByCode,
    wijkNameToUniqueGemeenteCode,
  ])

  const selectedProvinceGemeenteCodeSet = useMemo(
    () => new Set(selectedProvinceGemeenteCards.map((card) => card.code)),
    [selectedProvinceGemeenteCards]
  )

  const standaloneWijkCountInSelectedProvince = useMemo(() => {
    return Array.from(standaloneWijkProjectsByCode.entries()).reduce(
      (sum, [gemeenteCode, projects]) =>
        selectedProvinceGemeenteCodeSet.has(gemeenteCode) ? sum + projects.length : sum,
      0
    )
  }, [standaloneWijkProjectsByCode, selectedProvinceGemeenteCodeSet])

  const totaalMeldingen = unreadData?.total_unread ?? 0
  const totaalProvincies = provinceOptions.length
  const gemeentenInSelectedProvince = selectedProvinceGemeenteCards.length
  const workspaceTitle = roleMeta.summaryLabel === 'Borgingsworkspace' ? 'Dossiers' : 'Projecten'
  const workspaceSubtitle = `${roleMeta.summaryLabel} · ${allProjects.length} ${
    allProjects.length === 1 ? 'project' : 'projecten'
  } in totaal${
    selectedProvince ? ` · ${gemeentenInSelectedProvince} gemeenten in ${selectedProvince.naam}` : ''
  }`

  const favoriteCodeSet = useMemo(
    () => new Set(favoriteGemeenteCodes),
    [favoriteGemeenteCodes]
  )

  const recentCards = useMemo(() => {
    const byCode = new Map(selectedProvinceGemeenteCards.map((card) => [card.code, card]))
    return recentGemeenteCodes
      .map((code) => byCode.get(code))
      .filter((card): card is GemeenteScopeCard => !!card)
  }, [recentGemeenteCodes, selectedProvinceGemeenteCards])

  const orderedSelectedProvinceCards = useMemo(() => {
    const recentIndex = new Map(recentGemeenteCodes.map((code, index) => [code, index]))
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

  const favoriteSelectedProvinceCards = useMemo(
    () => orderedSelectedProvinceCards.filter((card) => favoriteCodeSet.has(card.code)),
    [orderedSelectedProvinceCards, favoriteCodeSet]
  )

  const nonFavoriteSelectedProvinceCards = useMemo(
    () => orderedSelectedProvinceCards.filter((card) => !favoriteCodeSet.has(card.code)),
    [orderedSelectedProvinceCards, favoriteCodeSet]
  )

  const toggleFavoriteGemeente = (gemeenteCode: string) => {
    const normalizedCode = normalizeGemeenteCode(gemeenteCode)
    if (!normalizedCode) return
    setFavoriteGemeenteCodes((prev) => (
      prev.includes(normalizedCode)
        ? prev.filter((code) => code !== normalizedCode)
        : [normalizedCode, ...prev]
    ))
  }

  const registerRecentGemeente = (gemeenteCode: string) => {
    const normalizedCode = normalizeGemeenteCode(gemeenteCode)
    if (!normalizedCode) return
    setRecentGemeenteCodes((prev) => {
      const next = [normalizedCode, ...prev.filter((code) => code !== normalizedCode)]
      return next.slice(0, MAX_RECENT_GEMEENTEN)
    })
  }

  const handleSetGemeenteMonitoring = (
    gemeenteCode: string | null,
    gemeenteNaam: string,
    enabled: boolean
  ) => {
    const normalizedCode = normalizeGemeenteCode(gemeenteCode)
    if (!normalizedCode) {
      toast.error('Gemeentecode ontbreekt')
      return
    }
    setMonitoringSubscription.mutate(
      {
        gemeente_code: normalizedCode,
        gemeente_naam: gemeenteNaam,
        enabled,
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.enabled
              ? `Meldingen geactiveerd voor ${result.gemeente_naam} (${result.monitored_projects}/${result.total_projects} projecten)`
              : `Meldingen uitgeschakeld voor ${result.gemeente_naam}`
          )
        },
        onError: (error) => {
          toast.error(error.message || 'Instellen van meldingen mislukt')
        },
      }
    )
  }

  const renderGemeenteCard = (card: GemeenteScopeCard) => {
    const siblings = selectedProvinceGemeenteCards
      .filter((candidate) => candidate.code !== card.code)
      .map((candidate) => candidate.geometry)
    const svgData = selectedProvince?.geometry
      ? geoJsonToSvgDualPath(card.geometry, selectedProvince.geometry, siblings)
      : geoJsonToSvgPath(card.geometry)

    const normalizedSvgData = 'primaryD' in svgData
      ? svgData
      : { primaryD: svgData.d, viewBox: svgData.viewBox }

    return (
      <GemeenteCard
        key={card.code}
        gemeenteName={card.naam}
        gemeenteCode={card.code}
        svgData={normalizedSvgData}
        totalUnread={card.totalUnread}
        stats={{
          scannedWijken: card.scannedWijken,
          rapporten: card.rapporten,
          meldingen: card.meldingen,
        }}
        isFavorite={favoriteCodeSet.has(card.code)}
        onToggleFavorite={() => toggleFavoriteGemeente(card.code)}
        onClick={() => {
          registerRecentGemeente(card.code)
          if (card.project) {
            navigate({
              to: '/projecten',
              search: toProjectenGemeenteSearch({
                gemeenteId: card.project.id,
                gemeenteCode: card.code,
                provincieCode: selectedProvinceCode ?? card.provinceCode,
              }),
            })
            return
          }
          navigate({
            to: '/projecten',
            search: toProjectenGemeenteSearch({
              gemeenteCode: card.code,
              provincieCode: selectedProvinceCode ?? card.provinceCode,
            }),
          })
        }}
      />
    )
  }

  const handleToggle = (projectId: string) => {
    setExpandedId((prev) => (prev === projectId ? null : projectId))
  }

  const handleEdit = (e: React.MouseEvent, project: ProjectResponse) => {
    e.stopPropagation()
    if (isDemo) return
    setSelectedProject(project)
    setEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, project: ProjectResponse) => {
    e.stopPropagation()
    if (isDemo) return
    if (!window.confirm('Project verwijderen? Rapporten worden niet verwijderd.')) return
    deleteMutation.mutate(project.id, {
      onSuccess: () => toast.success('Project verwijderd'),
      onError: (error) => toast.error(error.message || 'Fout bij verwijderen project'),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isDemo && (
        <div className="rounded-lg border border-amber-accent/30 bg-amber-accent/10 px-4 py-3 text-sm text-amber-accent">
          Voorbeelddata — start de backend om projecten te beheren
        </div>
      )}

      {!hasGemeenteDetail && (
        <ProjectWorkspaceHeader
          title={workspaceTitle}
          subtitle={workspaceSubtitle}
          metrics={[
            { label: 'Provincies', value: totaalProvincies, icon: <ProvinceStatIcon /> },
            { label: 'Gemeenten', value: gemeentenInSelectedProvince, icon: <GemeenteStatIcon /> },
            {
              label: 'Meldingen',
              value: totaalMeldingen,
              icon: <BellStatIcon />,
              highlight: totaalMeldingen > 0,
            },
          ]}
          actionLabel="Bekijk op kaart"
          onAction={() => navigate({ to: '/map' })}
        />
      )}

      {allProjects.length > 0 ? (
        <div className="space-y-2">
          {/* Province -> municipality drill-down for linked projects, map focus for unlinked */}
          {hasGemeenteDetail ? (
            (() => {
              if (selectedGemeenteId) {
                const gemeente = municipalityProjectsById.get(selectedGemeenteId)
                if (!gemeente) return null

                const gemeenteCode = resolveGemeenteCodeForProject(gemeente)
                const gemeenteForDetail =
                  gemeenteCode && gemeente.gemeente_code !== gemeenteCode
                    ? { ...gemeente, gemeente_code: gemeenteCode }
                    : gemeente
                const linkedChildren = childrenByParentId.get(gemeente.id) ?? []
                const standaloneChildren = gemeenteCode
                  ? (standaloneWijkProjectsByCode.get(gemeenteCode) ?? [])
                  : []
                const wijkChildren = [...linkedChildren, ...standaloneChildren]
                const existingWijkNameSet = new Set(
                  wijkChildren.map((wijk) =>
                    normalizeAreaName(wijk.wijk_naam ?? wijk.name)
                  )
                )
                const virtualWijken: ProjectResponse[] = []

                if (gemeenteCode && detailWijkGeojson) {
                  for (const feature of detailWijkGeojson.features) {
                    const wijkName = String(feature.properties?.statnaam ?? '').trim()
                    if (!wijkName) continue
                    const normalized = normalizeAreaName(wijkName)
                    if (!normalized || existingWijkNameSet.has(normalized)) continue
                    virtualWijken.push({
                      id: `virtual-wijk:${gemeenteCode}:${normalized}`,
                      name: wijkName,
                      description: 'Nog niet gekoppeld als wijkproject',
                      created_at: gemeente.created_at,
                      updated_at: gemeente.updated_at,
                      report_count: 0,
                      parent_id: gemeente.id,
                      gemeente_code: gemeenteCode,
                      wijk_naam: wijkName,
                      is_monitored: gemeente.is_monitored,
                      unread_count: 0,
                      children: [],
                    })
                  }
                }

                const allWijkChildren = [...wijkChildren, ...virtualWijken].sort((a, b) =>
                  (a.wijk_naam ?? a.name).localeCompare((b.wijk_naam ?? b.name), 'nl-NL')
                )

                if (selectedWijkId) {
                  const wijk = allWijkChildren.find((w) => w.id === selectedWijkId)
                  if (!wijk) return null
                  return (
                    <>
                      <DrilldownBreadcrumb gemeenteName={gemeente.name} wijkName={wijk.name} />
                      <WijkDetailView gemeente={gemeenteForDetail} wijk={wijk} />
                    </>
                  )
                }

                return (
                  <>
                    <ProjectWorkspaceHeader
                      title={gemeente.name}
                      subtitle={`${1 + allWijkChildren.length} ${1 + allWijkChildren.length === 1 ? 'project' : 'projecten'} in totaal`}
                      onBack={() => navigate({
                        to: '/projecten',
                        search: toProjectenRootSearch({ provincieCode: selectedProvinceCode }),
                      })}
                      backLabel="Terug naar projecten"
                      metrics={[
                        { label: 'Wijken', value: allWijkChildren.length, icon: <WijkStatIcon /> },
                        {
                          label: 'Rapporten',
                          value: gemeente.report_count + wijkChildren.reduce((sum, wijk) => sum + wijk.report_count, 0),
                          icon: <ReportStatIcon />,
                        },
                        {
                          label: 'Meldingen',
                          value: selectedGemeenteChanges?.total ?? 0,
                          icon: <BellStatIcon />,
                          highlight: (selectedGemeenteChanges?.total ?? 0) > 0,
                        },
                      ]}
                      actionLabel="Bekijk op kaart"
                      onAction={
                        gemeenteCode
                          ? () => navigate({
                            to: '/map',
                            search: toMapGemeenteWijkSearch({ gemeenteCode }),
                          })
                          : undefined
                      }
                      extraActions={
                        <MonitoringToggleAction
                          enabled={gemeente.is_monitored}
                          pending={setMonitoringSubscription.isPending}
                          onClick={() =>
                            handleSetGemeenteMonitoring(
                              gemeenteCode,
                              gemeente.name,
                              !gemeente.is_monitored
                            )
                          }
                        />
                      }
                    />
                    <GemeenteDetailView
                      gemeente={gemeenteForDetail}
                      wijkProjects={allWijkChildren}
                      unreadData={unreadData}
                      gemeenteGeojson={gemeenteGeojson ?? null}
                      scannedWijkNames={
                        gemeenteCode ? (scanWijkNamesByGemeenteCode.get(gemeenteCode) ?? null) : null
                      }
                    />
                  </>
                )
              }

              if (selectedGemeenteCard) {
                return (
                  <>
                    <ProjectWorkspaceHeader
                      title={selectedGemeenteCard.naam}
                      subtitle="Gemeenteflow zonder gekoppeld gemeenteproject"
                      onBack={() => navigate({
                        to: '/projecten',
                        search: toProjectenRootSearch({ provincieCode: selectedProvinceCode }),
                      })}
                      backLabel="Terug naar projecten"
                      metrics={[
                        { label: 'Wijken', value: selectedGemeenteCard.scannedWijken, icon: <WijkStatIcon /> },
                        { label: 'Rapporten', value: selectedGemeenteCard.rapporten, icon: <ReportStatIcon /> },
                        {
                          label: 'Meldingen',
                          value: selectedGemeenteCard.meldingen,
                          icon: <BellStatIcon />,
                          highlight: selectedGemeenteCard.meldingen > 0,
                        },
                      ]}
                      actionLabel="Bekijk op kaart"
                      onAction={() => navigate({
                        to: '/map',
                        search: toMapGemeenteWijkSearch({ gemeenteCode: selectedGemeenteCard.code }),
                      })}
                      extraActions={
                        <MonitoringToggleAction
                          enabled={Boolean(selectedGemeenteCard.project?.is_monitored)}
                          pending={setMonitoringSubscription.isPending}
                          onClick={() =>
                            handleSetGemeenteMonitoring(
                              selectedGemeenteCard.code,
                              selectedGemeenteCard.naam,
                              !Boolean(selectedGemeenteCard.project?.is_monitored)
                            )
                          }
                        />
                      }
                    />
                    <UnlinkedGemeenteWorkspace
                      gemeenteCode={selectedGemeenteCard.code}
                      gemeenteName={selectedGemeenteCard.naam}
                      gemeenteGeometry={selectedGemeenteCard.geometry}
                      scanHistory={scanHistory?.scans ?? []}
                      wijkReportCounts={selectedGemeenteWijkReportCounts}
                    />
                  </>
                )
              }

              return null
            })()
          ) : (
            <>
              {!gemeenteGeojson || !provincieGeojson ? (
                <GemeenteCardGridSkeleton count={12} />
              ) : (
                <section className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
                    <div className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900">
                      <div className="flex items-center gap-2 border-b border-overlay/[0.08] px-4 py-2.5">
                        <ProvinceStatIcon />
                        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
                          Provincies
                        </span>
                        <span className="ml-auto text-xs text-grey-600">{provinceOptions.length}</span>
                      </div>
                      <div className="max-h-[680px] overflow-y-auto p-3">
                        <div className="space-y-2">
                          {provinceOptions.map((province) => {
                            const stats = provinceStatsByCode.get(province.code) ?? { gemeenten: 0, meldingen: 0 }
                            const isActive = selectedProvince?.code === province.code
                            return (
                              <button
                                key={province.code}
                                onClick={() => setSelectedProvinceCode(province.code)}
                                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                  isActive
                                    ? 'border-amber-accent/35 bg-overlay/[0.08] shadow-[0_0_0_1px_rgba(217,170,56,0.14)]'
                                    : 'border-overlay/[0.08] bg-overlay/[0.03] hover:bg-overlay/[0.05]'
                                }`}
                              >
                                <span className={`absolute inset-y-1 left-0 w-1 rounded-r ${isActive ? 'bg-amber-accent' : 'bg-transparent'}`} />
                                <p className="truncate pl-1 text-sm font-semibold text-grey-100">
                                  {province.naam}
                                </p>
                                <div className="mt-1.5 flex items-center gap-2 pl-1 text-[11px] text-grey-500">
                                  <span>{stats.gemeenten} gemeenten</span>
                                  <span className="text-grey-600">&middot;</span>
                                  <span className={stats.meldingen > 0 ? 'text-amber-accent' : 'text-grey-500'}>
                                    {stats.meldingen} meldingen
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900">
                      <div className="flex items-center gap-2 border-b border-overlay/[0.08] px-4 py-2.5">
                        <GemeenteStatIcon />
                        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
                          Kies gemeente {selectedProvince ? `· ${selectedProvince.naam}` : ''}
                        </span>
                        <span className="ml-auto text-xs text-grey-600">{selectedProvinceGemeenteCards.length}</span>
                      </div>
                      <div className="space-y-4 p-4">
                        {selectedProvince && standaloneWijkCountInSelectedProvince > 0 && (
                          <div className="rounded-lg border border-overlay/[0.08] bg-overlay/[0.03] px-4 py-3 text-xs text-grey-500">
                            {standaloneWijkCountInSelectedProvince} losse wijkprojecten zijn automatisch meegeteld bij gemeenten in {selectedProvince.naam}.
                          </div>
                        )}
                        {selectedProvince && recentCards.length > 0 && (
                          <div className="rounded-lg border border-overlay/[0.08] bg-overlay/[0.03] px-4 py-3">
                            <p className="mb-2 text-xs uppercase tracking-wide text-grey-500">Recent bekeken</p>
                            <div className="flex flex-wrap gap-2">
                              {recentCards.map((card) => (
                                <button
                                  key={`recent-${card.code}`}
                                  onClick={() => {
                                    registerRecentGemeente(card.code)
                                    if (card.project) {
                                      navigate({
                                        to: '/projecten',
                                        search: toProjectenGemeenteSearch({
                                          gemeenteId: card.project.id,
                                          gemeenteCode: card.code,
                                          provincieCode: selectedProvinceCode ?? card.provinceCode,
                                        }),
                                      })
                                      return
                                    }
                                    navigate({
                                      to: '/projecten',
                                      search: toProjectenGemeenteSearch({
                                        gemeenteCode: card.code,
                                        provincieCode: selectedProvinceCode ?? card.provinceCode,
                                      }),
                                    })
                                  }}
                                  className="rounded-full border border-overlay/[0.1] bg-overlay/[0.06] px-3 py-1 text-xs text-grey-300 transition-colors hover:bg-overlay/[0.1] hover:text-grey-100"
                                >
                                  {card.naam}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {favoriteSelectedProvinceCards.length > 0 && (
                          <GemeenteCardGrid>
                            {favoriteSelectedProvinceCards.map((card) => renderGemeenteCard(card))}
                          </GemeenteCardGrid>
                        )}
                        {favoriteSelectedProvinceCards.length > 0 && nonFavoriteSelectedProvinceCards.length > 0 && (
                          <div className="my-4 flex items-center gap-3 px-1">
                            <div className="h-px flex-1 bg-overlay/[0.08]" />
                            <span className="text-[11px] uppercase tracking-wide text-grey-600">
                              Overige gemeenten
                            </span>
                            <div className="h-px flex-1 bg-overlay/[0.08]" />
                          </div>
                        )}
                        {nonFavoriteSelectedProvinceCards.length > 0 && (
                          <GemeenteCardGrid>
                            {nonFavoriteSelectedProvinceCards.map((card) => renderGemeenteCard(card))}
                          </GemeenteCardGrid>
                        )}
                        {selectedProvince && selectedProvinceGemeenteCards.length === 0 && (
                          <p className="text-sm text-grey-500">
                            Geen gemeenten gevonden voor {selectedProvince.naam}.
                          </p>
                        )}
                        {!selectedProvince && (
                          <p className="text-sm text-grey-500">
                            Selecteer links een provincie.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* Regular projects (non-monitoring) */}
          {regularProjects.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900">
              <div className="flex items-center gap-2 border-b border-overlay/[0.08] px-4 py-2.5">
                <ReportStatIcon />
                <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
                  Overige projecten
                </span>
                <span className="ml-auto text-xs text-grey-600">{regularProjects.length}</span>
              </div>
              <div className="space-y-2.5 p-3">
                {regularProjects.map((project) => {
                  const isExpanded = expandedId === project.id

                  // Get unread count for this project
                  const unreadCount = unreadData?.per_project.find(
                    (p) => p.project_id === project.id
                  )?.unread_count ?? 0

                  return (
                    <div
                      key={project.id}
                      className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900"
                    >
                      {/* Project header — clickable */}
                      <button
                        onClick={() => handleToggle(project.id)}
                        className="flex w-full min-h-[44px] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-overlay/[0.04]"
                      >
                        <ChevronIcon
                          className={`h-4 w-4 shrink-0 text-grey-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-grey-100">{project.name}</h4>
                            <span className="rounded-full border border-overlay/[0.12] bg-overlay/[0.05] px-2 py-0.5 text-xs font-medium text-grey-400">
                              {project.report_count}
                            </span>
                            {/* Unread badge */}
                            {unreadCount > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-accent px-1 text-xs font-semibold text-on-accent">
                                {unreadCount > 9 ? unreadCount : ''}
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="mt-0.5 truncate text-sm text-grey-400">
                              {project.description}
                            </p>
                          )}
                        </div>

                        {!isDemo && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleEdit(e, project)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-grey-500 transition-colors hover:bg-overlay/[0.08] hover:text-grey-200"
                              title="Bewerk project"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, project)}
                              disabled={deleteMutation.isPending}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-grey-500 transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                              title="Verwijder project"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </button>

                      {/* Expanded content: scan history + change timeline */}
                      {isExpanded && (
                        <>
                          {/* Scan history section */}
                          {!isDemo && (
                            <WijkScanList
                              projectId={project.id}
                              projectName={project.name}
                              gemeenteCode={resolveGemeenteCodeWithScanFallback(project)}
                              wijkNaam={project.wijk_naam}
                              navigate={navigate}
                            />
                          )}
                          {isDemo && (
                            <div className="border-t border-overlay/[0.08] px-5 py-4 text-center text-sm text-grey-400">
                              Geen scans beschikbaar (demo modus)
                            </div>
                          )}

                          {/* Change timeline section */}
                          {!isDemo && <ChangeTimeline projectId={project.id} />}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-overlay/[0.08] bg-grey-900 px-6 py-12 text-center">
          <p className="text-grey-400">
            Nog geen projecten gevonden. Projecten worden automatisch gekoppeld via scan- en rapportflows.
          </p>
        </div>
      )}

      {/* Modals use intentional light theme (white card on dark backdrop) — JSDoc documents this decision */}
      <ProjectEditModal
        key={selectedProject?.id}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={selectedProject}
      />
    </div>
  )
}

function ProjectWorkspaceHeader({
  title,
  subtitle,
  metrics,
  onBack,
  backLabel = 'Terug',
  actionLabel,
  onAction,
  extraActions,
}: {
  title: string
  subtitle?: string
  metrics: Array<{
    label: string
    value: number
    icon: ReactNode
    highlight?: boolean
  }>
  onBack?: () => void
  backLabel?: string
  actionLabel: string
  onAction?: () => void
  extraActions?: ReactNode
}) {
  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-overlay/[0.08] bg-grey-900 px-5 py-5 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-amber-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-36 w-36 rounded-full bg-overlay/[0.04] blur-3xl" />
      <div className="relative">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="mb-3 flex items-center gap-1.5 text-sm text-grey-600 transition-colors hover:text-grey-300"
              >
                <BackArrowIcon />
                {backLabel}
              </button>
            )}
            <h1 className="text-2xl font-semibold text-grey-100 sm:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-grey-600">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {extraActions}
            <button
              onClick={onAction}
              disabled={!onAction}
              className="inline-flex items-center gap-2 rounded-lg border border-overlay/[0.1] bg-overlay/[0.06] px-4 py-2 text-sm font-medium text-grey-300 transition-colors hover:bg-overlay/[0.1] hover:text-grey-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MapPinLineIcon />
              {actionLabel}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <WorkspaceMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              icon={metric.icon}
              highlight={metric.highlight}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MonitoringToggleAction({
  enabled,
  pending,
  onClick,
}: {
  enabled: boolean
  pending: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        enabled
          ? 'border-amber-accent/35 bg-amber-accent/12 text-amber-accent hover:bg-amber-accent/18'
          : 'border-overlay/[0.1] bg-overlay/[0.04] text-grey-300 hover:bg-overlay/[0.08] hover:text-grey-100'
      }`}
    >
      <BellStatIcon />
      {pending ? 'Opslaan...' : enabled ? 'Meldingen aan' : 'Meldingen ontvangen'}
    </button>
  )
}

function UnlinkedGemeenteWorkspace({
  gemeenteCode,
  gemeenteName,
  gemeenteGeometry,
  scanHistory,
  wijkReportCounts,
}: {
  gemeenteCode: string
  gemeenteName: string
  gemeenteGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  scanHistory: ScanListItem[]
  wijkReportCounts: Map<string, number>
}) {
  const navigate = useNavigate()
  const triggerScan = useTriggerScan()
  const { data: wijkGeojson, isLoading } = useWijkGeoJSON(gemeenteCode)
  const [selectedWijkNaam, setSelectedWijkNaam] = useState<string | null>(null)

  const wijkItems = useMemo(() => {
    const unique = new Map<
      string,
      {
        geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
        bbox: [number, number, number, number] | null
      }
    >()
    for (const feature of wijkGeojson?.features ?? []) {
      const name = String(feature.properties?.statnaam ?? '').trim()
      const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined
      if (!name || !geometry) continue
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue
      unique.set(name, {
        geometry,
        bbox: calculateBboxFromGeometry(geometry),
      })
    }
    const rows = Array.from(unique.entries())
      .map(([name, value]) => ({ name, geometry: value.geometry, bbox: value.bbox }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl-NL'))

    return rows.map((row, index) => {
      const siblings = rows
        .filter((_, siblingIndex) => siblingIndex !== index)
        .map((entry) => entry.geometry)
      const svgData = geoJsonToSvgDualPath(row.geometry, gemeenteGeometry, siblings)
      return { name: row.name, bbox: row.bbox, svgData }
    })
  }, [wijkGeojson, gemeenteGeometry])

  const latestScanByWijkName = useMemo(() => {
    const map = new Map<string, ScanListItem>()
    const normalizedGemeenteCode = normalizeGemeenteCode(gemeenteCode)
    for (const scan of scanHistory) {
      if (scan.status !== 'completed') continue
      if (normalizeGemeenteCode(scan.gemeente_code) !== normalizedGemeenteCode) continue
      const wijkNaam = normalizeAreaName(scan.wijk_naam ?? '')
      if (!wijkNaam) continue
      const current = map.get(wijkNaam)
      if (!current || Date.parse(scan.scan_date) > Date.parse(current.scan_date)) {
        map.set(wijkNaam, scan)
      }
    }
    return map
  }, [scanHistory, gemeenteCode])

  useEffect(() => {
    if (wijkItems.length === 0) {
      if (selectedWijkNaam !== null) setSelectedWijkNaam(null)
      return
    }
    if (!selectedWijkNaam || !wijkItems.some((item) => item.name === selectedWijkNaam)) {
      setSelectedWijkNaam(wijkItems[0]!.name)
    }
  }, [wijkItems, selectedWijkNaam])

  const selectedWijk = useMemo(
    () => wijkItems.find((item) => item.name === selectedWijkNaam) ?? null,
    [wijkItems, selectedWijkNaam]
  )

  const latestWijkScan = useMemo(() => {
    if (!selectedWijkNaam) return null
    return latestScanByWijkName.get(normalizeAreaName(selectedWijkNaam)) ?? null
  }, [latestScanByWijkName, selectedWijkNaam])

  return (
    <section className="rounded-xl border border-overlay/[0.08] bg-grey-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-overlay/[0.08] px-4 py-2.5">
        <WijkStatIcon />
        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
          Wijken in {gemeenteName}
        </span>
        <span className="ml-auto text-xs text-grey-600">{wijkItems.length}</span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-overlay/[0.08] bg-overlay/[0.03] px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : wijkItems.length === 0 ? (
          <div className="rounded-lg border border-overlay/[0.08] bg-overlay/[0.03] px-4 py-6 text-center">
            <p className="text-sm text-grey-400">Geen wijkgrenzen gevonden voor deze gemeente.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
            <div className="max-h-[620px] overflow-y-auto rounded-xl border border-overlay/[0.08] bg-grey-900 p-3">
              <div className="space-y-2.5">
                {wijkItems.map((wijk) => {
                  const isActive = wijk.name === selectedWijkNaam
                  const wijkScan = latestScanByWijkName.get(normalizeAreaName(wijk.name))
                  const reportCount = wijkReportCounts.get(normalizeAreaName(wijk.name)) ?? 0
                  return (
                    <button
                      key={wijk.name}
                      onClick={() => setSelectedWijkNaam(wijk.name)}
                      className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all ${
                        isActive
                          ? 'border-amber-accent/35 bg-overlay/[0.08] shadow-[0_0_0_1px_rgba(217,170,56,0.14)]'
                          : 'border-overlay/[0.08] bg-overlay/[0.03] hover:border-amber-accent/30 hover:bg-overlay/[0.05]'
                      }`}
                    >
                      <span className={`absolute inset-y-1 left-0 z-10 w-1 rounded-r ${isActive ? 'bg-amber-accent' : 'bg-transparent'}`} />
                      <div className="relative aspect-[16/8] border-b border-overlay/[0.08] bg-grey-850/65">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,170,56,0.11),transparent_45%),radial-gradient(circle_at_20%_82%,rgba(255,255,255,0.06),transparent_45%)]" />
                        {wijk.svgData ? (
                          <svg
                            viewBox={wijk.svgData.viewBox}
                            className="relative h-full w-full overflow-hidden"
                            preserveAspectRatio="xMidYMid meet"
                          >
                            {wijk.svgData.backgroundD && (
                              <path
                                d={wijk.svgData.backgroundD}
                                className="fill-grey-700/18 stroke-overlay/[0.2]"
                                strokeWidth="0.5"
                              />
                            )}
                            {wijk.svgData.siblingsD && (
                              <path
                                d={wijk.svgData.siblingsD}
                                className="fill-transparent stroke-grey-600/25"
                                strokeWidth="0.3"
                              />
                            )}
                            <path
                              d={wijk.svgData.primaryD}
                              className="fill-amber-accent/24 stroke-amber-accent transition-all duration-200 group-hover:fill-amber-accent/30 group-hover:stroke-amber-accent"
                              strokeWidth="1"
                            />
                          </svg>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <WijkStatIcon />
                          </div>
                        )}
                      </div>
                      <div className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-grey-100">{wijk.name}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <MetricChip
                              value={wijkScan ? 1 : 0}
                              ariaLabel="Gescand"
                              icon={<WijkScanStatusIcon />}
                              tone="amber"
                              compact
                            />
                            <MetricChip
                              value={reportCount}
                              ariaLabel="Rapporten"
                              icon={<ReportStatIcon />}
                              tone="amber"
                              compact
                            />
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-grey-500">
                          {wijkScan
                            ? `Scan: ${dateFmt.format(new Date(wijkScan.scan_date))}`
                            : 'Nog geen scan'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 sm:p-5">
              {selectedWijk ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-grey-100">{selectedWijk.name}</h3>
                    <p className="mt-1 text-sm text-grey-500">
                      Wijk is direct beschikbaar voor scan en kaartnavigatie.
                    </p>
                  </div>

                  {latestWijkScan ? (
                    <div className="rounded-lg border border-overlay/[0.08] bg-overlay/[0.03] px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-grey-600">Laatste scan</p>
                      <p className="mt-1 text-sm font-medium text-grey-200">
                        {dateFmt.format(new Date(latestWijkScan.scan_date))}
                      </p>
                      <p className="text-xs text-grey-500">
                        {latestWijkScan.parcel_count} percelen gescand
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-overlay/[0.08] bg-overlay/[0.03] px-4 py-3">
                      <p className="text-sm text-grey-400">Nog geen scan uitgevoerd voor deze wijk.</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        navigate({
                          to: '/map',
                          search: toMapGemeenteWijkSearch({
                            gemeenteCode,
                            wijkNaam: selectedWijk.name,
                          }),
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-overlay/[0.12] bg-overlay/[0.06] px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-overlay/[0.1] hover:text-grey-100"
                    >
                      <MapPinLineIcon />
                      Open op kaart
                    </button>
                    {latestWijkScan && (
                      <button
                        onClick={() => navigate({ to: '/resultaten', search: { scan_id: latestWijkScan.scan_id } })}
                        className="inline-flex items-center gap-1.5 rounded-md border border-overlay/[0.12] bg-overlay/[0.06] px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-overlay/[0.1] hover:text-grey-100"
                      >
                        <ScanIcon />
                        Bekijk resultaten
                      </button>
                    )}
                    <button
                      onClick={() => {
                        triggerScan.mutate(
                          {
                            gemeente_code: gemeenteCode,
                            gemeente_naam: gemeenteName,
                            wijk_naam: selectedWijk.name,
                            ...(selectedWijk.bbox ? { bbox_wgs84: selectedWijk.bbox } : {}),
                          },
                          {
                            onSuccess: (scan) => {
                              if (scan.status === 'existing' && !scan.needs_rescan) {
                                toast.info('Bestaande scan gevonden, resultaten worden geopend')
                                navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
                                return
                              }
                              toast.success(`Scan gestart voor ${selectedWijk.name}`)
                            },
                            onError: (error) => {
                              toast.error(error.message || 'Scan starten mislukt')
                            },
                          }
                        )
                      }}
                      disabled={triggerScan.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-accent bg-amber-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-amber-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ScanIcon />
                      {triggerScan.isPending ? 'Scan starten...' : 'Start wijkscan'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-grey-500">Selecteer links een wijk.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function WorkspaceMetricCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string
  value: number
  icon: ReactNode
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-overlay/[0.08] bg-overlay/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-grey-600">{label}</p>
        <span className={highlight ? 'text-amber-accent/90' : 'text-grey-500'}>
          {icon}
        </span>
      </div>
      <p className={`mt-1 text-2xl font-semibold leading-none ${highlight ? 'text-amber-accent' : 'text-grey-100'}`}>
        {value}
      </p>
    </div>
  )
}

/**
 * Scan list for a project -- renders inside expanded wijk/project rows.
 * Hook only fires when this component mounts (when row is expanded).
 */
function WijkScanList({
  projectId,
  projectName,
  gemeenteCode,
  wijkNaam,
  navigate,
}: {
  projectId: string
  projectName: string
  gemeenteCode: string | null
  wijkNaam: string | null
  navigate: ReturnType<typeof useNavigate>
}) {
  const { data, isLoading } = useProjectScans(projectId)
  const { data: wijkGeojson } = useWijkGeoJSON(gemeenteCode)
  const triggerScan = useTriggerScan()
  const scans = data?.scans ?? []
  const wijkBboxWgs84 = useMemo(
    () => resolveWijkBbox(wijkGeojson, wijkNaam),
    [wijkGeojson, wijkNaam]
  )

  const handleScanResultsClick = (scan: ScanListItem) => {
    navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
  }

  if (isLoading) {
    return (
      <div className="border-t border-overlay/[0.08] px-10 py-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="border-t border-overlay/[0.08] px-10 py-5 text-center">
        <p className="text-sm text-grey-400">Nog geen scans voor dit project</p>
        {!gemeenteCode && (
          <p className="mt-1 text-xs text-grey-600">
            Gemeentecode niet gevonden voor dit project. Hernoem naar een gemeentenaam of koppel gemeente_code.
          </p>
        )}
        <button
          onClick={() => {
            if (!gemeenteCode) return
            triggerScan.mutate(
              {
                gemeente_code: gemeenteCode,
                gemeente_naam: projectName,
                project_id: projectId,
                ...(wijkNaam ? { wijk_naam: wijkNaam } : {}),
                ...(wijkBboxWgs84 ? { bbox_wgs84: wijkBboxWgs84 } : {}),
              },
              {
                onSuccess: (scan) => {
                  if (scan.status === 'existing' && !scan.needs_rescan) {
                    toast.info('Bestaande scan gevonden, resultaten worden geopend')
                    navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
                    return
                  }
                  toast.success('Scan gestart voor dit project')
                },
                onError: (error) => {
                  toast.error(error.message || 'Scan starten mislukt')
                },
              }
            )
          }}
          disabled={!gemeenteCode || triggerScan.isPending}
          className="mt-3 min-h-[36px] rounded-md border border-overlay/[0.12] bg-overlay/[0.06] px-3 py-1.5 text-xs font-medium text-grey-200 transition-colors hover:bg-overlay/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {triggerScan.isPending ? 'Scan starten...' : 'Start scan'}
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-overlay/[0.08] bg-overlay/[0.03]">
      {scans.map((scan) => {
        const isCompleted = scan.status === 'completed'
        return (
          <div
            key={scan.scan_id}
            className="flex w-full items-center gap-3 border-b border-overlay/[0.08] px-10 py-3 last:border-b-0"
          >
            <ScanIcon />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-grey-300">
                  Scan {dateFmt.format(new Date(scan.scan_date))}
                </p>
                {!isCompleted && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    scan.status === 'running' ? 'bg-info/20 text-info' :
                    scan.status === 'failed' ? 'bg-error/20 text-error' :
                    'border border-overlay/[0.12] bg-overlay/[0.05] text-grey-400'
                  }`}>
                    {scan.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-grey-400">
                {dateFmt.format(new Date(scan.scan_date))} &middot; {scan.parcel_count} percelen
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleScanResultsClick(scan)}
                disabled={!isCompleted}
                className="min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-overlay/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Toon resultaten
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-grey-600">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function BackArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function MapPinLineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ProvinceStatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M12 3v18" />
      <path d="M3 7.5 12 12l9-4.5" />
    </svg>
  )
}

function GemeenteStatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M12 3v18" />
      <path d="M3 7.5 12 12l9-4.5" />
    </svg>
  )
}

function WijkStatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <rect x="5" y="10" width="5" height="11" rx="1" />
      <rect x="14" y="6" width="5" height="15" rx="1" />
      <path d="M7.5 6 17 3" />
    </svg>
  )
}

function ReportStatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function BellStatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function WijkScanStatusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
