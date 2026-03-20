import { motion } from 'framer-motion'
import { Scale, CheckCircle2, Clock } from 'lucide-react'
import { StatRingCard } from './StatRingCard'
import { TopWijkenLanding } from './TopWijkenLanding'
import { staggerContainer, fadeUp } from './animations'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'

interface GemeenteOverviewProps {
  naam: string
  code: string
  gemeenteCode: string
  onSelectWijk: (code: string, naam: string) => void
  onSwitchToKlimaat: () => void
  onSwitchToActiviteit: () => void
}

/* ── Severity → numeric score for ring ─────────────────────── */

const SEVERITY_SCORE: Record<string, number> = {
  'Gunstig': 85,
  'Gemiddeld': 55,
  'Ongunstig': 25,
  'Zeer ongunstig': 10,
}

/**
 * Gemeente overview — the default landing (before any tab is selected).
 * Focused on the institution: klimaat, goedkeuring, doorlooptijd.
 * Zero demografie — that's wijk-level data.
 * Zero scan stats — that's admin language, not user-facing.
 */
export function GemeenteOverview({
  naam,
  gemeenteCode,
  onSelectWijk,
  onSwitchToKlimaat,
  onSwitchToActiviteit,
}: GemeenteOverviewProps) {
  const { data: profile, isLoading } = useGemeenteProfile(naam)

  const severityLabel = !isLoading ? (profile?.severity_label ?? null) : null
  const severityColor = severityLabel ? (SEVERITY_COLORS[severityLabel] ?? '#94a3b8') : '#94a3b8'
  const severityScore = severityLabel ? (SEVERITY_SCORE[severityLabel] ?? 50) : null

  const approvalRate = profile?.approval_rate_pct ?? null
  const approvalColor = approvalRate != null
    ? approvalRate >= 80 ? '#22c55e' : approvalRate >= 50 ? '#f59e0b' : '#ef4444'
    : '#94a3b8'

  const doorlooptijd = profile?.avg_doorlooptijd_days ?? null
  const doorlooptijdColor = doorlooptijd != null
    ? doorlooptijd <= 30 ? '#22c55e' : doorlooptijd <= 90 ? '#f59e0b' : '#ef4444'
    : '#94a3b8'

  return (
    <motion.div
      className="px-8 pt-4 pb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── 3 Hero cards — the institution at a glance ── */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatRingCard
          icon={<Scale size={16} strokeWidth={1.5} />}
          label="Klimaat"
          value={severityScore}
          displayValue={severityLabel ?? (isLoading ? '...' : '—')}
          color={severityColor}
          showRing
          subtitle="Vergunning-klimaat"
          onClick={onSwitchToKlimaat}
        />
        <StatRingCard
          icon={<CheckCircle2 size={16} strokeWidth={1.5} />}
          label="Verleend"
          value={approvalRate != null ? Math.round(approvalRate) : null}
          unit="%"
          color={approvalColor}
          showRing
          subtitle="Goedkeuringsgraad"
          onClick={onSwitchToKlimaat}
        />
        <StatRingCard
          icon={<Clock size={16} strokeWidth={1.5} />}
          label="Doorlooptijd"
          value={doorlooptijd}
          displayValue={doorlooptijd != null ? `~${doorlooptijd}d` : (isLoading ? '...' : '—')}
          color={doorlooptijdColor}
          subtitle="Gem. afhandeling"
          onClick={onSwitchToKlimaat}
        />
      </div>

      {/* ── Quick stats row ────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-1.5 mt-4">
        <button
          type="button"
          onClick={onSwitchToKlimaat}
          className="flex items-center justify-center gap-1.5 h-[40px] rounded-[14px] bg-[#F2F6F3] cursor-pointer transition-colors hover:bg-[#E8EDEB]"
        >
          <span className="text-[13px] font-semibold text-[#0E1111]">
            {profile?.bekendmakingen_90d ?? '—'} bekendmakingen (90d)
          </span>
        </button>
        <button
          type="button"
          onClick={onSwitchToKlimaat}
          className="flex items-center justify-center gap-1.5 h-[40px] rounded-[14px] bg-[#F2F6F3] cursor-pointer transition-colors hover:bg-[#E8EDEB]"
        >
          <span className="text-[13px] font-semibold text-[#0E1111]">
            {profile?.bekendmakingen_365d ?? '—'} per jaar
          </span>
        </button>
      </motion.div>

      {/* ── Top wijken ─────────────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-6">
        <TopWijkenLanding
          gemeenteCode={gemeenteCode}
          onSelectWijk={onSelectWijk}
          onSwitchToWijken={onSwitchToActiviteit}
        />
      </motion.div>
    </motion.div>
  )
}
