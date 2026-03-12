/**
 * DueDiligenceDashboard — replaces ReportDetailPage monolith
 *
 * Layout: left sidebar (220px) with SectionNav + main content pane
 * with URL-synced active section. Section content is deferred to Plan 107-02.
 */

import { useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from '@tanstack/react-router'
import type { PropertyReportResponse } from '@/lib/types/property'
import ReportHeader from './ReportHeader'
import { SectionNav, SECTIONS } from './components/SectionNav'
import { SectionShell } from './components/SectionShell'
import { useExportPDF } from '@/hooks/useReports'
import { useUpdateNotes } from '@/hooks/useReports'
import type { SectionKey } from './components/SectionNav'
import type { SectionStatus } from './components/SectionStatusBadge'
import { S1Locatiegegevens } from './sections/S1Locatiegegevens'
import { S2KadasterEigendom } from './sections/S2KadasterEigendom'
import { S3BestemmingsplanBouwmogelijkheden } from './sections/S3BestemmingsplanBouwmogelijkheden'
import { S4Risicoprofiel } from './sections/S4Risicoprofiel'
import {
  MapPin,
  Gavel,
  LandPlot,
  ShieldAlert,
  BarChart3,
  ScrollText,
  Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ─── Props ─────────────────────────────────────────────────── */

export interface DueDiligenceDashboardProps {
  data: PropertyReportResponse | null
  isLoading: boolean
  backLabel?: string
  sourceParcelId?: string | null
  reportId?: string | null
  notes?: string | null
  activeSection?: string
  onBack: () => void
  onViewOnMap: () => void
}

/* ─── Section icon map ─────────────────────────────────────── */

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  locatiegegevens: MapPin,
  kadaster: Gavel,
  bestemmingsplan: LandPlot,
  risicoprofiel: ShieldAlert,
  analyse: BarChart3,
  vergunningen: ScrollText,
  bronnen: Database,
}

/* ─── Notes helpers ─────────────────────────────────────────── */

/**
 * Parse notes field: accepts JSON object, plain string, or null.
 * Plain text is migrated into { locatiegegevens: text }.
 */
function parseNotes(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    // plain text migration
  }
  return { locatiegegevens: raw }
}

/* ─── Status computation ─────────────────────────────────────── */

function computeSectionStatuses(
  data: PropertyReportResponse,
): Record<SectionKey, SectionStatus> {
  const riskFieldCount = [
    data.fysiek_risico_profiel,
    data.funderingsrisico_flags,
    data.natura2000_flags,
    data.overstromingsrisico_flags,
    data.geluid_flags,
    data.luchtkwaliteit_flags,
    data.bodem_data ?? data.bodem_flags,
    data.asbest_indicator,
  ].filter(Boolean).length

  return {
    locatiegegevens: data.address ? 'complete' : 'empty',
    kadaster:
      data.cadastral_parcels.length > 0
        ? 'complete'
        : data.brk_ownership
          ? 'partial'
          : 'empty',
    bestemmingsplan: data.zoning
      ? data.zoning.plans.length > 0
        ? 'complete'
        : 'partial'
      : 'empty',
    risicoprofiel:
      riskFieldCount >= 4 ? 'complete' : riskFieldCount > 0 ? 'partial' : 'empty',
    analyse:
      data.scores_v3 != null || data.score_breakdown_v3 != null ? 'complete' : 'empty',
    vergunningen:
      data.permit_precedents
        ? 'complete'
        : (data.vergunningen_data?.length ?? 0) > 0
          ? 'partial'
          : 'empty',
    bronnen: data.section_sources.length > 0 ? 'complete' : 'empty',
  }
}

const EMPTY_STATUSES: Record<SectionKey, SectionStatus> = {
  locatiegegevens: 'empty',
  kadaster: 'empty',
  bestemmingsplan: 'empty',
  risicoprofiel: 'empty',
  analyse: 'empty',
  vergunningen: 'empty',
  bronnen: 'empty',
}

/* ─── Section title map ─────────────────────────────────────── */

const SECTION_TITLES: Record<SectionKey, string> = {
  locatiegegevens: '1. Locatiegegevens',
  kadaster: '2. Kadaster & Eigendom',
  bestemmingsplan: '3. Bestemmingsplan',
  risicoprofiel: '4. Risicoprofiel',
  analyse: '5. Potentie & Risico',
  vergunningen: '6. Vergunningen',
  bronnen: '7. Bronvermelding',
}

