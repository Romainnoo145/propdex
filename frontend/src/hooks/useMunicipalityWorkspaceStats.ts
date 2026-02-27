import { useMemo } from 'react'
import type { ProjectResponse } from '@/lib/types/project'
import { bboxCenter, pointInPolygon } from '@/lib/geo-utils'
import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'

type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon

export interface ProvinceOption {
  code: string
  naam: string
  geometry: PolygonGeometry
}

export interface GemeenteScopeCard {
  code: string
  naam: string
  geometry: PolygonGeometry
  provinceCode: string
  project: ProjectResponse | null
  scannedWijken: number
  rapporten: number
  meldingen: number
  totalUnread: number
}

interface UseMunicipalityWorkspaceStatsInput {
  gemeenteGeojson: GeoJSON.FeatureCollection | null
  provinceOptions: ProvinceOption[]
  municipalityProjectsByCode: Map<string, ProjectResponse>
  childrenByParentId: Map<string, ProjectResponse[]>
  standaloneWijkProjectsByCode: Map<string, ProjectResponse[]>
  unreadByProjectId: Map<string, number>
  scanWijkNamesByGemeenteCode: Map<string, Set<string>>
  selectedGemeenteCode: string | null
}

/**
 * Shared municipality workspace selector logic used by ProjectList.
 * Centralizes derived counters and selected-gemeente summaries.
 */
export function useMunicipalityWorkspaceStats({
  gemeenteGeojson,
  provinceOptions,
  municipalityProjectsByCode,
  childrenByParentId,
  standaloneWijkProjectsByCode,
  unreadByProjectId,
  scanWijkNamesByGemeenteCode,
  selectedGemeenteCode,
}: UseMunicipalityWorkspaceStatsInput) {
  const allGemeenteCards = useMemo<GemeenteScopeCard[]>(() => {
    if (!gemeenteGeojson || provinceOptions.length === 0) return []

    const cards: GemeenteScopeCard[] = []

    for (const feature of gemeenteGeojson.features) {
      const code = normalizeGemeenteCode(String(feature.properties?.statcode ?? '').trim())
      const naam = String(feature.properties?.statnaam ?? '').trim()
      const geometry = feature.geometry as PolygonGeometry | undefined
      if (!code || !naam || !geometry) continue
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue

      const center = bboxCenter(geometry)
      const province = provinceOptions.find((candidate) =>
        pointInPolygon(center, candidate.geometry)
      )
      if (!province) continue

      const project = municipalityProjectsByCode.get(code) ?? null
      const linkedWijkProjects = project ? (childrenByParentId.get(project.id) ?? []) : []
      const standaloneWijken = standaloneWijkProjectsByCode.get(code) ?? []

      const rapporten =
        (project?.report_count ?? 0) +
        linkedWijkProjects.reduce((sum, wijk) => sum + wijk.report_count, 0) +
        standaloneWijken.reduce((sum, wijk) => sum + wijk.report_count, 0)

      const meldingen =
        (project ? (unreadByProjectId.get(project.id) ?? 0) : 0) +
        linkedWijkProjects.reduce((sum, wijk) => sum + (unreadByProjectId.get(wijk.id) ?? 0), 0) +
        standaloneWijken.reduce((sum, wijk) => sum + (unreadByProjectId.get(wijk.id) ?? 0), 0)

      const wijkNames = new Set(scanWijkNamesByGemeenteCode.get(code) ?? [])
      for (const wijk of [...linkedWijkProjects, ...standaloneWijken]) {
        const wijkName = normalizeAreaName(wijk.wijk_naam ?? wijk.name)
        if (!wijkName) continue
        wijkNames.add(wijkName)
      }

      cards.push({
        code,
        naam,
        geometry,
        provinceCode: province.code,
        project,
        scannedWijken: wijkNames.size,
        rapporten,
        meldingen,
        totalUnread: meldingen,
      })
    }

    return cards.sort((a, b) => a.naam.localeCompare(b.naam, 'nl-NL'))
  }, [
    gemeenteGeojson,
    provinceOptions,
    municipalityProjectsByCode,
    childrenByParentId,
    standaloneWijkProjectsByCode,
    unreadByProjectId,
    scanWijkNamesByGemeenteCode,
  ])

  const gemeenteCardByCode = useMemo(
    () => new Map(allGemeenteCards.map((card) => [card.code, card])),
    [allGemeenteCards]
  )

  const selectedGemeenteCard = useMemo(
    () => (selectedGemeenteCode ? (gemeenteCardByCode.get(selectedGemeenteCode) ?? null) : null),
    [selectedGemeenteCode, gemeenteCardByCode]
  )

  const selectedGemeenteWijkReportCounts = useMemo(() => {
    if (!selectedGemeenteCard) return new Map<string, number>()

    const counts = new Map<string, number>()
    const linkedWijken = selectedGemeenteCard.project
      ? (childrenByParentId.get(selectedGemeenteCard.project.id) ?? [])
      : []
    const standaloneWijken = standaloneWijkProjectsByCode.get(selectedGemeenteCard.code) ?? []

    for (const wijk of [...linkedWijken, ...standaloneWijken]) {
      const wijkName = normalizeAreaName(wijk.wijk_naam ?? wijk.name)
      if (!wijkName) continue
      counts.set(wijkName, (counts.get(wijkName) ?? 0) + wijk.report_count)
    }

    return counts
  }, [selectedGemeenteCard, childrenByParentId, standaloneWijkProjectsByCode])

  const provinceStatsByCode = useMemo(() => {
    const stats = new Map<string, { gemeenten: number; meldingen: number }>()
    for (const card of allGemeenteCards) {
      const current = stats.get(card.provinceCode) ?? { gemeenten: 0, meldingen: 0 }
      current.gemeenten += 1
      current.meldingen += card.totalUnread
      stats.set(card.provinceCode, current)
    }
    return stats
  }, [allGemeenteCards])

  return {
    allGemeenteCards,
    gemeenteCardByCode,
    selectedGemeenteCard,
    selectedGemeenteWijkReportCounts,
    provinceStatsByCode,
  }
}
