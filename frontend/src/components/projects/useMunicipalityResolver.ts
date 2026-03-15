/**
 * useMunicipalityResolver — municipality-to-project resolution logic.
 * Extracted from useProjectenWorkspace to keep hook files under 300 lines.
 */
import { useMemo, useCallback } from 'react'
import type { ProjectResponse } from '@/lib/types/project'
import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'
import type { FeatureCollection } from 'geojson'
import type { ScanListItem } from '@/lib/types/scan'

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

interface UseMunicipalityResolverInput {
  allProjects: ProjectResponse[]
  topLevelProjects: ProjectResponse[]
  gemeenteGeojson: FeatureCollection | null | undefined
  scanHistory: ScanListItem[] | undefined
}

export function useMunicipalityResolver({
  allProjects,
  topLevelProjects,
  gemeenteGeojson,
  scanHistory,
}: UseMunicipalityResolverInput) {
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
    for (const scan of scanHistory ?? []) {
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
  }, [scanHistory, allProjects])

  const scanMetaByProjectId = useMemo(() => {
    const map = new Map<string, { gemeenteCode: string | null; wijkNaam: string | null; score: number; scanDateMs: number }>()
    for (const scan of scanHistory ?? []) {
      if (!scan.project_id) continue
      const current = map.get(scan.project_id)
      const next = { gemeenteCode: normalizeGemeenteCode(scan.gemeente_code), wijkNaam: scan.wijk_naam ?? null, score: scan.wijk_naam ? 2 : 0, scanDateMs: Date.parse(scan.scan_date) }
      if (!current) { map.set(scan.project_id, next); continue }
      if (next.score > current.score) { map.set(scan.project_id, next); continue }
      if (next.score === current.score && next.scanDateMs > current.scanDateMs) map.set(scan.project_id, next)
    }
    return new Map(Array.from(map.entries()).map(([id, v]) => [id, { gemeenteCode: v.gemeenteCode, wijkNaam: v.wijkNaam }]))
  }, [scanHistory])

  const knownWijkNames = useMemo(() => {
    const set = new Set<string>()
    for (const project of allProjects) {
      if (project.wijk_naam) set.add(normalizeAreaName(project.wijk_naam))
      else if (project.parent_id) set.add(normalizeAreaName(project.name))
    }
    for (const scan of scanHistory ?? []) {
      if (!scan.wijk_naam) continue
      set.add(normalizeAreaName(scan.wijk_naam))
    }
    return set
  }, [allProjects, scanHistory])

  const resolveGemeenteCodeForProject = useCallback((project: ProjectResponse): string | null => {
    const directCode = normalizeGemeenteCode(project.gemeente_code)
    if (directCode) return directCode
    if (!gemeenteGeojson) return null
    const target = normalizeAreaName(project.name)
    const match = gemeenteGeojson.features.find((f) => normalizeAreaName(String(f.properties?.statnaam ?? '')) === target)
    return normalizeGemeenteCode(match?.properties?.statcode as string | undefined)
  }, [gemeenteGeojson])

  const resolveGemeenteCodeWithScanFallback = useCallback((project: ProjectResponse): string | null => {
    const directCode = resolveGemeenteCodeForProject(project)
    const normalizedWijkName = normalizeAreaName(project.wijk_naam ?? project.name)
    const byWijkNameCode = wijkNameToUniqueGemeenteCode.get(normalizedWijkName) ?? null
    const byProjectScanCode = scanMetaByProjectId.get(project.id)?.gemeenteCode ?? null
    if (directCode) {
      const municipalityName = municipalityNameByCode.get(directCode)
      const looksLikeMunicipality = municipalityName ? isMunicipalityLikeProjectName(project.name, municipalityName, directCode) : false
      if (!looksLikeMunicipality && byWijkNameCode && byWijkNameCode !== directCode) return byWijkNameCode
      return directCode
    }
    return byWijkNameCode ?? byProjectScanCode
  }, [resolveGemeenteCodeForProject, wijkNameToUniqueGemeenteCode, scanMetaByProjectId, municipalityNameByCode])

  const inferIsWijkProject = useCallback((project: ProjectResponse): boolean => {
    if (project.parent_id) return true
    if (project.wijk_naam) return true
    if (scanMetaByProjectId.get(project.id)?.wijkNaam) return true
    if (knownWijkNames.has(normalizeAreaName(project.name))) return true
    const gemeenteCode = resolveGemeenteCodeWithScanFallback(project)
    if (!gemeenteCode) return false
    const municipalityName = municipalityNameByCode.get(gemeenteCode)
    if (!municipalityName) return false
    return !isMunicipalityLikeProjectName(project.name, municipalityName, gemeenteCode)
  }, [scanMetaByProjectId, knownWijkNames, resolveGemeenteCodeWithScanFallback, municipalityNameByCode])

  const municipalityProjectsByCode = useMemo(() => {
    const map = new Map<string, ProjectResponse>()
    for (const project of topLevelProjects) {
      if (inferIsWijkProject(project)) continue
      const code = resolveGemeenteCodeWithScanFallback(project)
      if (!code) continue
      const existing = map.get(code)
      if (!existing || (!existing.is_monitored && project.is_monitored)) map.set(code, project)
    }
    return map
  }, [topLevelProjects, inferIsWijkProject, resolveGemeenteCodeWithScanFallback])

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
  }, [topLevelProjects, inferIsWijkProject, resolveGemeenteCodeWithScanFallback])

  const regularProjects = useMemo(
    () => topLevelProjects.filter((p) => !inferIsWijkProject(p) && resolveGemeenteCodeWithScanFallback(p) === null),
    [topLevelProjects, inferIsWijkProject, resolveGemeenteCodeWithScanFallback]
  )

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, ProjectResponse[]>()
    for (const project of topLevelProjects) {
      if (!project.parent_id) continue
      const existing = map.get(project.parent_id) ?? []
      existing.push(project)
      map.set(project.parent_id, existing)
    }
    return map
  }, [topLevelProjects])

  return {
    municipalityNameByCode, scanMetaByProjectId, knownWijkNames,
    resolveGemeenteCodeForProject, resolveGemeenteCodeWithScanFallback, inferIsWijkProject,
    municipalityProjectsByCode, standaloneWijkProjectsByCode, regularProjects, childrenByParentId,
  }
}
