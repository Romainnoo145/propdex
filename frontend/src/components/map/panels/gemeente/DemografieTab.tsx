import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Home, Calendar, Users, DollarSign, ShieldAlert, MapPin, ChevronRight } from 'lucide-react'
import { StatRingCard } from './StatRingCard'
import { staggerContainer, fadeUp } from './animations'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface DemografieTabProps {
  scans: ScanListItem[]
  gemeenteCode: string
  onOpenModal: () => void
}

/* ── CBS aggregation from completed scans ──────────────────── */

interface AggregatedDemo {
  koopwoning: number | null
  bouwjaarVoor2000: number | null
  eenpersoons: number | null
  mediaanInkomen: number | null
  criminaliteitPer1000: number | null
  afstandSupermarkt: number | null
  wijkCount: number
  peiljaar: number | null
}

function aggregateDemografie(scans: ScanListItem[], gemeenteCode: string): AggregatedDemo {
  const metrics: CbsNeighborhoodMetrics[] = []
  for (const s of scans) {
    if (s.gemeente_code === gemeenteCode && s.status === 'completed' && s.neighborhood_metrics) {
      metrics.push(s.neighborhood_metrics as CbsNeighborhoodMetrics)
    }
  }

  if (metrics.length === 0) {
    return {
      koopwoning: null, bouwjaarVoor2000: null, eenpersoons: null,
      mediaanInkomen: null, criminaliteitPer1000: null, afstandSupermarkt: null,
      wijkCount: 0, peiljaar: null,
    }
  }

  const avg = (getter: (m: CbsNeighborhoodMetrics) => number | null | undefined): number | null => {
    let sum = 0, count = 0
    for (const m of metrics) {
      const v = getter(m)
      if (typeof v === 'number') { sum += v; count++ }
    }
    return count > 0 ? sum / count : null
  }

  const round1 = (v: number | null) => v != null ? Math.round(v * 10) / 10 : null
  const roundInt = (v: number | null) => v != null ? Math.round(v) : null

  const eenpersoonsPct = (() => {
    let totalHH = 0, totalEen = 0
    for (const m of metrics) {
      const hh = m.data?.huishoudens
      if (hh?.totaal && hh.eenpersoons) {
        totalHH += hh.totaal
        totalEen += hh.eenpersoons
      }
    }
    return totalHH > 0 ? Math.round((totalEen / totalHH) * 100) : null
  })()

  return {
    koopwoning: roundInt(avg(m => m.data?.demografie?.percentage_koopwoningen)),
    bouwjaarVoor2000: roundInt(avg(m => m.data?.bouwjaar_distributie?.percentage_bouwjaar_voor_2000)),
    eenpersoons: eenpersoonsPct,
    mediaanInkomen: roundInt(avg(m => m.data?.inkomen?.gem_gestandaardiseerd)),
    criminaliteitPer1000: round1(avg(m => m.criminaliteit?.per_1000_inwoners)),
    afstandSupermarkt: round1(avg(m => m.nabijheid?.afstanden?.supermarkt_km)),
    wijkCount: metrics.length,
    peiljaar: metrics[0]?.peiljaar ?? null,
  }
}

/**
 * Demografie tab — 2×3 grid of animated StatRingCards with stagger entrance.
 */
export function DemografieTab({ scans, gemeenteCode, onOpenModal }: DemografieTabProps) {
  const data = useMemo(() => aggregateDemografie(scans, gemeenteCode), [scans, gemeenteCode])

  return (
    <motion.div
      className="px-8 pt-5 pb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <StatRingCard
          icon={<Home size={14} strokeWidth={1.5} />}
          label="Koopwoning"
          value={data.koopwoning}
          unit="%"
          color="#22c55e"
          showRing
          subtitle="Koop-potentieel"
          onClick={onOpenModal}
        />
        <StatRingCard
          icon={<Calendar size={14} strokeWidth={1.5} />}
          label="Vóór 2000"
          value={data.bouwjaarVoor2000}
          unit="%"
          color="#f59e0b"
          showRing
          subtitle="Renovatie-kans"
          onClick={onOpenModal}
        />
        <StatRingCard
          icon={<Users size={14} strokeWidth={1.5} />}
          label="Eenpersoons"
          value={data.eenpersoons}
          unit="%"
          color="#8b5cf6"
          showRing
          subtitle="Klein wonen"
          onClick={onOpenModal}
        />
        <StatRingCard
          icon={<DollarSign size={14} strokeWidth={1.5} />}
          label="Inkomen"
          value={data.mediaanInkomen}
          displayValue={data.mediaanInkomen != null ? `€${data.mediaanInkomen.toLocaleString('nl-NL')}` : undefined}
          color="#0ea5e9"
          subtitle="Koopkracht"
          onClick={onOpenModal}
        />
        <StatRingCard
          icon={<ShieldAlert size={14} strokeWidth={1.5} />}
          label="Criminaliteit"
          value={data.criminaliteitPer1000 != null ? Math.round(data.criminaliteitPer1000) : null}
          displayValue={data.criminaliteitPer1000 != null ? `${data.criminaliteitPer1000}/1k` : undefined}
          color="#ef4444"
          subtitle="Veiligheid"
          onClick={onOpenModal}
        />
        <StatRingCard
          icon={<MapPin size={14} strokeWidth={1.5} />}
          label="Supermarkt"
          value={data.afstandSupermarkt != null ? Math.round(data.afstandSupermarkt * 10) : null}
          displayValue={data.afstandSupermarkt != null ? `${data.afstandSupermarkt} km` : undefined}
          color="#06b6d4"
          subtitle="Voorzieningen"
          onClick={onOpenModal}
        />
      </div>

      <motion.div variants={fadeUp} className="flex items-center justify-between mt-4">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          CBS data · {data.wijkCount} {data.wijkCount === 1 ? 'wijk' : 'wijken'}
          {data.peiljaar ? ` · ${data.peiljaar}` : ''}
        </span>
        <button
          onClick={onOpenModal}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-[#0E1111] hover:text-slate-600 transition-colors"
        >
          Meer details
          <ChevronRight size={12} />
        </button>
      </motion.div>
    </motion.div>
  )
}
