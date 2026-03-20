import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Scan, Eye, Home, BarChart3, DollarSign } from 'lucide-react'
import { LeftPanelShell } from './LeftPanelShell'
import { StatRingCard } from './gemeente/StatRingCard'
import { staggerContainer, fadeUp } from './gemeente/animations'
import { WijkCbsTab } from './gemeente/WijkCbsTab'
import { JurisprudenceSection } from '@/components/projects/JurisprudenceSection'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface WijkMapPanelProps {
  naam: string
  gemeenteNaam: string
  latestScan: ScanListItem | null
  onClose: () => void
  onBack: () => void
  onStartScan: () => void
  onViewResults: (scanId: string) => void
}

type WijkTab = 'overzicht' | 'juridisch'

const TABS: { key: WijkTab; label: string }[] = [
  { key: 'overzicht', label: 'Overzicht' },
  { key: 'juridisch', label: 'Juridisch' },
]

export function WijkMapPanel({
  naam,
  gemeenteNaam,
  latestScan,
  onClose,
  onBack,
  onStartScan,
  onViewResults,
}: WijkMapPanelProps) {
  const [activeTab, setActiveTab] = useState<WijkTab>('overzicht')
  const hasCompletedScan = latestScan?.status === 'completed'
  const metrics = (hasCompletedScan ? latestScan.neighborhood_metrics : null) as CbsNeighborhoodMetrics | null

  const handleTabSelect = useCallback((tab: WijkTab) => {
    setActiveTab(tab)
  }, [])

  // Derive hero KPI values
  const percelen = hasCompletedScan ? latestScan.parcel_count : null
  const koop = metrics?.data?.demografie?.percentage_koopwoningen ?? null
  const woz = metrics?.data?.gemiddelde_woz_waarde ?? null

  /* Footer CTA */
  const footer = hasCompletedScan ? (
    <button
      type="button"
      onClick={() => onViewResults(latestScan.scan_id)}
      className="w-full h-[60px] rounded-full bg-[#0E1111] text-white text-[15px] font-bold tracking-tight transition-all hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Eye size={16} strokeWidth={2} />
      Bekijk resultaten
    </button>
  ) : (
    <button
      type="button"
      onClick={onStartScan}
      className="w-full h-[60px] rounded-full bg-[#F9A826] text-white text-[15px] font-bold tracking-tight transition-all hover:bg-[#e09520] active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Scan size={16} strokeWidth={2} />
      Start scan
    </button>
  )

  return (
    <LeftPanelShell onClose={onClose} footer={footer}>
      <div className="flex flex-col">
        {/* ── Header (compact — name + badge) ──────────── */}
        <div className="px-8 pt-8">
          {/* Back breadcrumb */}
          <button
            onClick={onBack}
            className="group flex items-center gap-1.5 mb-2 transition-colors duration-200"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-white/60 backdrop-blur-sm group-hover:bg-white/80 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4 text-aura-ink" />
            </div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
              {gemeenteNaam}
            </span>
          </button>

          <div className="min-w-0 max-w-full pr-16">
            <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight truncate">
              {naam}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
                Wijk
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{
                  backgroundColor: hasCompletedScan ? '#22c55e15' : '#94a3b815',
                  color: hasCompletedScan ? '#22c55e' : '#94a3b8',
                }}
              >
                {hasCompletedScan ? 'Gescand' : 'Niet gescand'}
              </span>
            </div>
          </div>

          {/* Tabs — right after header */}
          <div className="flex w-full h-[44px] rounded-full p-1 bg-[#F2F6F3] mt-4">
            {TABS.map(({ key, label }) => {
              const isActive = activeTab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTabSelect(key)}
                  className="relative flex-1 h-full rounded-full flex items-center justify-center transition-colors"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 600,
                    letterSpacing: isActive ? '-0.01em' : '0',
                    color: isActive ? undefined : '#94a3b8',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="wijk-tab"
                      className="absolute inset-0 rounded-full"
                      style={{ background: '#0E1111' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Tab Content ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'overzicht' && (
            <motion.div
              key="overzicht"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* 3 Hero KPIs — animated StatRingCards */}
              <motion.div
                className="grid grid-cols-3 gap-1.5 px-8 pt-4"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                <StatRingCard
                  icon={<Home size={16} strokeWidth={1.5} />}
                  label="Percelen"
                  value={percelen}
                  displayValue={percelen != null ? percelen.toLocaleString('nl-NL') : undefined}
                  color="#F9A826"
                />
                <StatRingCard
                  icon={<BarChart3 size={16} strokeWidth={1.5} />}
                  label="Koopwoning"
                  value={koop != null ? Math.round(koop) : null}
                  unit="%"
                  color="#22c55e"
                  showRing
                  subtitle="Koop-potentieel"
                />
                <StatRingCard
                  icon={<DollarSign size={16} strokeWidth={1.5} />}
                  label="Gem. WOZ"
                  value={woz != null ? Math.round(woz) : null}
                  displayValue={woz != null ? `€${Math.round(woz).toLocaleString('nl-NL')}` : undefined}
                  color="#0ea5e9"
                />
              </motion.div>

              {/* CBS detail grid */}
              <WijkCbsTab metrics={metrics} />
            </motion.div>
          )}

          {activeTab === 'juridisch' && (
            <motion.div
              key="juridisch"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-8 pt-5 pb-6"
            >
              <div className="max-h-[400px] overflow-y-auto rounded-[16px]">
                <JurisprudenceSection gemeenteNaam={gemeenteNaam} wijkNaam={naam} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Trust metadata ───────────────────────────── */}
        <div className="px-8 pb-6 mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-slate-300">
              Bron: CBS · Kadaster · PDOK
            </span>
          </div>
        </div>
      </div>
    </LeftPanelShell>
  )
}