/* ─── Section content renderer ──────────────────────────────── */

function renderSectionContent(
  section: SectionKey,
  data: PropertyReportResponse,
  sourceParcelId: string | null | undefined,
): React.ReactNode {
  switch (section) {
    case 'locatiegegevens':
      return <S1Locatiegegevens data={data} sourceParcelId={sourceParcelId} />
    case 'kadaster':
      return <S2KadasterEigendom data={data} sourceParcelId={sourceParcelId} />
    case 'bestemmingsplan':
      return <S3BestemmingsplanBouwmogelijkheden data={data} sourceParcelId={sourceParcelId} />
    case 'risicoprofiel':
      return <S4Risicoprofiel data={data} sourceParcelId={sourceParcelId} />
    default:
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-center">
          <p className="text-[13px] font-semibold text-neutral-400">Sectie in voorbereiding</p>
        </div>
      )
  }
}

/* ─── Component ─────────────────────────────────────────────── */

export default function DueDiligenceDashboard({
  data,
  isLoading,
  backLabel = 'Terug',
  sourceParcelId,
  reportId,
  notes: rawNotes,
  activeSection: activeSectionProp,
  onBack,
  onViewOnMap,
}: DueDiligenceDashboardProps) {
  const navigate = useNavigate()
  const exportPDF = useExportPDF()
  const updateNotes = useUpdateNotes()

  // Resolve active section from prop or default
  const activeSection: SectionKey =
    activeSectionProp && SECTIONS.some((s) => s.key === activeSectionProp)
      ? (activeSectionProp as SectionKey)
      : 'locatiegegevens'

  const notes = parseNotes(rawNotes)
  const sectionStatuses = data ? computeSectionStatuses(data) : EMPTY_STATUSES

  const handleSectionSelect = useCallback(
    (key: SectionKey) => {
      // Update ?section= search param while preserving existing params
      const current = new URLSearchParams(window.location.search)
      current.set('section', key)
      window.history.pushState(null, '', `${window.location.pathname}?${current.toString()}`)
      // Force re-render by navigating with the router (replace to avoid double history entry)
      void navigate({
        to: '.',
        search: Object.fromEntries(current.entries()),
        replace: true,
      })
    },
    [navigate],
  )

  const handleExportPDF = useCallback(() => {
    if (!reportId) return
    exportPDF.mutate(reportId, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `rapport-${reportId}.pdf`
        anchor.click()
        URL.revokeObjectURL(url)
      },
    })
  }, [reportId, exportPDF])

  const handleNotesChange = useCallback(
    (sectionKey: string, text: string) => {
      if (!reportId) return
      const merged = { ...notes, [sectionKey]: text }
      updateNotes.mutate({ reportId, notes: JSON.stringify(merged) })
    },
    [reportId, notes, updateNotes],
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p
          className="text-neutral-400 text-sm"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Rapport laden...
        </p>
      </div>
    )
  }

  // Empty state
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p
          className="text-neutral-400 text-sm"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Rapport niet gevonden.
        </p>
      </div>
    )
  }

  const SectionIcon = SECTION_ICONS[activeSection]

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Report header (back button + property info) */}
      <div className="flex-shrink-0">
        <ReportHeader
          data={data}
          backLabel={backLabel}
          sourceParcelId={sourceParcelId ?? null}
          reportId={reportId ?? null}
          onBack={onBack}
          onViewOnMap={onViewOnMap}
        />
      </div>

      {/* Dashboard body: nav + content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: section nav */}
        <aside className="w-[220px] shrink-0 border-r border-neutral-100 overflow-y-auto px-3">
          <SectionNav
            activeSection={activeSection}
            onSelect={handleSectionSelect}
            sectionStatuses={sectionStatuses}
          />
        </aside>

        {/* Main content pane */}
        <main className="flex-1 min-w-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <SectionShell
                title={SECTION_TITLES[activeSection]}
                icon={<SectionIcon size={18} strokeWidth={1.5} />}
                status={sectionStatuses[activeSection]}
                sectionKey={activeSection}
                reportId={reportId ?? null}
                notes={notes}
                onNotesChange={handleNotesChange}
                onExportPDF={handleExportPDF}
              >
                {renderSectionContent(activeSection, data, sourceParcelId)}
              </SectionShell>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
