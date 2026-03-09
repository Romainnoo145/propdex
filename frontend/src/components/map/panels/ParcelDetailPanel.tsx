import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
      className={`w-full rounded-full py-2.5 font-semibold transition-colors disabled:opacity-60 ${
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
    <ParcelPanelShell
      parcelId={parcel.parcel_id}
      onClose={onClose}
      footer={footer}
    >
      <ParcelHero parcelId={parcel.parcel_id} score={parcel.score} />

      {view.kind === 'overview' ? (
        <ParcelBentoOverview
          parcel={parcel}
          riskProfile={riskProfile}
          onSelectCategory={handleSelectCategory}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-2 pb-1">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-aura-ink transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {VIEW_LABELS[view.kind]}
            </button>
          </div>
          {renderDetailLayer()}
        </div>
      )}
    </ParcelPanelShell>
  )
}
