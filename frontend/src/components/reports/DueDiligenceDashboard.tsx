/**
 * DueDiligenceDashboard — single scrollable page with 7 collapsible sections.
 *
 * No sidebar. Each section is an accordion card (SectionShell).
 * First section (Locatiegegevens) starts expanded by default.
 */

import { useCallback } from 'react'
import type { PropertyReportResponse } from '@/lib/types/property'
import ReportHeader from './ReportHeader'
import { SectionShell } from './components/SectionShell'
import { parseNotes, computeSectionStatuses, EMPTY_STATUSES } from './components/sectionUtils'
import { useExportPDF, useUpdateNotes } from '@/hooks/useReports'
import type { SectionKey } from './components/sectionUtils'
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

/* ─── Section config ────────────────────────────────────────── */

interface SectionConfig {
  key: SectionKey
  title: string
  icon: LucideIcon
}

const SECTION_LIST: SectionConfig[] = [
  { key: 'locatiegegevens', title: '1. Locatiegegevens', icon: MapPin },
  { key: 'kadaster', title: '2. Kadaster & Eigendom', icon: Gavel },
  { key: 'bestemmingsplan', title: '3. Bestemmingsplan & Bouwmogelijkheden', icon: LandPlot },
  { key: 'risicoprofiel', title: '4. Risicoprofiel', icon: ShieldAlert },
  { key: 'analyse', title: '5. Potentie & Risico Analyse', icon: BarChart3 },
  { key: 'vergunningen', title: '6. Vergunningen & Precedenten', icon: ScrollText },
  { key: 'bronnen', title: '7. Bronvermelding', icon: Database },
]

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
  onBack,
  onViewOnMap,
}: DueDiligenceDashboardProps) {
  const exportPDF = useExportPDF()
  const updateNotes = useUpdateNotes()

  const notes = parseNotes(rawNotes)
  const sectionStatuses = data ? computeSectionStatuses(data) : EMPTY_STATUSES

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
          className="text-[#94a3b8] text-[13px]"
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
          className="text-[#94a3b8] text-[13px]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Rapport niet gevonden.
        </p>
      </div>
    )
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
    <div className="max-w-5xl mx-auto px-6 py-8 pb-12">
      <ReportHeader
        data={data}
        backLabel={backLabel}
        sourceParcelId={sourceParcelId ?? null}
        reportId={reportId ?? null}
        onBack={onBack}
        onViewOnMap={onViewOnMap}
        onExportPDF={handleExportPDF}
      />

      <div className="mt-6 space-y-3">
        {SECTION_LIST.map((section) => (
          <SectionShell
            key={section.key}
            title={section.title}
            icon={section.icon}
            status={sectionStatuses[section.key]}
            sectionKey={section.key}
            reportId={reportId ?? null}
            notes={notes}
            onNotesChange={handleNotesChange}
            onExportPDF={handleExportPDF}
            defaultOpen={section.key === 'locatiegegevens'}
          >
            {renderSectionContent(section.key, data, sourceParcelId)}
          </SectionShell>
        ))}
      </div>
    </div>
    </div>
  )
}
