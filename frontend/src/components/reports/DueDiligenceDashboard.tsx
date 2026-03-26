/**
 * DueDiligenceDashboard — single scrollable page with 7 collapsible sections.
 *
 * No sidebar. Each section is an accordion card (SectionShell).
 * First section (Locatiegegevens) starts expanded by default.
 */

import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PropertyReportResponse } from '@/lib/types/property'
import ReportHeader from './ReportHeader'
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
  shortTitle: string
}

const SECTION_LIST: SectionConfig[] = [
  { key: 'locatiegegevens', title: '1. Locatiegegevens', shortTitle: 'Locatie' },
  { key: 'kadaster', title: '2. Kadaster & Eigendom', shortTitle: 'Kadaster' },
  { key: 'bestemmingsplan', title: '3. Bestemmingsplan & Bouwmogelijkheden', shortTitle: 'Bestemming' },
  { key: 'risicoprofiel', title: '4. Risicoprofiel', shortTitle: 'Risico' },
  { key: 'analyse', title: '5. Potentie & Risico Analyse', shortTitle: 'Analyse' },
  { key: 'vergunningen', title: '6. Vergunningen & Precedenten', shortTitle: 'Vergunningen' },
  { key: 'bronnen', title: '7. Bronvermelding', shortTitle: 'Bronnen' },
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- will be used for section status indicators
  const _sectionStatuses = data ? computeSectionStatuses(data) : EMPTY_STATUSES
  const [activeSection, setActiveSection] = useState<SectionKey>('locatiegegevens')
  const [notesOpen, setNotesOpen] = useState(false)

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
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <ReportHeader
        data={data}
        backLabel={backLabel}
        sourceParcelId={sourceParcelId ?? null}
        reportId={reportId ?? null}
        onBack={onBack}
        onViewOnMap={onViewOnMap}
        onExportPDF={handleExportPDF}
      />

      {/* Section tabs — workspace pattern */}
      <div className="overflow-x-auto pb-1">
        <div className="flex h-[48px] min-w-max rounded-full bg-[#F2F6F3] p-1">
          {SECTION_LIST.map((section) => {
            const isActive = section.key === activeSection
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className="relative flex h-full min-w-[124px] flex-1 items-center justify-center rounded-full px-4 transition-colors"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: isActive ? '-0.01em' : '0',
                  color: isActive ? undefined : '#94a3b8',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="rapport-section-tab"
                    className="absolute inset-0 rounded-full"
                    style={{ background: '#0E1111' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>
                  {section.shortTitle}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Active section content — workspace pattern: card wrapper */}
      <div className="mt-4 rounded-[32px] border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="rounded-[20px] border border-slate-100 bg-slate-50/50 px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderSectionContent(activeSection, data, sourceParcelId)}

            {/* Notes footer */}
            {reportId && (
            <div className="mt-6 border-t border-[#EAEFEF] pt-4">
                <button
                  type="button"
                  onClick={() => setNotesOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] px-3 py-1.5 text-[12px] font-semibold text-[#94a3b8] hover:text-[#1A1C1E] transition-colors"
                >
                  Notities
                </button>
            </div>
            )}

            {notesOpen && reportId && (
              <div className="mt-3">
                <textarea
                  value={notes[activeSection] ?? ''}
                  onChange={(e) => handleNotesChange(activeSection, e.target.value)}
                  placeholder="Voeg notities toe voor deze sectie..."
                  rows={3}
                  className="w-full resize-none rounded-[12px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2 text-[13px] text-[#1A1C1E] placeholder-[#94a3b8] outline-none"
                />
              </div>
            )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
