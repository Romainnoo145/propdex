/**
 * GemeentePicker — M049/S03
 *
 * Horizontal pill-tab strip for switching active gemeente. Each pill shows:
 *   - gemeente_naam
 *   - tiny status-dot (groen all-live / amber any-missing / rood any-broken)
 *
 * Source: GemeenteSummary[] from useGemeentenSummary, sorted last_activity_at DESC.
 * Tokens locked in 03-CONTEXT.md §4. Motion layoutId="gemeente-picker" is SEPARATE
 * from SettingsTabNav's "settings-tab" — different animation scope.
 */
import { motion } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import type { GemeenteSummary } from '@/lib/types/data-sources-admin'

interface Props {
  gemeenten: GemeenteSummary[]
  activeGemeenteCode: string
}

function dotColor(summary: GemeenteSummary): string {
  if ((summary.status_counts.broken ?? 0) > 0) return 'bg-red-500'
  if ((summary.status_counts.missing ?? 0) > 0) return 'bg-[#F9A826]'
  return 'bg-[#22C55E]'
}

export function GemeentePicker({ gemeenten, activeGemeenteCode }: Props) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-full bg-[#F2F6F3] p-1 w-fit max-w-full"
      aria-label="Gemeente-keuze"
      data-component="gemeente-picker"
    >
      {gemeenten.map((g) => {
        const isActive = g.gemeente_code === activeGemeenteCode
        return (
          <Link
            key={g.gemeente_code}
            to="/instellingen/data-bronnen/$gemeenteCode"
            params={{ gemeenteCode: g.gemeente_code }}
            className="relative shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold transition-colors"
            data-gemeente-code={g.gemeente_code}
            data-active={isActive ? 'true' : 'false'}
          >
            {isActive && (
              <motion.div
                layoutId="gemeente-picker"
                className="absolute inset-0 rounded-full bg-[#0E1111]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 inline-flex items-center gap-1.5 ${
                isActive ? 'text-white' : 'text-slate-600'
              }`}
            >
              <span className={`size-1.5 rounded-full ${dotColor(g)}`} aria-hidden />
              {g.gemeente_naam}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
