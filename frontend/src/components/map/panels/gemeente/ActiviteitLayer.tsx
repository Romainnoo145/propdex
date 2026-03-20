import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Bell } from 'lucide-react'
import { VerdictHero } from './VerdictHero'
import { CompactWijkCard } from './CompactWijkCard'
import { staggerContainer, fadeUp } from './animations'
import type { ScanListItem } from '@/lib/types/scan'

interface ActiviteitLayerProps {
  scans: ScanListItem[]
  gemeenteCode: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  onSelectWijk: (code: string, naam: string) => void
}

/* ── Wijk activity data ────────────────────────────────────── */

interface WijkActivity {
  name: string
  code: string
  parcelCount: number
  scanDate: string
}

function deriveWijkActivity(scans: ScanListItem[], gemeenteCode: string): WijkActivity[] {
  const map = new Map<string, WijkActivity>()
  for (const s of scans) {
    if (s.gemeente_code !== gemeenteCode || s.status !== 'completed' || !s.wijk_naam) continue
    const existing = map.get(s.wijk_naam)
    if (!existing || s.scan_date > existing.scanDate) {
      map.set(s.wijk_naam, {
        name: s.wijk_naam,
        code: '',
        parcelCount: s.parcel_count,
        scanDate: s.scan_date,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.parcelCount - a.parcelCount)
}

/* ── All wijken from GeoJSON ───────────────────────────────── */

interface WijkEntry {
  name: string
  code: string
  hasData: boolean
  parcelCount?: number
}

function deriveAllWijken(
  wijkGeojson: GeoJSON.FeatureCollection | null,
  scannedWijken: WijkActivity[],
): WijkEntry[] {
  const scannedNames = new Set(scannedWijken.map(w => w.name))
  const scannedMap = new Map(scannedWijken.map(w => [w.name, w]))
  const entries: WijkEntry[] = []

  const features = wijkGeojson?.features ?? []
  for (const f of features) {
    const name = (f.properties?.statnaam as string) ?? ''
    const code = (f.properties?.statcode as string) ?? ''
    const scanned = scannedMap.get(name)
    entries.push({
      name,
      code,
      hasData: scannedNames.has(name),
      parcelCount: scanned?.parcelCount,
    })
  }

  // Sort: wijken with data first, then alphabetical
  return entries.sort((a, b) => {
    if (a.hasData && !b.hasData) return -1
    if (!a.hasData && b.hasData) return 1
    return a.name.localeCompare(b.name, 'nl')
  })
}

/**
 * Activiteit layer — the user's activity in this gemeente.
 * Shows wijken (with data indicators) and summary stats.
 * No admin language — "wijken met data" not "wijken gescand".
 */
export function ActiviteitLayer({
  scans,
  gemeenteCode,
  wijkGeojson,
  onSelectWijk,
}: ActiviteitLayerProps) {
  const scannedWijken = useMemo(() => deriveWijkActivity(scans, gemeenteCode), [scans, gemeenteCode])
  const allWijken = useMemo(() => deriveAllWijken(wijkGeojson, scannedWijken), [wijkGeojson, scannedWijken])

  const totalWijken = allWijken.length
  const wijkenMetData = scannedWijken.length
  const totalPercelen = scannedWijken.reduce((sum, w) => sum + w.parcelCount, 0)

  // Verdict: activity level in this gemeente
  const activityScore = totalWijken > 0
    ? Math.round((wijkenMetData / totalWijken) * 100)
    : null

  const verdictLabel = activityScore == null
    ? 'GEEN WIJKEN'
    : activityScore >= 60 ? 'ACTIEF'
    : activityScore >= 20 ? 'GESTART'
    : wijkenMetData > 0 ? 'VERKENNEND'
    : 'NIEUW GEBIED'

  const verdictColor = activityScore == null
    ? '#94a3b8'
    : activityScore >= 60 ? '#22c55e'
    : activityScore >= 20 ? '#f59e0b'
    : wijkenMetData > 0 ? '#0ea5e9'
    : '#94a3b8'

  const verdictSubtitle = wijkenMetData > 0
    ? `${wijkenMetData} van ${totalWijken} wijken · ${totalPercelen.toLocaleString('nl-NL')} percelen`
    : `${totalWijken} wijken beschikbaar`

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      <VerdictHero
        score={activityScore}
        label={verdictLabel}
        subtitle={verdictSubtitle}
        color={verdictColor}
        icon={activityScore != null && activityScore > 0
          ? <MapPin className="size-6 text-white" strokeWidth={2.5} />
          : <Bell className="size-6 text-white" strokeWidth={2.5} />
        }
      />

      {/* ── Wijken grid ────────────────────────────────── */}
      <motion.div
        className="mt-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* Section label */}
        <motion.div variants={fadeUp} className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-black text-slate-400 uppercase"
            style={{ letterSpacing: '0.2em' }}
          >
            Wijken in deze gemeente
          </span>
          <span className="text-[10px] text-slate-300 tabular-nums">
            {totalWijken} totaal
          </span>
        </motion.div>

        <div className="grid grid-cols-2 gap-1.5">
          {allWijken.slice(0, 12).map((wijk) => (
            <CompactWijkCard
              key={wijk.code || wijk.name}
              name={wijk.name}
              code={wijk.code}
              isScanned={wijk.hasData}
              parcelCount={wijk.parcelCount}
              onSelect={() => onSelectWijk(wijk.code, wijk.name)}
            />
          ))}
        </div>

        {allWijken.length > 12 && (
          <motion.div variants={fadeUp} className="mt-2 text-center">
            <span className="text-[11px] text-slate-400">
              + {allWijken.length - 12} meer wijken
            </span>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
