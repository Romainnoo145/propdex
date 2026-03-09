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
import { useParcelRiskProfile } from '@/hooks/useScans'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import type { ScanResultItem } from '@/lib/types/scan'

type PanelView =
  | { kind: 'overview' }
  | { kind: 'potentie' }
  | { kind: 'risico' }
  | { kind: 'markt' }
  | { kind: 'juridisch' }

interface ParcelDetailPanelProps {
  parcel: ScanResultItem
  onClose: () => void
}

export function ParcelDetailPanel({ parcel, onClose }: ParcelDetailPanelProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<PanelView>({ kind: 'overview' })
  const riskQuery = useParcelRiskProfile(parcel.parcel_id)
  const generateReport = useGenerateReportFromParcel()

  const handleSelectCategory = useCallback((cat: CategoryKey) => {
    setView({ kind: cat })
  }, [])

  const handleBack = useCallback(() => {
    setView({ kind: 'overview' })
  }, [])

  const handleGenerateReport = useCallback(() => {
    if (parcel.has_report) {
      // Navigate to report detail — parcel_id is enough to find it
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
        <div className="p-4">
          <button
            type="button"
            onClick={handleBack}
            className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-aura-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug
          </button>
          <p className="text-sm text-neutral-400">
            Detail layer komt binnenkort
          </p>
        </div>
      )}
    </ParcelPanelShell>
  )
}
