import { useNavigate } from '@tanstack/react-router'
import type { ProjectResponse } from '@/lib/types/project'
import type { UnreadDetailResponse } from '@/lib/types/monitoring'
import type { GemeenteScopeCard } from '@/hooks/useMunicipalityWorkspaceStats'
import type { ScanListItem } from '@/lib/types/scan'
import { GemeenteDetailView } from './GemeenteDetailView'
import { WijkDetailView } from './WijkDetailView'
import { DrilldownBreadcrumb } from './DrilldownBreadcrumb'
import { UnlinkedGemeenteWorkspace } from './WijkView'
import { ProjectWorkspaceHeader, MonitoringToggleAction } from './WorkspaceHeader'
import { BellStatIcon, WijkStatIcon, ReportStatIcon } from './ProjectIcons'
import { toMapGemeenteWijkSearch } from '@/lib/navigation/mapSearch'
import { toProjectenRootSearch } from '@/lib/navigation/workspaceSearch'
import type { FeatureCollection } from 'geojson'

interface GemeenteViewProps {
  selectedGemeenteId: string | null
  selectedGemeenteCard: GemeenteScopeCard | null
  selectedWijkId: string | null
  selectedProvinceCode: string | null
  municipalityProjectsById: Map<string, ProjectResponse>
  childrenByParentId: Map<string, ProjectResponse[]>
  standaloneWijkProjectsByCode: Map<string, ProjectResponse[]>
  detailWijkGeojson: FeatureCollection | null | undefined
  scanWijkNamesByGemeenteCode: Map<string, Set<string>>
  selectedGemeenteChanges: { total: number } | null | undefined
  scanHistory: ScanListItem[]
  selectedGemeenteWijkReportCounts: Map<string, number>
  unreadData: UnreadDetailResponse | undefined
  gemeenteGeojson: FeatureCollection | null
  setMonitoringIsPending: boolean
  resolveGemeenteCodeForProject: (project: ProjectResponse) => string | null
  handleSetGemeenteMonitoring: (
    gemeenteCode: string | null,
    gemeenteNaam: string,
    enabled: boolean
  ) => void
  normalizeAreaName: (name: string) => string
}

export function GemeenteView({
  selectedGemeenteId,
  selectedGemeenteCard,
  selectedWijkId,
  selectedProvinceCode,
  municipalityProjectsById,
  childrenByParentId,
  standaloneWijkProjectsByCode,
  detailWijkGeojson,
  scanWijkNamesByGemeenteCode,
  selectedGemeenteChanges,
  scanHistory,
  selectedGemeenteWijkReportCounts,
  unreadData,
  gemeenteGeojson,
  setMonitoringIsPending,
  resolveGemeenteCodeForProject,
  handleSetGemeenteMonitoring,
  normalizeAreaName,
}: GemeenteViewProps) {
  const navigate = useNavigate()

  if (selectedGemeenteId) {
    const gemeente = municipalityProjectsById.get(selectedGemeenteId)
    if (!gemeente) return null

    const gemeenteCode = resolveGemeenteCodeForProject(gemeente)
    const gemeenteForDetail =
      gemeenteCode && gemeente.gemeente_code !== gemeenteCode
        ? { ...gemeente, gemeente_code: gemeenteCode }
        : gemeente
    const linkedChildren = childrenByParentId.get(gemeente.id) ?? []
    const standaloneChildren = gemeenteCode ? (standaloneWijkProjectsByCode.get(gemeenteCode) ?? []) : []
    const wijkChildren = [...linkedChildren, ...standaloneChildren]
    const existingWijkNameSet = new Set(
      wijkChildren.map((wijk) => normalizeAreaName(wijk.wijk_naam ?? wijk.name))
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
    const completedWijkenCount = gemeenteCode ? (scanWijkNamesByGemeenteCode.get(gemeenteCode)?.size ?? 0) : 0

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
          subtitle={`${allWijkChildren.length} wijken totaal · ${wijkChildren.length} gekoppeld · ${completedWijkenCount} gescand`}
          onBack={() => navigate({ to: '/projecten', search: toProjectenRootSearch({ provincieCode: selectedProvinceCode }) })}
          backLabel="Terug naar projecten"
          metrics={[
            { label: 'Wijken', value: allWijkChildren.length, icon: <WijkStatIcon /> },
            {
              label: 'Rapporten',
              value: gemeente.report_count + wijkChildren.reduce((sum, wijk) => sum + wijk.report_count, 0),
              icon: <ReportStatIcon />,
            },
            { label: 'Meldingen', value: selectedGemeenteChanges?.total ?? 0, icon: <BellStatIcon />, highlight: (selectedGemeenteChanges?.total ?? 0) > 0 },
          ]}
          actionLabel="Bekijk op kaart"
          onAction={gemeenteCode ? () => navigate({ to: '/map', search: toMapGemeenteWijkSearch({ gemeenteCode }) }) : undefined}
          extraActions={
            <MonitoringToggleAction
              enabled={gemeente.is_monitored}
              pending={setMonitoringIsPending}
              onClick={() => handleSetGemeenteMonitoring(gemeenteCode, gemeente.name, !gemeente.is_monitored)}
            />
          }
        />
        <GemeenteDetailView
          gemeente={gemeenteForDetail}
          wijkProjects={allWijkChildren}
          unreadData={unreadData}
          gemeenteGeojson={gemeenteGeojson}
          scannedWijkNames={gemeenteCode ? (scanWijkNamesByGemeenteCode.get(gemeenteCode) ?? null) : null}
        />
      </>
    )
  }

  if (selectedGemeenteCard) {
    return (
      <>
        <ProjectWorkspaceHeader
          title={selectedGemeenteCard.naam}
          subtitle={`${selectedGemeenteCard.linkedWijken} gekoppeld · ${selectedGemeenteCard.completedWijken} gescand`}
          onBack={() => navigate({ to: '/projecten', search: toProjectenRootSearch({ provincieCode: selectedProvinceCode }) })}
          backLabel="Terug naar projecten"
          metrics={[
            { label: 'Wijken', value: selectedGemeenteCard.linkedWijken, icon: <WijkStatIcon /> },
            { label: 'Rapporten', value: selectedGemeenteCard.rapporten, icon: <ReportStatIcon /> },
            { label: 'Meldingen', value: selectedGemeenteCard.meldingen, icon: <BellStatIcon />, highlight: selectedGemeenteCard.meldingen > 0 },
          ]}
          actionLabel="Bekijk op kaart"
          onAction={() => navigate({ to: '/map', search: toMapGemeenteWijkSearch({ gemeenteCode: selectedGemeenteCard.code }) })}
          extraActions={
            <MonitoringToggleAction
              enabled={Boolean(selectedGemeenteCard.project?.is_monitored)}
              pending={setMonitoringIsPending}
              onClick={() =>
                handleSetGemeenteMonitoring(
                  selectedGemeenteCard.code,
                  selectedGemeenteCard.naam,
                  !selectedGemeenteCard.project?.is_monitored
                )
              }
            />
          }
        />
        <UnlinkedGemeenteWorkspace
          gemeenteCode={selectedGemeenteCard.code}
          gemeenteName={selectedGemeenteCard.naam}
          gemeenteGeometry={selectedGemeenteCard.geometry}
          scanHistory={scanHistory}
          wijkReportCounts={selectedGemeenteWijkReportCounts}
        />
      </>
    )
  }

  return null
}

// Re-export WorkspaceHeader components for use in ProjectenPage
export { ProjectWorkspaceHeader, MonitoringToggleAction } from './WorkspaceHeader'
