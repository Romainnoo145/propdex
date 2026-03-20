import { useMemo } from 'react'
import { Scale, Home, Building2 } from 'lucide-react'
import { MiniStatCard } from './MiniStatCard'
import { TopWijkenLanding } from './TopWijkenLanding'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface OverviewTabProps {
  naam: string
  scans: ScanListItem[]
  gemeenteCode: string
  onSelectWijk: (code: string, naam: string) => void
  onSwitchToWijken: () => void
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

/**
 * Overview — the default landing page (not a tab).
 * 3 hero KPI cards + "Jouw top wijken" section.
 */
export function OverviewTab({ naam, scans, gemeenteCode, onSelectWijk, onSwitchToWijken }: OverviewTabProps) {
  const koopwoning = useMemo(() => aggregateKoopwoning(scans, gemeenteCode), [scans, gemeenteCode])
  const stedelijkheid = useMemo(() => getStedelijkheid(scans, gemeenteCode), [scans, gemeenteCode])
  const { data: profile, isLoading: profileLoading } = useGemeenteProfile(naam)

  const severityValue = profileLoading ? '...' : (profile?.severity_label ?? null)
  const severityColor = profile?.severity_label ? SEVERITY_COLORS[profile.severity_label] : undefined

  return (
    <div className="px-8 pt-4 pb-6">
      {/* 3 Hero KPI cards */}
      <div className="grid grid-cols-3 gap-1.5">
        <MiniStatCard
          icon={<Scale size={16} strokeWidth={1.5} />}
          label="Juridisch"
          value={severityValue}
          valueColor={severityColor}
          subtitle="Klimaat"
        />
        <MiniStatCard
          icon={<Home size={16} strokeWidth={1.5} />}
          label="Koopwoning"
          value={koopwoning != null ? `${koopwoning}%` : null}
          subtitle="Koop-potentieel"
        />
        <MiniStatCard
          icon={<Building2 size={16} strokeWidth={1.5} />}
          label="Stedelijk"
          value={stedelijkheid ? stedelijkheid.replace('stedelijk', '').trim() || stedelijkheid : null}
          subtitle="Dichtheid"
        />
      </div>

      {/* Top wijken */}
      <div className="mt-6">
        <TopWijkenLanding
          gemeenteCode={gemeenteCode}
          onSelectWijk={onSelectWijk}
          onSwitchToWijken={onSwitchToWijken}
        />
      </div>
    </div>
  )
}
