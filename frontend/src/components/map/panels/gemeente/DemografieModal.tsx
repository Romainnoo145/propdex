import { useMemo } from 'react'
import { Users, Home, Building2 } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface DemografieModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  scans: ScanListItem[]
  onClose: () => void
}

export function DemografieModal({ gemeenteNaam, gemeenteCode, scans, onClose }: DemografieModalProps) {
  const metrics = useMemo(() => {
    const gemeenteScans = scans.filter(
      (s) => s.gemeente_code === gemeenteCode && s.status === 'completed' && s.neighborhood_metrics,
    )
    if (gemeenteScans.length === 0) return null
    return aggregateMetrics(gemeenteScans.map((s) => s.neighborhood_metrics!).filter(Boolean))
  }, [scans, gemeenteCode])

  const footer = metrics ? (
    <span className="text-[10px] text-[#94a3b8]">
      CBS data van {metrics.wijkCount} gescande {metrics.wijkCount === 1 ? 'wijk' : 'wijken'}
      {metrics.peiljaar ? ` · peiljaar ${metrics.peiljaar}` : ''}
    </span>
  ) : undefined

  return (
    <GemeenteModal title={`Demografie · ${gemeenteNaam}`} onClose={onClose} footer={footer}>
      {!metrics ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users size={32} strokeWidth={1.5} className="text-[#cbd5e1]" />
          <p className="mt-4 text-[13px] text-[#6B7280]">
            Geen CBS data beschikbaar. Scan een wijk om demografische gegevens te laden.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero stats — matches parcel ScoreCircleCard pattern */}
          <div className="grid grid-cols-3 gap-1.5">
            <StatCard icon={<Users size={16} strokeWidth={1.5} />} label="Inwoners" color="#F9A826"
              value={metrics.inwoners != null ? metrics.inwoners.toLocaleString('nl-NL') : '—'} />
            <StatCard icon={<Home size={16} strokeWidth={1.5} />} label="WOZ-waarde" color="#22C55E"
              value={metrics.wozGemiddeld != null ? `€${Math.round(metrics.wozGemiddeld).toLocaleString('nl-NL')}` : '—'} />
            <StatCard icon={<Building2 size={16} strokeWidth={1.5} />} label="Stedelijkheid" color="#3b82f6"
              value={metrics.stedelijkheid ?? '—'} />
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
              <div className="grid grid-cols-3 gap-1.5">
                <MiniStat label="Mediaan inkomen" value={metrics.inkomen.mediaan != null ? `€${metrics.inkomen.mediaan.toLocaleString('nl-NL')}` : '—'} />
                <MiniStat label="% laag inkomen" value={metrics.inkomen.pctLaag != null ? `${metrics.inkomen.pctLaag.toFixed(1)}%` : '—'} />
                <MiniStat label="% hoog inkomen" value={metrics.inkomen.pctHoog != null ? `${metrics.inkomen.pctHoog.toFixed(1)}%` : '—'} />
              </div>
            </Section>
          )}

          {/* Households */}
          {metrics.huishoudens && (
            <Section title="Huishoudens">
              <div className="grid grid-cols-2 gap-1.5">
                <MiniStat label="Totaal" value={metrics.huishoudens.totaal != null ? metrics.huishoudens.totaal.toLocaleString('nl-NL') : '—'} />
                <MiniStat label="% eenpersoons" value={metrics.huishoudens.pctEenpersoons != null ? `${metrics.huishoudens.pctEenpersoons.toFixed(1)}%` : '—'} />
                <MiniStat label="% koopwoning" value={metrics.huishoudens.pctKoop != null ? `${metrics.huishoudens.pctKoop.toFixed(1)}%` : '—'} />
                <MiniStat label="% huurwoning" value={metrics.huishoudens.pctHuur != null ? `${metrics.huishoudens.pctHuur.toFixed(1)}%` : '—'} />
              </div>
            </Section>
          )}
        </div>
      )}
    </GemeenteModal>
  )
}

/* ── Aggregation (unchanged logic) ─────────────────────────── */

