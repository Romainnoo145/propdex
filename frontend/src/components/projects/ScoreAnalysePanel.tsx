/**
 * ScoreAnalysePanel — right-side slide-in showing the full Potentie/Risico/
 * Overall analyse for an off-market parcel (same overview as the report's
 * "Analyse" tab). Replaces the thin KansScoresModal.
 *
 * Fetches the parcel's scan-data on open and renders the shared
 * ScoreAnalyseOverview. The parcel's stored data is read-only.
 */
import { Drawer } from '@/components/ui/Drawer'
import { useParcelScanData } from '@/hooks/useScans'
import { ScoreAnalyseOverview } from '@/components/reports/sections/ScoreAnalyseOverview'
import { analyseFromScanItem } from '@/components/reports/sections/scoreAnalyse'
import type { Kans } from '@/hooks/useDashboard'

export function ScoreAnalysePanel({
  kans,
  onClose,
  onOpenMap,
}: {
  kans: Kans
  onClose: () => void
  onOpenMap: () => void
}) {
  const scanData = useParcelScanData(kans.parcel_id)
  const { scores, potentieFactors, risicoFactors } = analyseFromScanItem(scanData.data)

  return (
    <Drawer isOpen onClose={onClose} width="md" title={`Scores — ${kans.address ?? 'Ontwikkelkavel'}`}>
      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#EAEFEF] bg-white/80 px-6 py-4 backdrop-blur-[24px]">
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
        <div className="flex-1 px-6 py-5">
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
                scores={scores}
                potentieFactors={potentieFactors}
                risicoFactors={risicoFactors}
              />
            </>
          )}
        </div>

        {/* Footer action */}
        <div className="sticky bottom-0 border-t border-[#EAEFEF] bg-white/80 px-6 py-4 backdrop-blur-[24px]">
          <button
            onClick={onOpenMap}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-aura-obsidian text-[13px] font-semibold text-aura-amber hover:bg-aura-obsidian/90"
          >
            Bekijk op kaart
          </button>
        </div>
      </div>
    </Drawer>
  )
}
