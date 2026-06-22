import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { ParcelPanelShell } from './parcel/ParcelPanelShell'
import { HeartButton, shouldShowProjectTypePicker } from './parcel/HeartButton'
import { ProjectTypePickerModal } from '@/components/parcel/ProjectTypePickerModal'
import { MissingDataBadge } from './parcel/MissingDataBadge'
import { countMissingFactors } from './parcel/ScoreBreakdownModal'
import {
  ParcelBentoOverview,
  type CategoryKey,
} from './parcel/ParcelBentoOverview'
import { CategoryTabs } from './parcel/CategoryTabs'
import { PotentieLayer } from './parcel/layers/PotentieLayer'
import { RisicoLayer } from './parcel/layers/RisicoLayer'

import { BronnenLayer } from './parcel/layers/BronnenLayer'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useParcelFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import type { ScanResultItem } from '@/lib/types/scan'

/** Split "Straat 1, 1234AB Venlo" → ["Straat 1", ", 1234AB Venlo"] for clean truncation */
function splitAddress(address: string | null): [string, string] {
  if (!address) return ['Onbekend adres', '']
  const m = address.match(/^(.+?)\s*(,\s*\d{4}\s?[A-Z]{2}.*)$/)
  return m ? [m[1] ?? address, m[2] ?? ''] : [address, '']
}

type PanelView =
  | { kind: 'overview' }
  | { kind: 'potentie' }
  | { kind: 'risico' }
  | { kind: 'dossiers' }

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const VIEW_LABELS: Record<Exclude<PanelView['kind'], 'overview'>, string> = {
  potentie: 'Potentie',
  risico: 'Risico',
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
  const [view, setView] = useState<PanelView>({ kind: 'overview' })
  const [showPicker, setShowPicker] = useState(false)
  const [trackedParcelId, setTrackedParcelId] = useState(parcel.parcel_id)
  const enrichmentQuery = useParcelEnrichment(parcel.parcel_id)
  const favoritesQuery = useParcelFavorites()
  const toggleFavorite = useToggleFavorite()
  const matchedFavorite = useMemo(
    () => (favoritesQuery.data ?? []).find((f) => f.parcel_id === parcel.parcel_code),
    [favoritesQuery.data, parcel.parcel_code],
  )
  const isFavorited = !!matchedFavorite

  // Reset to overview when parcel changes (derived state pattern)
  if (trackedParcelId !== parcel.parcel_id) {
    setTrackedParcelId(parcel.parcel_id)
    setView({ kind: 'overview' })
  }

  const handleSelectCategory = useCallback((cat: CategoryKey) => {
    setView({ kind: cat })
  }, [])

  const handleBack = useCallback(() => {
    setView({ kind: 'overview' })
  }, [])

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

  function renderDetailLayer() {
    switch (view.kind) {
      case 'potentie':
        return (
          <PotentieLayer
            parcel={parcel}
            gemeenteNaam={gemeenteNaam ?? ''}
          />
        )
      case 'risico':
        return <RisicoLayer parcel={parcel} />
      case 'dossiers':
        return <BronnenLayer parcel={parcel} hasReport={hasReport} />
      default:
        return null
    }
  }

  return (
    <>
    <ParcelPanelShell onClose={onClose} footer={footer} headerActions={<HeartButton parcel={parcel} gemeenteNaam={gemeenteNaam} wijkNaam={wijkNaam} />}>
      {/* Cross-fade on parcel change */}
      <motion.div
        key={parcel.parcel_id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col h-full"
      >
        {/* Address header */}
        <div className="px-8 pt-8">
          <div className="flex items-center gap-2 pr-20">
            {view.kind !== 'overview' && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center justify-center h-7 w-7 rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-colors shrink-0"
                aria-label="Terug"
              >
                <ArrowLeft className="h-4 w-4 text-aura-ink" />
              </button>
            )}
            <div className="min-w-0 max-w-full">
              <h2 className="flex text-[28px] font-bold tracking-tighter text-slate-900 leading-tight overflow-hidden whitespace-nowrap">
                <span className="truncate">{splitAddress(parcel.address)[0]}</span>
                <span className="shrink-0">{splitAddress(parcel.address)[1]}</span>
              </h2>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest truncate">
                  {view.kind !== 'overview'
                    ? VIEW_LABELS[view.kind]
                    : parcel.parcel_code || null}
                </p>
                {view.kind === 'overview' && (
                  <MissingDataBadge count={countMissingFactors(parcel.score_breakdown)} />
                )}
              </div>
            </div>
          </div>

          {/* Category tabs */}
          <div className="mt-4">
            <CategoryTabs
              activeCategory={view.kind === 'overview' ? null : view.kind}
              onSelect={handleSelectCategory}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {view.kind === 'overview' ? (
            <motion.div
              key="overview"
              initial={prefersReducedMotion ? false : { opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 flex-1 flex flex-col min-h-0"
            >
              <ParcelBentoOverview
                parcel={parcel}
                onSelectCategory={handleSelectCategory}
                meldingenCount={enrichmentQuery.data?.enrichment_data?.vergunningen?.length ?? null}
                vergunningen={enrichmentQuery.data?.enrichment_data?.vergunningen ?? []}
              />
            </motion.div>
          ) : (
            <motion.div
              key={view.kind}
              initial={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.15 }
                  : { type: 'spring', stiffness: 400, damping: 30 }
              }
              className="flex-1 flex flex-col overflow-y-auto"
            >
              {renderDetailLayer()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
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
