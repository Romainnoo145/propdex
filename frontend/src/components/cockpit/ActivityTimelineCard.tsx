/**
 * ActivityTimelineCard — "Laatste activiteit" insight card (Tijdlijn).
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split,
 * M050/S06 cont.) to keep OnderzoekPhaseView shell ≤300 LOC.
 */
import { motion } from 'framer-motion'
import { WorkspaceInsightCard, ScrollText } from './AanpakCard'

interface ActivityTimelineCardProps {
  rows: Array<{ label: string; value: string }>
}

export function ActivityTimelineCard({ rows }: ActivityTimelineCardProps) {
  return (
    <WorkspaceInsightCard
      kicker="Tijdlijn"
      title="Laatste activiteit"
      Icon={ScrollText}
      className="mt-4"
      index={3}
    >
      <div className="space-y-2">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="rounded-[16px] border border-white/40 bg-white/40 px-4 py-3"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
              {row.label}
            </p>
            <p className="mt-1 text-[14px] leading-6 text-slate-700">{row.value}</p>
          </motion.div>
        ))}
      </div>
    </WorkspaceInsightCard>
  )
}
