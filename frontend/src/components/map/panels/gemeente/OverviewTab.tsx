import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scale, Home, Building2 } from 'lucide-react'
import { StatRingCard } from './StatRingCard'
import { TopWijkenLanding } from './TopWijkenLanding'
import { DemografieModal } from './DemografieModal'
import { JuridischKlimaatModal } from './JuridischKlimaatModal'
import { staggerContainer, fadeUp } from './animations'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface OverviewTabProps {
  naam: string
  code: string
  scans: ScanListItem[]
  gemeenteCode: string
  onSelectWijk: (code: string, naam: string) => void
  onSwitchToWijken: () => void
}

/* ── Severity to numeric score ─────────────────────────────── */

const SEVERITY_SCORE: Record<string, number> = {
  'Soepel': 85,
  'Neutraal': 55,
  'Streng': 25,
  'Zeer streng': 10,
}

/* ── CBS aggregation ───────────────────────────────────────── */

function aggregateKoopwoning(scans: ScanListItem[], gemeenteCode: string): number | null {
  let sum = 0, count = 0
  for (const s of scans) {
    if (s.gemeente_code !== gemeenteCode || s.status !== 'completed' || !s.neighborhood_metrics) continue
    const m = s.neighborhood_metrics as CbsNeighborhoodMetrics
    const v = m.data?.demografie?.percentage_koopwoningen
    if (typeof v === 'number') { sum += v; count++ }
  }
  return count > 0 ? Math.round(sum / count) : null
}

function getStedelijkheid(scans: ScanListItem[], gemeenteCode: string): string | null {
  const counts = new Map<string, number>()
  for (const s of scans) {
    if (s.gemeente_code !== gemeenteCode || s.status !== 'completed' || !s.neighborhood_metrics) continue
    const m = s.neighborhood_metrics as CbsNeighborhoodMetrics
    const label = m.data?.stedelijkheid?.omschrijving
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  let best = '', bestCount = 0
  for (const [label, c] of counts) {
    if (c > bestCount) { best = label; bestCount = c }
  }
  return best
}

/* ── Stedelijkheid → score + color ─────────────────────────── */

const STEDELIJKHEID_SCORE: Record<string, number> = {
  'Zeer sterk stedelijk': 95,
  'Sterk stedelijk': 75,
  'Matig stedelijk': 55,
  'Weinig stedelijk': 35,
  'Niet stedelijk': 15,
}

const STEDELIJKHEID_COLOR: Record<string, string> = {
  'Zeer sterk stedelijk': '#0ea5e9',
  'Sterk stedelijk': '#3b82f6',
  'Matig stedelijk': '#6366f1',
  'Weinig stedelijk': '#8b5cf6',
  'Niet stedelijk': '#a78bfa',
}

function stedelijkheidShortLabel(s: string): string {
  return s.replace('stedelijk', '').trim() || s
}

/**
 * Overview — the default landing page (not a tab).
 * 3 animated hero StatRingCards + "Jouw top wijken" section.
 */
export function OverviewTab({ naam, code, scans, gemeenteCode, onSelectWijk, onSwitchToWijken }: OverviewTabProps) {
  const koopwoning = useMemo(() => aggregateKoopwoning(scans, gemeenteCode), [scans, gemeenteCode])
  const stedelijkheid = useMemo(() => getStedelijkheid(scans, gemeenteCode), [scans, gemeenteCode])
  const { data: profile, isLoading: profileLoading } = useGemeenteProfile(naam)

  const [openModal, setOpenModal] = useState<'juridisch' | 'demografie' | null>(null)

  const severityLabel = profileLoading ? null : (profile?.severity_label ?? null)
  const severityColor = severityLabel ? (SEVERITY_COLORS[severityLabel] ?? '#94a3b8') : '#94a3b8'
  const severityScore = severityLabel ? (SEVERITY_SCORE[severityLabel] ?? 50) : null

  const stedelijkheidScore = stedelijkheid ? (STEDELIJKHEID_SCORE[stedelijkheid] ?? 50) : null
  const stedelijkheidColor = stedelijkheid ? (STEDELIJKHEID_COLOR[stedelijkheid] ?? '#6366f1') : '#6366f1'

  return (
    <>
      <motion.div
        className="px-8 pt-4 pb-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* 3 Hero StatRingCards */}
        <div className="grid grid-cols-3 gap-1.5">
          <StatRingCard
            icon={<Scale size={16} strokeWidth={1.5} />}
            label="Juridisch"
            value={severityScore}
            displayValue={severityLabel ?? (profileLoading ? '...' : '—')}
            color={severityColor}
            showRing
            subtitle="Klimaat"
            onClick={() => setOpenModal('juridisch')}
          />
          <StatRingCard
            icon={<Home size={16} strokeWidth={1.5} />}
            label="Koopwoning"
            value={koopwoning}
            unit="%"
            color="#22c55e"
            showRing
            subtitle="Koop-potentieel"
            onClick={() => setOpenModal('demografie')}
          />
          <StatRingCard
            icon={<Building2 size={16} strokeWidth={1.5} />}
            label="Stedelijk"
            value={stedelijkheidScore}
            displayValue={stedelijkheid ? stedelijkheidShortLabel(stedelijkheid) : '—'}
            color={stedelijkheidColor}
            showRing
            subtitle="Dichtheid"
          />
        </div>

        {/* Top wijken */}
        <motion.div variants={fadeUp} className="mt-6">
          <TopWijkenLanding
            gemeenteCode={gemeenteCode}
            onSelectWijk={onSelectWijk}
            onSwitchToWijken={onSwitchToWijken}
          />
        </motion.div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {openModal === 'juridisch' && (
          <JuridischKlimaatModal
            gemeenteNaam={naam}
            gemeenteCode={code}
            onClose={() => setOpenModal(null)}
          />
        )}
        {openModal === 'demografie' && (
          <DemografieModal
            gemeenteNaam={naam}
            gemeenteCode={code}
            scans={scans}
            onClose={() => setOpenModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
