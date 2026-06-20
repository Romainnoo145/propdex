import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { ParcelPanelShell } from './parcel/ParcelPanelShell'
import { ParcelScoreHero } from './parcel/ParcelScoreHero'
import { ParcelFactorList } from './parcel/ParcelFactorList'
import { HeartButton, shouldShowProjectTypePicker } from './parcel/HeartButton'
import { ProjectTypePickerModal } from '@/components/parcel/ProjectTypePickerModal'
import { countMissingFactors } from './parcel/ScoreBreakdownModal'
import { OmgevingsvisieDetailContent, type GebiedPolicy, type BeleidsVerdict, type Randvoorwaarde } from './parcel/OmgevingsvisiePopup'
import { WoonvisieDetailContent, type WijkPolicy } from './parcel/WoonvisiePopup'
import { BronnenLayer } from './parcel/layers/BronnenLayer'
import { useParcelProjectType } from '@/hooks/useParcelProjectType'
import { useParcelFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import type { ScanResultItem } from '@/lib/types/scan'

/**
 * ParcelDetailPanel — single-scroll redesign (Optie B).
 *
 * Sticky hero (address + score) · scrollable weight-sorted factor list ·
 * sticky "Bewaar perceel" CTA. No category tabs, no page toggles. Clicking a
 * factor card opens its drill-down (woonvisie / omgevingsvisie in-panel; the
 * grondprijs / opkoop / parkeer popups live in ParcelFactorList). The Dossiers
 * entry swaps the scroll body for the BronnenLayer with a back button.
 */

type PanelView = 'list' | 'omgevingsvisie' | 'woonvisie' | 'dossiers'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const VIEW_LABELS: Record<Exclude<PanelView, 'list'>, string> = {
  omgevingsvisie: 'Omgevingsvisie',
  woonvisie: 'Woonvisie',
  dossiers: 'Dossiers',
}

interface ParcelDetailPanelProps {
  parcel: ScanResultItem
  onClose: () => void
  gemeenteNaam?: string | null
  wijkNaam?: string | null
}

export function ParcelDetailPanel({ parcel, onClose, gemeenteNaam, wijkNaam }: ParcelDetailPanelProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<PanelView>('list')
  const [showPicker, setShowPicker] = useState(false)
  const [trackedParcelId, setTrackedParcelId] = useState(parcel.parcel_id)
  const { data: projectTypeData } = useParcelProjectType(parcel.parcel_id)
  const projectType = projectTypeData?.project_type ?? 'onbepaald'
  const favoritesQuery = useParcelFavorites()
  const toggleFavorite = useToggleFavorite()
  const matchedFavorite = useMemo(
    () => (favoritesQuery.data ?? []).find((f) => f.parcel_id === parcel.parcel_code),
    [favoritesQuery.data, parcel.parcel_code],
  )
  const isFavorited = !!matchedFavorite

  // Reset to list when parcel changes (derived state pattern)
  if (trackedParcelId !== parcel.parcel_id) {
    setTrackedParcelId(parcel.parcel_id)
    setView('list')
  }

  const handleBack = useCallback(() => setView('list'), [])

  const hasReport = !!(matchedFavorite?.has_report && matchedFavorite?.report_id)
  const isGeneratingReport = isFavorited && !hasReport

  const handleCta = useCallback(() => {
    if (hasReport) {
      navigate({ to: "/rapport/$id", params: { id: matchedFavorite!.report_id! } })
      return
    }
    if (!isFavorited) {
      toggleFavorite.mutate(
        { parcel, isFavorited, gemeenteNaam, wijkNaam },
        {
          // M052/S01 follow-up: CTA-button also opens project-type picker after
          // creating a favorite (parity with HeartButton flow).
          onSuccess: (data) => {
            if (shouldShowProjectTypePicker(isFavorited, data)) {
              setShowPicker(true)
            }
          },
        },
      )
    }
  }, [isFavorited, hasReport, matchedFavorite, parcel, toggleFavorite, navigate, gemeenteNaam, wijkNaam])

  const footer = (
    <button
      type="button"
      onClick={handleCta}
      disabled={toggleFavorite.isPending || isGeneratingReport}
      className={`w-full h-[60px] rounded-full text-[15px] font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-60 ${
        hasReport
          ? 'bg-aura-green text-white hover:bg-aura-green/90'
          : isGeneratingReport
            ? 'bg-amber-500 text-white'
            : 'bg-[#0E1111] text-white hover:bg-slate-800'
      }`}
    >
      {toggleFavorite.isPending
        ? 'Bezig...'
        : isGeneratingReport
          ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Rapport genereren...
            </span>
          )
          : hasReport
            ? 'Bekijk Rapport'
            : 'Bewaar perceel'}
    </button>
  )

  /** Back-nav row shown above an in-panel drill-down. */
  const backHeader = (label: string) => (
    <div className="flex items-center gap-2 px-8 pt-6">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center justify-center h-7 w-7 rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-colors shrink-0"
        aria-label="Terug naar overzicht"
      >
        <ArrowLeft className="h-4 w-4 text-aura-ink" />
      </button>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-widest truncate">
        {label}
      </p>
    </div>
  )

  function renderBody() {
    switch (view) {
      case 'list':
        return (
          <ParcelFactorList
            parcel={parcel}
            gemeenteNaam={gemeenteNaam ?? ''}
            onOpenWoonvisie={() => setView('woonvisie')}
            onOpenOmgevingsvisie={() => setView('omgevingsvisie')}
            onOpenDossiers={() => setView('dossiers')}
          />
        )
      case 'dossiers':
        return (
          <div className="flex flex-col flex-1 min-h-0">
            {backHeader(VIEW_LABELS.dossiers)}
            <BronnenLayer parcel={parcel} hasReport={hasReport} />
          </div>
        )
      case 'omgevingsvisie': {
        const waarde = (parcel.score_breakdown as Record<string, { waarde?: unknown } | undefined> | null)
          ?.['beleidsalignement']?.waarde as {
          matched_gebied: string | null
          matched_policy: GebiedPolicy | null
          algemeen_citaat: string
          tijdshorizon: number
          verdict?: string
          randvoorwaarden?: Randvoorwaarde[]
        } | null | undefined
        return (
          <div className="flex flex-col">
            {backHeader(VIEW_LABELS.omgevingsvisie)}
            {waarde ? (
              <div className="px-8 py-6">
                <OmgevingsvisieDetailContent
                  gemeente={gemeenteNaam ?? ''}
                  tijdshorizon={waarde.tijdshorizon ?? 0}
                  matched_policy={waarde.matched_policy}
                  algemeen_citaat={waarde.algemeen_citaat ?? ''}
                  verdict={waarde.verdict as BeleidsVerdict | undefined}
                  randvoorwaarden={waarde.randvoorwaarden}
                />
              </div>
            ) : (
              <div className="px-8 py-6 text-[13px] text-slate-400 italic">
                Geen omgevingsvisie-beleid voor dit perceel.
              </div>
            )}
          </div>
        )
      }
      case 'woonvisie': {
        const waarde = (parcel.score_breakdown as Record<string, { waarde?: unknown } | undefined> | null)
          ?.['woonvisie_match']?.waarde as {
          matched_wijk: string | null
          matched_policy: WijkPolicy | null
          algemeen_citaat: string
          periode_start?: number
          periode_einde?: number
          randvoorwaarden?: Randvoorwaarde[]
        } | null | undefined
        return (
          <div className="flex flex-col">
            {backHeader(VIEW_LABELS.woonvisie)}
            {waarde ? (
              <div className="px-8 py-6">
                <WoonvisieDetailContent
                  gemeente={gemeenteNaam ?? ''}
                  periode_start={waarde.periode_start ?? 0}
                  periode_einde={waarde.periode_einde ?? 0}
                  matched_policy={waarde.matched_policy}
                  algemeen_citaat={waarde.algemeen_citaat ?? ''}
                  project_type={projectType}
                  randvoorwaarden={waarde.randvoorwaarden}
                />
              </div>
            ) : (
              <div className="px-8 py-6 text-[13px] text-slate-400 italic">
                Geen woonvisie-beleid voor dit perceel.
              </div>
            )}
          </div>
        )
      }
    }
  }

  return (
    <>
      <ParcelPanelShell
        onClose={onClose}
        footer={footer}
        headerActions={<HeartButton parcel={parcel} gemeenteNaam={gemeenteNaam} wijkNaam={wijkNaam} />}
        hero={<ParcelScoreHero parcel={parcel} missingCount={countMissingFactors(parcel.score_breakdown)} />}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${parcel.parcel_id}-${view}`}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={prefersReducedMotion ? { duration: 0.15 } : { duration: 0.2 }}
            className="min-h-full flex flex-col"
          >
            {renderBody()}
          </motion.div>
        </AnimatePresence>
      </ParcelPanelShell>
      {showPicker && parcel.parcel_code && (
        <ProjectTypePickerModal
          open={showPicker}
          onClose={() => setShowPicker(false)}
          parcelId={parcel.parcel_code}
          currentType={null}
          onSkip={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
