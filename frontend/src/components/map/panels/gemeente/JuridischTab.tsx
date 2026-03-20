import { motion } from 'framer-motion'
import { Scale, FileText, ChevronRight } from 'lucide-react'
import { StatRingCard } from './StatRingCard'
import { staggerContainer, fadeUp } from './animations'
import { JurisprudenceSection } from '@/components/projects/JurisprudenceSection'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'

interface JuridischTabProps {
  gemeenteNaam: string
  gemeenteCode: string
  onOpenModal: () => void
}

/* ── Severity → score ──────────────────────────────────────── */

const SEVERITY_SCORE: Record<string, number> = {
  'Soepel': 85,
  'Neutraal': 55,
  'Streng': 25,
  'Zeer streng': 10,
}

/**
 * Juridisch tab — animated hero cards + JurisprudenceSection.
 * 3 cards: severity ring, approval rate ring, bekendmakingen count.
 */
export function JuridischTab({ gemeenteNaam, gemeenteCode, onOpenModal }: JuridischTabProps) {
  const { data: profile, isLoading } = useGemeenteProfile(gemeenteNaam)

  const severityLabel = !isLoading ? (profile?.severity_label ?? null) : null
  const severityColor = severityLabel ? (SEVERITY_COLORS[severityLabel] ?? '#94a3b8') : '#94a3b8'
  const severityScore = severityLabel ? (SEVERITY_SCORE[severityLabel] ?? 50) : null

  const approvalRate = profile?.approval_rate_pct ?? null
  const approvalColor = approvalRate != null
    ? approvalRate >= 80 ? '#22c55e' : approvalRate >= 50 ? '#f59e0b' : '#ef4444'
    : '#94a3b8'

  const bekendmakingen = profile?.bekendmakingen_90d ?? null
  const doorlooptijd = profile?.avg_doorlooptijd_days ?? null

  return (
    <motion.div
      className="px-8 pt-5 pb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Hero cards */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatRingCard
          icon={<Scale size={14} strokeWidth={1.5} />}
          label="Klimaat"
          value={severityScore}
          displayValue={isLoading ? '...' : (severityLabel ?? '—')}
          color={severityColor}
          showRing
          subtitle="Vergunning-klimaat"
          onClick={onOpenModal}
        />
        <StatRingCard
          icon={<FileText size={14} strokeWidth={1.5} />}
          label="Verleend"
          value={approvalRate}
          unit="%"
          color={approvalColor}
          showRing
          subtitle="Goedkeuringsgraad"
          onClick={onOpenModal}
        />
        <StatRingCard
          icon={<FileText size={14} strokeWidth={1.5} />}
          label="Bekendm."
          value={bekendmakingen}
          displayValue={bekendmakingen != null ? String(bekendmakingen) : (isLoading ? '...' : '—')}
          color="#6366f1"
          subtitle={doorlooptijd != null ? `~${doorlooptijd}d doorlooptijd` : '90 dagen'}
          onClick={onOpenModal}
        />
      </div>

      {/* JurisprudenceSection — constrained height */}
      <motion.div variants={fadeUp} className="mt-4 max-h-[320px] overflow-y-auto rounded-[16px]">
        <JurisprudenceSection gemeenteNaam={gemeenteNaam} wijkNaam={null} />
      </motion.div>

      {/* Meer details → modal */}
      <motion.div variants={fadeUp} className="flex justify-end mt-3">
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
