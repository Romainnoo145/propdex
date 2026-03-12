/**
 * DueDiligenceDashboard — replaces ReportDetailPage monolith
 *
 * Layout: left sidebar (220px) with SectionNav + main content pane
 * with URL-synced active section. All 7 sections wired as of Plan 107-03.
 */

import { useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from '@tanstack/react-router'
import type { PropertyReportResponse } from '@/lib/types/property'
import ReportHeader from './ReportHeader'
import { SectionNav, SECTIONS } from './components/SectionNav'
import { SectionShell } from './components/SectionShell'
import { parseNotes, computeSectionStatuses, EMPTY_STATUSES } from './components/sectionUtils'
import { useExportPDF } from '@/hooks/useReports'
import { useUpdateNotes } from '@/hooks/useReports'
import type { SectionKey } from './components/SectionNav'
import { S1Locatiegegevens } from './sections/S1Locatiegegevens'
import { S2KadasterEigendom } from './sections/S2KadasterEigendom'
import { S3BestemmingsplanBouwmogelijkheden } from './sections/S3BestemmingsplanBouwmogelijkheden'
import { S4Risicoprofiel } from './sections/S4Risicoprofiel'
import { S5PotentieRisicoAnalyse } from './sections/S5PotentieRisicoAnalyse'
import { S6VergunningenPrecedenten } from './sections/S6VergunningenPrecedenten'
import { S7Bronvermelding } from './sections/S7Bronvermelding'
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
    case 'analyse':
      return <S5PotentieRisicoAnalyse data={data} sourceParcelId={sourceParcelId} />
    case 'vergunningen':
      return <S6VergunningenPrecedenten data={data} sourceParcelId={sourceParcelId} />
    case 'bronnen':
      return <S7Bronvermelding data={data} />
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
