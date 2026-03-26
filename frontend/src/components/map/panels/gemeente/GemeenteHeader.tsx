import { useMemo } from 'react'
import { AMBER, SLATE_MUTED } from '@/lib/tokens'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface GemeenteHeaderProps {
  naam: string
  code: string
  scans: ScanListItem[]
  gemeenteCode: string
}

/* ── Stedelijkheid badge color mapping ──────────────────────── */

const STEDELIJKHEID_COLORS: Record<string, string> = {
  'Zeer sterk stedelijk': AMBER.base,
  'Sterk stedelijk': AMBER.dark,
  'Matig stedelijk': AMBER.deep,
  'Weinig stedelijk': AMBER.base,
  'Niet stedelijk': SLATE_MUTED,
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
  let best = ''
  let bestCount = 0
  for (const [label, c] of counts) {
    if (c > bestCount) { best = label; bestCount = c }
  }
  return best
}

/**
 * Gemeente identity header — just name, code badge, stedelijkheid badge.
 * Small and persistent. KPIs live in the overview content, not here.
 */
export function GemeenteHeader({ naam, code, scans, gemeenteCode }: GemeenteHeaderProps) {
  const stedelijkheid = useMemo(() => getStedelijkheid(scans, gemeenteCode), [scans, gemeenteCode])
  const stedelijkheidColor = stedelijkheid ? (STEDELIJKHEID_COLORS[stedelijkheid] ?? SLATE_MUTED) : SLATE_MUTED

  return (
    <div className="px-8 pt-8">
      <div className="min-w-0 max-w-full pr-16">
        <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight truncate">
          {naam}
        </h2>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            Gemeente
          </span>
          <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums">
            {code}
          </span>
          {stedelijkheid && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{
                backgroundColor: `${stedelijkheidColor}15`,
                color: stedelijkheidColor,
              }}
            >
              {stedelijkheid}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
