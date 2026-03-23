import { useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { LeftPanelShell } from './LeftPanelShell'
import { GemeenteCategoryTabs, type GemeenteLayer } from './gemeente/GemeenteCategoryTabs'
import { GemeenteOverview } from './gemeente/GemeenteOverview'
import { KlimaatLayer } from './gemeente/KlimaatLayer'
import { BestuurlijkLayer } from './gemeente/BestuurlijkLayer'
import { ActiviteitLayer } from './gemeente/ActiviteitLayer'
import type { ScanListItem } from '@/lib/types/scan'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const LAYER_LABELS: Record<GemeenteLayer, string> = {
  vergunningen: 'Vergunningen',
  regelgeving: 'Regelgeving',
  beleid: 'Beleid & Nieuws',
  activiteit: 'Mijn Activiteit',
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
 * Overview (default) + 4 toggle layers:
 *   Vergunningen / Regelgeving / Beleid & Nieuws / Mijn Activiteit
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

  const handleSelectLayer = useCallback((layer: GemeenteLayer) => {
    setActiveLayer(layer)
  }, [])

  const handleBack = useCallback(() => {
    setActiveLayer(null)
  }, [])

  const wijkCount = useMemo(() => {
    return wijkGeojson?.features?.length ?? 0
  }, [wijkGeojson])

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
                  wijkCount={wijkCount}
                  onSelectWijk={onSelectWijk}
                  onSwitchToVergunningen={() => setActiveLayer('vergunningen')}
                  onSwitchToRegelgeving={() => setActiveLayer('regelgeving')}
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
                {/* Vergunningen tab — reuses KlimaatLayer for now (S02 will replace) */}
                {activeLayer === 'vergunningen' && (
                  <KlimaatLayer gemeenteNaam={naam} gemeenteCode={code} />
                )}
                {/* Regelgeving tab — reuses BestuurlijkLayer for now (S03 will replace) */}
                {activeLayer === 'regelgeving' && (
                  <BestuurlijkLayer gemeenteNaam={naam} />
                )}
                {/* Beleid & Nieuws — placeholder, S04 will build */}
                {activeLayer === 'beleid' && (
                  <div className="flex-1 flex items-center justify-center px-8">
                    <p className="text-[13px] text-neutral-400 text-center">
                      Beleid & Nieuws wordt binnenkort toegevoegd.
                    </p>
                  </div>
                )}
                {/* Mijn Activiteit — reuses ActiviteitLayer for now (S05 will replace) */}
                {activeLayer === 'activiteit' && (
                  <ActiviteitLayer
                    scans={scans}
                    gemeenteCode={code}
                    wijkGeojson={wijkGeojson}
                    onSelectWijk={onSelectWijk}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Trust metadata ──────────────────────────── */}
          <div className="px-8 pb-6 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-slate-300">
                Bron: Kadaster · PDOK · DSO
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-300">{code}</span>
            </div>
          </div>
        </motion.div>
      </LeftPanelShell>
    </>
  )
}
