import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { LeftPanelShell } from './LeftPanelShell'
import { GemeenteHeader } from './gemeente/GemeenteHeader'
import { GemeenteCategoryTabs, type GemeenteLayer } from './gemeente/GemeenteCategoryTabs'
import { GemeenteOverview } from './gemeente/GemeenteOverview'
import { KlimaatLayer } from './gemeente/KlimaatLayer'
import { BestuurlijkTab } from './gemeente/BestuurlijkTab'
import { WijkenTab } from './gemeente/WijkenTab'
import { WijkenModal } from './gemeente/WijkenModal'
import type { ScanListItem } from '@/lib/types/scan'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const LAYER_LABELS: Record<GemeenteLayer, string> = {
  klimaat: 'Klimaat',
  bestuurlijk: 'Bestuurlijk',
  activiteit: 'Activiteit',
}

interface GemeenteContextPanelProps {
  naam: string
  code: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  scans: ScanListItem[]
  onClose: () => void
  onSelectWijk: (wijkCode: string, wijkNaam: string) => void
}

/**
 * Gemeente panel — het instituut-paneel.
 * Architecture mirrors ParcelDetailPanel: overview + 3 toggle layers.
 * Zero demografie — that lives in the wijk panel.
 */
export function GemeenteContextPanel({
  naam,
  code,
  wijkGeojson,
  scans,
  onClose,
  onSelectWijk,
}: GemeenteContextPanelProps) {
  const [activeLayer, setActiveLayer] = useState<GemeenteLayer | null>(null)
  const [showWijkenModal, setShowWijkenModal] = useState(false)

  const handleSelectLayer = useCallback((layer: GemeenteLayer) => {
    setActiveLayer(layer)
  }, [])

  const handleBack = useCallback(() => {
    setActiveLayer(null)
  }, [])

  return (
    <>
      <LeftPanelShell onClose={onClose}>
        <motion.div
          key={naam}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-full overflow-y-auto"
        >
          {/* ── Header ─────────────────────────────────── */}
          <div className="px-8 pt-8">
            <div className="flex items-center gap-2 pr-16">
              {activeLayer && (
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
                <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight truncate">
                  {naam}
                </h2>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest truncate mt-1">
                  {activeLayer ? LAYER_LABELS[activeLayer] : `Gemeente · ${code}`}
                </p>
              </div>
            </div>

            {/* ── Category Tabs ─────────────────────────── */}
            <div className="mt-6">
              <GemeenteCategoryTabs
                activeLayer={activeLayer}
                onSelect={handleSelectLayer}
              />
            </div>
          </div>

          {/* ── Content — AnimatePresence view switch ──── */}
          <AnimatePresence mode="wait">
            {activeLayer === null ? (
              <motion.div
                key="overview"
                initial={prefersReducedMotion ? false : { opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { y: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 flex-1 flex flex-col min-h-0"
              >
                <GemeenteOverview
                  naam={naam}
                  code={code}
                  gemeenteCode={code}
                  onSelectWijk={onSelectWijk}
                  onSwitchToKlimaat={() => setActiveLayer('klimaat')}
                  onSwitchToActiviteit={() => setActiveLayer('activiteit')}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeLayer}
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
                {activeLayer === 'klimaat' && (
                  <KlimaatLayer gemeenteNaam={naam} gemeenteCode={code} />
                )}
                {activeLayer === 'bestuurlijk' && (
                  <BestuurlijkTab gemeenteNaam={naam} />
                )}
                {activeLayer === 'activiteit' && (
                  <WijkenTab
                    wijkGeojson={wijkGeojson}
                    scans={scans}
                    gemeenteCode={code}
                    onSelectWijk={onSelectWijk}
                    onOpenModal={() => setShowWijkenModal(true)}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Trust metadata ──────────────────────────── */}
          <div className="px-8 pb-6 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-slate-300">
                Bron: Kadaster · PDOK · DSO
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-300">{code}</span>
            </div>
          </div>
        </motion.div>
      </LeftPanelShell>

      {/* Modals */}
      <AnimatePresence>
        {showWijkenModal && (
          <WijkenModal
            gemeenteNaam={naam}
            gemeenteCode={code}
            wijkGeojson={wijkGeojson}
            scans={scans}
            onClose={() => setShowWijkenModal(false)}
            onSelectWijk={(c, n) => { setShowWijkenModal(false); onSelectWijk(c, n) }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