interface AggregatedMetrics {
  inwoners: number | null
  wozGemiddeld: number | null
  stedelijkheid: string | null
  leeftijd: { pct_0_14: number; pct_15_24: number; pct_25_44: number; pct_45_64: number; pct_65_plus: number } | null
  inkomen: { mediaan: number | null; pctLaag: number | null; pctHoog: number | null } | null
  huishoudens: { totaal: number | null; pctEenpersoons: number | null; pctKoop: number | null; pctHuur: number | null } | null
  wijkCount: number
  peiljaar: number | null
}

function aggregateMetrics(all: CbsNeighborhoodMetrics[]): AggregatedMetrics {
  const wijkCount = all.length
  const peiljaar = all[0]?.peiljaar ?? null
  let totalInwoners = 0
  let wozSum = 0
  let wozCount = 0
  let stedelijkheidVal: string | null = null

  for (const m of all) {
    const d = m.data
    if (d.demografie?.aantal_inwoners != null) totalInwoners += d.demografie.aantal_inwoners
    if (d.gemiddelde_woz_waarde != null) { wozSum += d.gemiddelde_woz_waarde; wozCount++ }
    if (d.stedelijkheid?.omschrijving && !stedelijkheidVal) stedelijkheidVal = d.stedelijkheid.omschrijving
  }

  const ageData = all.filter((m) => m.data.leeftijdsverdeling)
  const leeftijd = ageData.length > 0 ? {
    pct_0_14: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_0_14)),
    pct_15_24: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_15_24)),
    pct_25_44: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_25_44)),
    pct_45_64: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_45_64)),
    pct_65_plus: avg(ageData.map((m) => m.data.leeftijdsverdeling?.perc_65_plus)),
  } : null

  const incomeData = all.filter((m) => m.data.inkomen)
  const inkomen = incomeData.length > 0 ? {
    mediaan: avg(incomeData.map((m) => m.data.inkomen?.gem_per_ontvanger)),
    pctLaag: avg(incomeData.map((m) => m.data.inkomen?.perc_laagste_40)),
    pctHoog: avg(incomeData.map((m) => m.data.inkomen?.perc_hoogste_20)),
  } : null

  const hhData = all.filter((m) => m.data.huishoudens)
  const huishoudens = hhData.length > 0 ? {
    totaal: sum(hhData.map((m) => m.data.huishoudens?.totaal)),
    pctEenpersoons: avg(hhData.map((m) => {
      const hh = m.data.huishoudens
      if (!hh || !hh.totaal || !hh.eenpersoons) return null
      return (hh.eenpersoons / hh.totaal) * 100
    })),
    pctKoop: avg(all.map((m) => m.data.demografie?.percentage_koopwoningen)),
    pctHuur: avg(all.map((m) => m.data.demografie?.percentage_huurwoningen)),
  } : null

  return { inwoners: totalInwoners || null, wozGemiddeld: wozCount > 0 ? wozSum / wozCount : null, stedelijkheid: stedelijkheidVal, leeftijd, inkomen, huishoudens, wijkCount, peiljaar }
}

function avg(values: (number | null | undefined)[]): number {
  const valid = values.filter((v): v is number => v != null)
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
}
function sum(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null
}

/* ── UI Components (parcel token system) ───────────────────── */

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 flex flex-col items-center text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-[14px] mb-3"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <p className="text-2xl font-black tracking-tighter tabular-nums text-[#0E1111]">{value}</p>
      <p className="text-[11px] font-extrabold uppercase text-[#94a3b8] mt-1" style={{ letterSpacing: '0.15em' }}>{label}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-[10px] font-black text-slate-400 uppercase mb-3"
        style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function AgeBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-black text-[#94a3b8] uppercase w-20 shrink-0" style={{ letterSpacing: '0.1em' }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: '#F9A826' }} />
      </div>
      <span className="text-[12px] font-bold text-[#0E1111] w-12 text-right tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-[#F2F6F3] px-3 py-2.5">
      <p className="text-[11px] text-[#94a3b8]">{label}</p>
      <p className="text-[13px] font-bold text-[#0E1111] mt-0.5">{value}</p>
    </div>
  )
}
