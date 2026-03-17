import { useMemo } from 'react'
import { Users, Home, TrendingUp, Building2 } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface DemografieModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  scans: ScanListItem[]
  onClose: () => void
}

/**
 * Demografie modal — aggregates CBS data from scanned wijken.
 * Shows inwoners, WOZ, stedelijkheid, age distribution, income, households.
 */
export function DemografieModal({ gemeenteNaam, gemeenteCode, scans, onClose }: DemografieModalProps) {
  // Aggregate CBS metrics from completed scans in this gemeente
  const metrics = useMemo(() => {
    const gemeenteScans = scans.filter(
      (s) => s.gemeente_code === gemeenteCode && s.status === 'completed' && s.neighborhood_metrics,
    )
    if (gemeenteScans.length === 0) return null

    const allMetrics = gemeenteScans
      .map((s) => s.neighborhood_metrics!)
      .filter(Boolean)

    return aggregateMetrics(allMetrics)
  }, [scans, gemeenteCode])

  return (
    <GemeenteModal title={`Demografie · ${gemeenteNaam}`} onClose={onClose}>
      {!metrics ? (
        <div className="text-center py-12">
          <Users size={40} className="mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-600 text-sm">
            Geen CBS data beschikbaar. Scan een wijk om demografische gegevens te laden.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={<Users size={20} />}
              label="Inwoners"
              value={metrics.inwoners != null ? metrics.inwoners.toLocaleString('nl-NL') : '—'}
            />
            <StatCard
              icon={<Home size={20} />}
              label="Gem. WOZ-waarde"
              value={metrics.wozGemiddeld != null ? `€${Math.round(metrics.wozGemiddeld).toLocaleString('nl-NL')}` : '—'}
            />
            <StatCard
              icon={<Building2 size={20} />}
              label="Stedelijkheid"
              value={metrics.stedelijkheid ?? '—'}
            />
          </div>

          {/* Age distribution */}
          {metrics.leeftijd && (
            <Section title="Leeftijdsverdeling">
              <div className="space-y-2">
                <AgeBar label="0–14 jaar" pct={metrics.leeftijd.pct_0_14} />
                <AgeBar label="15–24 jaar" pct={metrics.leeftijd.pct_15_24} />
                <AgeBar label="25–44 jaar" pct={metrics.leeftijd.pct_25_44} />
                <AgeBar label="45–64 jaar" pct={metrics.leeftijd.pct_45_64} />
                <AgeBar label="65+ jaar" pct={metrics.leeftijd.pct_65_plus} />
              </div>
            </Section>
          )}

          {/* Income */}
          {metrics.inkomen && (
            <Section title="Inkomen">
              <div className="grid grid-cols-3 gap-4">
                <MiniStat label="Mediaan inkomen" value={metrics.inkomen.mediaan != null ? `€${metrics.inkomen.mediaan.toLocaleString('nl-NL')}` : '—'} />
                <MiniStat label="% laag inkomen" value={metrics.inkomen.pctLaag != null ? `${metrics.inkomen.pctLaag.toFixed(1)}%` : '—'} />
                <MiniStat label="% hoog inkomen" value={metrics.inkomen.pctHoog != null ? `${metrics.inkomen.pctHoog.toFixed(1)}%` : '—'} />
              </div>
            </Section>
          )}

          {/* Households */}
          {metrics.huishoudens && (
            <Section title="Huishoudens">
              <div className="grid grid-cols-2 gap-4">
                <MiniStat label="Totaal" value={metrics.huishoudens.totaal != null ? metrics.huishoudens.totaal.toLocaleString('nl-NL') : '—'} />
                <MiniStat label="% eenpersoons" value={metrics.huishoudens.pctEenpersoons != null ? `${metrics.huishoudens.pctEenpersoons.toFixed(1)}%` : '—'} />
                <MiniStat label="% koopwoning" value={metrics.huishoudens.pctKoop != null ? `${metrics.huishoudens.pctKoop.toFixed(1)}%` : '—'} />
                <MiniStat label="% huurwoning" value={metrics.huishoudens.pctHuur != null ? `${metrics.huishoudens.pctHuur.toFixed(1)}%` : '—'} />
              </div>
            </Section>
          )}

          <p className="text-xs text-neutral-400 text-center">
            Gebaseerd op CBS data van {metrics.wijkCount} gescande {metrics.wijkCount === 1 ? 'wijk' : 'wijken'}
            {metrics.peiljaar ? ` · peiljaar ${metrics.peiljaar}` : ''}
          </p>
        </div>
      )}
    </GemeenteModal>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AggregatedMetrics {
  inwoners: number | null
  wozGemiddeld: number | null
  stedelijkheid: string | null
  leeftijd: { pct_0_14: number; pct_15_24: number; pct_25_44: number; pct_45_64: number; pct_65_plus: number } | null
  inkomen: { mediaan: number | null; pctLaag: number | null; pctHoog: number | null } | null
  huishoudens: { totaal: number | null; pctEenpersoons: number | null; pctKoop: number | null; pctHuur: number | null } | null
  wijkCount: number
  peiljaar: string | null
}

function aggregateMetrics(all: CbsNeighborhoodMetrics[]): AggregatedMetrics {
  const wijkCount = all.length
  const peiljaar = all[0]?.peiljaar ?? null

  // Sum/average across wijken
  let totalInwoners = 0
  let wozSum = 0
  let wozCount = 0
  let stedelijkheidVal: string | null = null

  for (const m of all) {
    const d = m.data
    if (d.demografie?.aantal_inwoners != null) totalInwoners += d.demografie.aantal_inwoners
    if (d.gemiddelde_woz_waarde != null) {
      wozSum += d.gemiddelde_woz_waarde
      wozCount++
    }
    if (d.stedelijkheid?.omschrijving && !stedelijkheidVal) {
      stedelijkheidVal = d.stedelijkheid.omschrijving
    }
  }

  // Age — average percentages
  const ageData = all.filter((m) => m.data.leeftijdsverdeling)
  const leeftijd = ageData.length > 0
    ? {
        pct_0_14: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_0_14)),
        pct_15_24: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_15_24)),
        pct_25_44: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_25_44)),
        pct_45_64: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_45_64)),
        pct_65_plus: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_65_plus)),
      }
    : null

  // Income — average
  const incomeData = all.filter((m) => m.data.inkomen)
  const inkomen = incomeData.length > 0
    ? {
        mediaan: avg(incomeData.map((m) => m.data.inkomen?.gem_per_ontvanger)),
        pctLaag: avg(incomeData.map((m) => m.data.inkomen?.perc_laagste_40)),
        pctHoog: avg(incomeData.map((m) => m.data.inkomen?.perc_hoogste_20)),
      }
    : null

  // Households — sum totals, average percentages
  const hhData = all.filter((m) => m.data.huishoudens)
  const huishoudens = hhData.length > 0
    ? {
        totaal: sum(hhData.map((m) => m.data.huishoudens?.totaal)),
        pctEenpersoons: hhData.length > 0
          ? avg(hhData.map((m) => {
              const hh = m.data.huishoudens
              if (!hh || !hh.totaal || !hh.eenpersoons) return null
              return (hh.eenpersoons / hh.totaal) * 100
            }))
          : null,
        pctKoop: avg(all.map((m) => m.data.demografie?.percentage_koopwoningen)),
        pctHuur: avg(all.map((m) => m.data.demografie?.percentage_huurwoningen)),
      }
    : null

  return {
    inwoners: totalInwoners || null,
    wozGemiddeld: wozCount > 0 ? wozSum / wozCount : null,
    stedelijkheid: stedelijkheidVal,
    leeftijd,
    inkomen,
    huishoudens,
    wijkCount,
    peiljaar,
  }
}

function avg(values: (number | null | undefined)[]): number {
  const valid = values.filter((v): v is number => v != null)
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
}

function sum(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null
}

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
      <span className="text-aura-amber mb-2 block">{icon}</span>
      <p className="text-xl font-semibold text-aura-ink">{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-700 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function AgeBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-600 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-aura-amber/60 rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-neutral-700 w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-aura-ink mt-0.5">{value}</p>
    </div>
  )
}
