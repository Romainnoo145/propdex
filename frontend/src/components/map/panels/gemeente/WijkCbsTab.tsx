import { motion } from 'framer-motion'
import { Home, Calendar, Users, DollarSign, ShieldAlert, MapPin } from 'lucide-react'
import { StatRingCard } from './StatRingCard'
import { staggerContainer, fadeUp } from './animations'
import type { CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface WijkCbsTabProps {
  metrics: CbsNeighborhoodMetrics | null | undefined
}

/**
 * CBS detail grid for WijkMapPanel — 2×3 animated StatRingCards from single-wijk data.
 */
export function WijkCbsTab({ metrics }: WijkCbsTabProps) {
  if (!metrics) {
    return (
      <div className="px-8 pt-5 pb-6">
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-[13px] text-slate-400 text-center">
            Geen CBS data — scan deze wijk om statistieken te laden
          </p>
        </div>
      </div>
    )
  }

  const { data, peiljaar, criminaliteit, nabijheid } = metrics
  const koop = data?.demografie?.percentage_koopwoningen
  const bouwjaar = data?.bouwjaar_distributie?.percentage_bouwjaar_voor_2000
  const woz = data?.gemiddelde_woz_waarde

  const eenpersoonsPct = (() => {
    const hh = data?.huishoudens
    if (hh?.totaal && hh.eenpersoons) {
      return Math.round((hh.eenpersoons / hh.totaal) * 100)
    }
    return null
  })()

  const crimPer1000 = criminaliteit?.per_1000_inwoners ?? null
  const supermarktKm = nabijheid?.afstanden?.supermarkt_km ?? null

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
          value={koop != null ? Math.round(koop) : null}
          unit="%"
          color="#22c55e"
          showRing
          subtitle="Koop-potentieel"
        />
        <StatRingCard
          icon={<Calendar size={14} strokeWidth={1.5} />}
          label="Vóór 2000"
          value={bouwjaar != null ? Math.round(bouwjaar) : null}
          unit="%"
          color="#f59e0b"
          showRing
          subtitle="Renovatie-kans"
        />
        <StatRingCard
          icon={<Users size={14} strokeWidth={1.5} />}
          label="Eenpersoons"
          value={eenpersoonsPct}
          unit="%"
          color="#8b5cf6"
          showRing
          subtitle="Klein wonen"
        />
        <StatRingCard
          icon={<DollarSign size={14} strokeWidth={1.5} />}
          label="Gem. WOZ"
          value={woz != null ? Math.round(woz) : null}
          displayValue={woz != null ? `€${Math.round(woz).toLocaleString('nl-NL')}` : undefined}
          color="#0ea5e9"
          subtitle="Waardeontwikkeling"
        />
        <StatRingCard
          icon={<ShieldAlert size={14} strokeWidth={1.5} />}
          label="Criminaliteit"
          value={crimPer1000 != null ? Math.round(crimPer1000) : null}
          displayValue={crimPer1000 != null ? `${Math.round(crimPer1000 * 10) / 10}/1k` : undefined}
          color="#ef4444"
          subtitle="Veiligheid"
        />
        <StatRingCard
          icon={<MapPin size={14} strokeWidth={1.5} />}
          label="Supermarkt"
          value={supermarktKm != null ? Math.round(supermarktKm * 10) : null}
          displayValue={supermarktKm != null ? `${Math.round(supermarktKm * 10) / 10} km` : undefined}
          color="#06b6d4"
          subtitle="Voorzieningen"
        />
      </div>

      <motion.div variants={fadeUp} className="mt-4">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          CBS data{peiljaar ? ` · peiljaar ${peiljaar}` : ''}
        </span>
      </motion.div>
    </motion.div>
  )
}
