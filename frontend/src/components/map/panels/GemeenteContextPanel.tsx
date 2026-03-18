import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { Users, Scale, Bell, MapPin, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { LeftPanelShell } from './LeftPanelShell'
import { DemografieModal } from './gemeente/DemografieModal'
import { WijkenModal } from './gemeente/WijkenModal'
import { JuridischKlimaatModal } from './gemeente/JuridischKlimaatModal'
import { MeldingenModal } from './gemeente/MeldingenModal'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

export type GemeenteCardCategory = 'demografie' | 'juridisch' | 'meldingen' | 'wijken'

interface GemeenteContextPanelProps {
  naam: string
  code: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  scans: ScanListItem[]
  onClose: () => void
  onSelectWijk: (wijkCode: string, wijkNaam: string) => void
}

/* ── Tabs (same pattern as CategoryTabs in parcel panel) ───── */

type GemeenteTab = 'overzicht' | 'demografie' | 'wijken'

const TABS: { key: GemeenteTab; label: string }[] = [
  { key: 'overzicht', label: 'Overzicht' },
  { key: 'demografie', label: 'Demografie' },
  { key: 'wijken', label: 'Wijken' },
]

/* ── Animation ─────────────────────────────────────────────── */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

/* ── Aggregate CBS data ────────────────────────────────────── */

function aggregateInwoners(scans: ScanListItem[], gemeenteCode: string): number | null {
  let total = 0
  for (const s of scans) {
    if (s.gemeente_code !== gemeenteCode || s.status !== 'completed' || !s.neighborhood_metrics) continue
    const m = s.neighborhood_metrics as CbsNeighborhoodMetrics
    const n = m.data?.demografie?.aantal_inwoners
    if (typeof n === 'number') total += n
  }
  return total > 0 ? total : null
}

function aggregateWoz(scans: ScanListItem[], gemeenteCode: string): number | null {
  let sum = 0
  let count = 0
  for (const s of scans) {
    if (s.gemeente_code !== gemeenteCode || s.status !== 'completed' || !s.neighborhood_metrics) continue
    const m = s.neighborhood_metrics as CbsNeighborhoodMetrics
    const v = m.data?.gemiddelde_woz_waarde
    if (typeof v === 'number') { sum += v; count++ }
  }
  return count > 0 ? Math.round(sum / count) : null
}

/* ── Component ─────────────────────────────────────────────── */

export function GemeenteContextPanel({
  naam,
  code,
  wijkGeojson,
  scans,
  onClose,
  onSelectWijk,
}: GemeenteContextPanelProps) {
  const [activeTab, setActiveTab] = useState<GemeenteTab>('overzicht')
  const [openModal, setOpenModal] = useState<GemeenteCardCategory | null>(null)

  const features = wijkGeojson?.features ?? []
  const wijkCount = features.length

  const inwoners = useMemo(() => aggregateInwoners(scans, code), [scans, code])
  const woz = useMemo(() => aggregateWoz(scans, code), [scans, code])
  const completedScans = useMemo(() => scans.filter(s => s.gemeente_code === code && s.status === 'completed').length, [scans, code])

  const handleSelectTab = useCallback((tab: GemeenteTab) => {
    if (tab === 'demografie') {
      setOpenModal('demografie')
    } else {
      setActiveTab(tab)
    }
  }, [])

  return (
    <>
      <LeftPanelShell onClose={onClose}>
        <motion.div
          className="flex flex-col"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {/* ── Header (matches ParcelDetailPanel) ─────── */}
          <motion.div variants={fadeUp} className="px-8 pt-8">
            <div className="min-w-0 max-w-full pr-16">
              <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight truncate">
                {naam}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
                  Gemeente
                </span>
                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums">
                  {code}
                </span>
              </div>
            </div>

            {/* ── Pill Tabs (same as CategoryTabs) ──────── */}
            <div className="flex w-full h-[48px] rounded-full p-1 bg-[#F2F6F3] mt-6">
              {TABS.map(({ key, label }) => {
                const isActive = activeTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectTab(key)}
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
                        layoutId="gemeente-tab"
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
          </motion.div>

          {/* ── Tab Content ─────────────────────────────── */}
          <AnimatePresence mode="wait">
            {activeTab === 'overzicht' && (
              <motion.div
                key="overzicht"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* 2×2 KPI Grid (styled like potentie/risico cards) */}
                <div className="grid grid-cols-2 gap-1.5 mt-6 px-8">
                  <KpiCard
                    icon={<Users size={16} strokeWidth={1.5} />}
                    color="#F9A826"
                    value={inwoners != null ? inwoners.toLocaleString('nl-NL') : '—'}
                    label="Inwoners"
                    onClick={() => setOpenModal('demografie')}
                  />
                  <KpiCard
                    icon={<Scale size={16} strokeWidth={1.5} />}
                    color="#22C55E"
                    value={woz != null ? `€${woz.toLocaleString('nl-NL')}` : '—'}
                    label="Gem. WOZ"
                    onClick={() => setOpenModal('juridisch')}
                  />
                  <KpiCard
                    icon={<Bell size={16} strokeWidth={1.5} />}
                    color="#3b82f6"
                    value={completedScans > 0 ? String(completedScans) : '—'}
                    label="Scans"
                    onClick={() => setOpenModal('meldingen')}
                  />
                  <KpiCard
                    icon={<MapPin size={16} strokeWidth={1.5} />}
                    color="#8b5cf6"
                    value={wijkCount > 0 ? String(wijkCount) : '—'}
                    label="Wijken"
                    onClick={() => setOpenModal('wijken')}
                  />
                </div>

                {/* Quick wijk preview — first 6 wijken */}
                <div className="px-8 mt-6 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase"
                    style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    Wijken
                  </span>
                </div>
                <div className="px-8 pb-6">
                  <WijkList features={features.slice(0, 6)} onSelectWijk={onSelectWijk} />
                  {features.length > 6 && (
                    <button
                      onClick={() => setActiveTab('wijken')}
                      className="w-full mt-2 h-[40px] rounded-[14px] bg-[#F2F6F3] text-[13px] font-semibold text-[#0E1111] hover:bg-[#E8EDEB] transition-colors flex items-center justify-center gap-1"
                    >
                      Alle {features.length} wijken bekijken
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  )}
                </div>

                {/* Trust metadata */}
                <div className="px-8 pb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider text-slate-300">Bron: CBS · PDOK</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-300">{code}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'wijken' && (
              <motion.div
                key="wijken"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="px-8 pt-6 pb-6"
              >
                <WijkList features={features} onSelectWijk={onSelectWijk} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
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

/* ── KPI Card (matches ScoreCircleCard / KenmerkenCard style) ── */

function KpiCard({
  icon,
  color,
  value,
  label,
  onClick,
}: {
  icon: React.ReactNode
  color: string
  value: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col justify-between rounded-[24px] bg-white border border-[#EAEFEF] p-5 text-left transition-all duration-200 hover:shadow-sm cursor-pointer"
    >
      {/* Top: icon + label + chevrons */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span
            className="text-[11px] font-extrabold uppercase"
            style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
          >
            {label}
          </span>
        </div>
        <div className="flex flex-col -space-y-1 text-slate-200">
          <ChevronUp size={14} strokeWidth={2} />
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      {/* Value */}
      <div className="mt-3">
        <span
          className="text-[32px] font-black tracking-tighter tabular-nums leading-none"
          style={{ color: value !== '—' ? '#0E1111' : '#cbd5e1' }}
        >
          {value}
        </span>
      </div>
    </button>
  )
}

/* ── Wijk List (clean rows, no boxes) ──────────────────────── */

function WijkList({
  features,
  onSelectWijk,
}: {
  features: GeoJSON.Feature[]
  onSelectWijk: (code: string, naam: string) => void
}) {
  if (features.length === 0) {
    return <p className="text-[13px] text-slate-400 py-4 text-center">Wijken laden...</p>
  }

  return (
    <div>
      {features.map((feature) => {
        const featureCode = (feature.properties?.statcode as string) ?? ''
        const name = (feature.properties?.statnaam as string) ?? featureCode
        return (
          <button
            key={featureCode}
            onClick={() => onSelectWijk(featureCode, name)}
            className="group w-full flex items-center justify-between py-3 border-b border-slate-100/80 last:border-0 text-left transition-colors duration-150 hover:bg-slate-50/50"
          >
            <span className="text-[13px] font-medium text-slate-700 truncate">
              {name}
            </span>
            <ChevronRight size={14} className="text-slate-200 group-hover:text-[#F9A826] shrink-0 transition-colors duration-150" />
          </button>
        )
      })}
    </div>
  )
}
