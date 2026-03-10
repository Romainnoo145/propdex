import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ParcelPanelShell } from './parcel/ParcelPanelShell'
import { ParcelHero } from './parcel/ParcelHero'
import {
  ParcelBentoOverview,
  type CategoryKey,
} from './parcel/ParcelBentoOverview'
import { PotentieLayer } from './parcel/layers/PotentieLayer'
import { RisicoLayer } from './parcel/layers/RisicoLayer'
import { MarktLayer } from './parcel/layers/MarktLayer'
import { JuridischLayer } from './parcel/layers/JuridischLayer'
import { useParcelRiskProfile } from '@/hooks/useScans'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import type { ScanResultItem } from '@/lib/types/scan'

type PanelView =
  | { kind: 'overview' }
  | { kind: 'potentie' }
  | { kind: 'risico' }
  | { kind: 'markt' }
  | { kind: 'juridisch' }

const VIEW_LABELS: Record<Exclude<PanelView['kind'], 'overview'>, string> = {
  potentie: 'Potentie',
  risico: 'Risico',
  markt: 'Markt',
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
      className={`w-full rounded-full py-3 font-semibold text-sm transition-colors disabled:opacity-60 ${
        parcel.has_report
          ? 'bg-aura-green text-white hover:bg-aura-green/90'
          : 'bg-aura-obsidian text-white hover:bg-aura-obsidian/90'
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
      case 'markt':
        return <MarktLayer parcel={parcel} />
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
        className="flex flex-col h-full"
      >
        <ParcelHero parcelId={parcel.parcel_id} score={parcel.score} />

        {/* Sticky address header — persists in both overview and detail views */}
        <div className="px-4 py-3 flex items-center gap-2">
          {view.kind !== 'overview' && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center h-7 w-7 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors shrink-0"
              aria-label="Terug"
            >
              <ArrowLeft className="h-4 w-4 text-aura-ink" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-aura-ink truncate">
              {parcel.address || parcel.parcel_code || 'Onbekend adres'}
            </h2>
            {view.kind !== 'overview' && (
              <p className="text-xs text-neutral-500">{VIEW_LABELS[view.kind]}</p>
            )}
          </div>
        </div>

        {view.kind === 'overview' ? (
          <ParcelBentoOverview
            parcel={parcel}
            riskProfile={riskProfile}
            onSelectCategory={handleSelectCategory}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {renderDetailLayer()}
          </div>
        )}
      </motion.div>
    </ParcelPanelShell>
  )
}
