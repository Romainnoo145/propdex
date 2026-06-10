/**
 * ScoreAnalysePanel — centered pop-up showing the Potentie/Overall/Risico
 * analyse for an off-market parcel.
 *
 * Potentie ring uses the card's use-case score (kans.potentie_score) so the
 * number matches the card + the map's type lens; overall/risico from scan-data.
 * Summary view (rings + top drivers) with a "toon alle factoren" expander.
 */
import { useEffect } from 'react'
import { useParcelScanData } from '@/hooks/useScans'
import { ScoreAnalyseOverview } from '@/components/reports/sections/ScoreAnalyseOverview'
import { analyseFromScanItem } from '@/components/reports/sections/scoreAnalyse'
import type { Kans } from '@/hooks/useDashboard'

export function ScoreAnalysePanel({ kans, onClose }: { kans: Kans; onClose: () => void }) {
  const scanData = useParcelScanData(kans.parcel_cache_id)
  const { scores, potentieFactors, risicoFactors } = analyseFromScanItem(scanData.data)

  // Headline potentie = the card's use-case score, so pop-up ↔ card ↔ map agree.
  const panelScores = scores
    ? { ...scores, potentie: kans.potentie_score ?? scores.potentie }
    : kans.potentie_score != null
      ? { potentie: kans.potentie_score, overall: undefined, risico: undefined }
      : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-[0_12px_48px_rgba(14,17,17,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold text-aura-ink">
              {kans.address ?? 'Ontwikkelkavel'}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-neutral-400">
              <span className="h-[5px] w-[5px] rounded-full bg-aura-amber" />
              {kans.projecttype ?? 'Ontwikkelpotentie'}
              {kans.wijk ? ` · ${kans.wijk}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="flex-none px-1 text-xl leading-none text-neutral-300 hover:text-neutral-500"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {scanData.isLoading && (
            <div className="py-16 text-center text-[13px] text-slate-400">Scores ophalen…</div>
          )}
          {scanData.isError && (
            <div className="py-16 text-center text-[13px] text-red-500">Kon scores niet laden</div>
          )}
          {scanData.isSuccess && (
            <>
              {kans.reason && (
                <div className="mb-5 rounded-[12px] bg-aura-canvas px-3 py-2.5 text-xs leading-snug text-aura-ink/70">
                  {kans.reason}
                </div>
              )}
              <ScoreAnalyseOverview
                variant="summary"
                scores={panelScores}
                potentieFactors={potentieFactors}
                risicoFactors={risicoFactors}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
