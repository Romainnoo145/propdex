import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LeftPanelShell } from './LeftPanelShell'
import { GemeenteHeader } from './gemeente/GemeenteHeader'
import { GemeenteTabBar, type GemeenteTab } from './gemeente/GemeenteTabBar'
import { OverviewTab } from './gemeente/OverviewTab'
import { DemografieTab } from './gemeente/DemografieTab'
import { JuridischTab } from './gemeente/JuridischTab'
import { BestuurlijkTab } from './gemeente/BestuurlijkTab'
import { WijkenTab } from './gemeente/WijkenTab'
import { DemografieModal } from './gemeente/DemografieModal'
import { WijkenModal } from './gemeente/WijkenModal'
import { JuridischKlimaatModal } from './gemeente/JuridischKlimaatModal'
import { MeldingenModal } from './gemeente/MeldingenModal'
import type { ScanListItem } from '@/lib/types/scan'

export type GemeenteCardCategory = 'demografie' | 'juridisch' | 'meldingen' | 'wijken'

interface GemeenteContextPanelProps {
  naam: string
  code: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  scans: ScanListItem[]
  onClose: () => void
  onSelectWijk: (wijkCode: string, wijkNaam: string) => void
}

export function GemeenteContextPanel({
  naam,
  code,
  wijkGeojson,
  scans,
  onClose,
  onSelectWijk,
}: GemeenteContextPanelProps) {
  const [activeTab, setActiveTab] = useState<GemeenteTab | null>(null)
  const [openModal, setOpenModal] = useState<GemeenteCardCategory | null>(null)

  const handleSelectTab = useCallback((tab: GemeenteTab | null) => {
    setActiveTab(tab)
  }, [])

  return (
    <>
      <LeftPanelShell onClose={onClose}>
        <div className="flex flex-col">
          {/* ── Header (name + badges only — compact, persistent) ── */}
          <GemeenteHeader
            naam={naam}
            code={code}
            scans={scans}
            gemeenteCode={code}
          />

          {/* ── Tabs (right below header) ──────────────── */}
          <div className="px-8 mt-4">
            <GemeenteTabBar activeTab={activeTab} onSelect={handleSelectTab} />
          </div>

          {/* ── Content (scrollable, full page per tab) ── */}
          <AnimatePresence mode="wait">
            {activeTab === null && (
              <motion.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <OverviewTab
                  naam={naam}
                  code={code}
                  scans={scans}
                  gemeenteCode={code}
                  onSelectWijk={onSelectWijk}
                  onSwitchToWijken={() => setActiveTab('wijken')}
                />
              </motion.div>
            )}

            {activeTab === 'demografie' && (
              <motion.div
                key="demografie"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <DemografieTab
                  scans={scans}
                  gemeenteCode={code}
                  onOpenModal={() => setOpenModal('demografie')}
                />
              </motion.div>
            )}

            {activeTab === 'juridisch' && (
              <motion.div
                key="juridisch"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <JuridischTab
                  gemeenteNaam={naam}
                  gemeenteCode={code}
                  onOpenModal={() => setOpenModal('juridisch')}
                />
              </motion.div>
            )}

            {activeTab === 'bestuurlijk' && (
              <motion.div
                key="bestuurlijk"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <BestuurlijkTab gemeenteNaam={naam} />
              </motion.div>
            )}

            {activeTab === 'wijken' && (
              <motion.div
                key="wijken"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <WijkenTab
                  wijkGeojson={wijkGeojson}
                  scans={scans}
                  gemeenteCode={code}
                  onSelectWijk={onSelectWijk}
                  onOpenModal={() => setOpenModal('wijken')}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Trust metadata ──────────────────────────── */}
          <div className="px-8 pb-6 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-slate-300">Bron: CBS · PDOK</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-300">{code}</span>
            </div>
          </div>
        </div>
      </LeftPanelShell>

      {/* Modals */}
      <AnimatePresence>
        {openModal === 'demografie' && (
          <DemografieModal gemeenteNaam={naam} gemeenteCode={code} scans={scans} onClose={() => setOpenModal(null)} />
        )}
        {openModal === 'wijken' && (
          <WijkenModal gemeenteNaam={naam} gemeenteCode={code} wijkGeojson={wijkGeojson} scans={scans} onClose={() => setOpenModal(null)}
            onSelectWijk={(c, n) => { setOpenModal(null); onSelectWijk(c, n) }}
          />
        )}
        {openModal === 'juridisch' && (
          <JuridischKlimaatModal gemeenteNaam={naam} gemeenteCode={code} onClose={() => setOpenModal(null)} />
        )}
        {openModal === 'meldingen' && (
          <MeldingenModal gemeenteNaam={naam} gemeenteCode={code} onClose={() => setOpenModal(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
