import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ParcelPanelShell } from './parcel/ParcelPanelShell'
import {
  ParcelBentoOverview,
  type CategoryKey,
} from './parcel/ParcelBentoOverview'
import { CategoryTabs } from './parcel/CategoryTabs'
import { PotentieLayer } from './parcel/layers/PotentieLayer'
import { RisicoLayer } from './parcel/layers/RisicoLayer'

import { JuridischLayer } from './parcel/layers/JuridischLayer'
import { useParcelRiskProfile } from '@/hooks/useScans'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import type { ScanResultItem } from '@/lib/types/scan'

type PanelView =
  | { kind: 'overview' }
  | { kind: 'potentie' }
  | { kind: 'risico' }
  | { kind: 'juridisch' }

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const VIEW_LABELS: Record<Exclude<PanelView['kind'], 'overview'>, string> = {
  potentie: 'Potentie',
  risico: 'Risico',
  juridisch: 'Juridisch',
}

interface ParcelDetailPanelProps {
  parcel: ScanResultItem
  onClose: () => void
}

export function ParcelDetailPanel({ parcel, onClose }: ParcelDetailPanelProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<PanelView>({ kind: 'overview' })
  const [trackedParcelId, setTrackedParcelId] = useState(parcel.parcel_id)
  const riskQuery = useParcelRiskProfile(parcel.parcel_id)
  const generateReport = useGenerateReportFromParcel()

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

  const handleGenerateReport = useCallback(() => {
    if (parcel.has_report) {
      navigate({ to: '/rapporten', search: { project_id: undefined, q: undefined } })
      return
    }
    generateReport.mutate(parcel.parcel_id, {
      onSuccess: () => {
        toast.success('Rapport wordt gegenereerd')
      },
      onError: () => {
        toast.error('Rapport genereren mislukt')
      },
    })
  }, [parcel, generateReport, navigate])

  const riskProfile = riskQuery.data?.fysiek_risico_profiel ?? null

  const footer = (
    <button
      type="button"
      onClick={handleGenerateReport}
      disabled={generateReport.isPending}
      className={`w-full h-14 rounded-full font-semibold text-lg transition-all disabled:opacity-60 ${
        parcel.has_report
          ? 'bg-aura-green text-white hover:bg-aura-green/90'
          : 'bg-[#0E1111] text-white hover:bg-[#1a1d1d] shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
      }`}
    >
      {generateReport.isPending
        ? 'Bezig...'
        : parcel.has_report
          ? 'Bekijk Rapport'
          : 'Genereer Rapport'}
    </button>
  )

  function renderDetailLayer() {
    switch (view.kind) {
      case 'potentie':
        return <PotentieLayer parcel={parcel} />
      case 'risico':
        return (
          <RisicoLayer
            parcel={parcel}
            riskProfile={riskProfile}
            isLoading={riskQuery.isLoading}
          />
        )
      case 'juridisch':
        return <JuridischLayer parcel={parcel} />
      default:
        return null
    }
  }

  return (
    <ParcelPanelShell onClose={onClose} footer={footer}>
      {/* Cross-fade on parcel change */}
      <motion.div
        key={parcel.parcel_id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col h-full overflow-y-auto"
      >
        {/* Address header */}
        <div className="px-8 pt-8">
          <div className="flex items-center gap-2">
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
            <div className="min-w-0">
              <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight truncate">
                {parcel.address || 'Onbekend adres'}
              </h2>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest truncate mt-1">
                {view.kind !== 'overview'
                  ? VIEW_LABELS[view.kind]
                  : parcel.parcel_code || null}
              </p>
            </div>
          </div>

          {/* Category tabs */}
          <div className="mt-8">
            <CategoryTabs
              activeCategory={view.kind !== 'overview' ? view.kind : null}
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
              className="mt-6"
            >
              <ParcelBentoOverview
                parcel={parcel}
                onSelectCategory={handleSelectCategory}
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
              className="flex-1 overflow-y-auto"
            >
              {renderDetailLayer()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </ParcelPanelShell>
  )
}
