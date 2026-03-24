import { motion } from 'framer-motion'
import { GemeenteModal } from './GemeenteModal'
import type { CbsNeighborhoodMetrics } from '@/lib/types/scan'
import { AMBER, AMBER_GRADIENT, GREEN, RED } from '@/lib/tokens'

type MetricKey = 'koopwoning' | 'dichtheid' | 'eenpersoons' | 'inkomen' | 'woz' | 'inwoners' | 'criminaliteit' | 'supermarkt' | 'leeftijd'

interface WijkDetailModalProps {
  metricKey: MetricKey
  metrics: CbsNeighborhoodMetrics
  wijkNaam: string
  onClose: () => void
}

const METRIC_TITLES: Record<MetricKey, string> = {
  koopwoning: 'Woningtype',
  dichtheid: 'Stedelijkheid',
  eenpersoons: 'Huishoudens',
  inkomen: 'Inkomen',
  woz: 'WOZ-waarde',
  inwoners: 'Bevolking',
  criminaliteit: 'Veiligheid & Leefbaarheid',
  supermarkt: 'Voorzieningen & Nabijheid',
  leeftijd: 'Leeftijdsverdeling',
}

/* ── Horizontal bar component ──────────────────────────────── */

function HBar({ label, value, max, color, suffix = '' }: { label: string; value: number | null; max: number; color: string; suffix?: string }) {
  const pct = value != null && max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold text-slate-500 w-24 shrink-0 text-right tabular-nums">
        {label}
      </span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        />
      </div>
      <span className="text-[12px] font-bold text-slate-900 w-16 tabular-nums">
        {value != null ? `${Math.round(value * 10) / 10}${suffix}` : '—'}
      </span>
    </div>
  )
}

/* ── Stat row ──────────────────────────────────────────────── */

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className="text-[13px] font-bold text-slate-900 tabular-nums">{value}</span>
    </div>
  )
}

/* ── Section header ────────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <h3
      className="text-[10px] font-black text-slate-400 uppercase mb-3 mt-5 first:mt-0"
      style={{ letterSpacing: '0.2em' }}
    >
      {title}
    </h3>
  )
}

/* ── Per-metric content ────────────────────────────────────── */

function KoopwoningContent({ metrics }: { metrics: CbsNeighborhoodMetrics }) {
  const koop = metrics.data.demografie?.percentage_koopwoningen
  const huur = metrics.data.demografie?.percentage_huurwoningen
  return (
    <>
      <SectionHeader title="Eigendomsverdeling" />
      <div className="space-y-3">
        <HBar label="Koopwoning" value={koop} max={100} color={AMBER.base} suffix="%" />
        <HBar label="Huurwoning" value={huur} max={100} color={AMBER.dark} suffix="%" />
      </div>
      <div className="mt-4 rounded-[14px] bg-amber-50/60 p-4">
        <p className="text-[12px] text-slate-600 leading-relaxed">
          {koop != null && koop >= 60
            ? 'Sterke koopmarkt — geschikt voor nieuwbouw koopwoningen en optoppen.'
            : koop != null && koop >= 40
            ? 'Gemengde markt — zowel koop als huur kansrijk.'
            : 'Huurmarkt dominant — focus op huurwoningen of transformatie naar koop.'}
        </p>
      </div>
    </>
  )
}

function LeeftijdContent({ metrics }: { metrics: CbsNeighborhoodMetrics }) {
  const l = metrics.data.leeftijdsverdeling
  if (!l) return <p className="text-[13px] text-slate-400">Geen leeftijdsdata beschikbaar.</p>

  const groups = [
    { label: '0–14', value: l.perc_0_14, color: AMBER.light, desc: 'Kinderen' },
    { label: '15–24', value: l.perc_15_24, color: AMBER.mid, desc: 'Jongeren' },
    { label: '25–44', value: l.perc_25_44, color: AMBER.base, desc: 'Jong werkend' },
    { label: '45–64', value: l.perc_45_64, color: AMBER.dark, desc: 'Midden' },
    { label: '65+', value: l.perc_65_plus, color: AMBER.deep, desc: 'Senioren' },
  ]
  const total = groups.reduce((s, g) => s + (g.value ?? 0), 0) || 1
  const max = Math.max(...groups.map(g => g.value ?? 0), 1)

  // Find dominant group
  const dominant = groups.reduce((a, b) => ((b.value ?? 0) > (a.value ?? 0) ? b : a))

  return (
    <>
      <SectionHeader title="Leeftijdsverdeling" />

      {/* Stacked horizontal bar — visual overview */}
      <div className="flex h-6 rounded-full overflow-hidden mb-4">
        {groups.map((g) => {
          const pct = (g.value ?? 0) / total * 100
          return pct > 0 ? (
            <div
              key={g.label}
              className="relative flex items-center justify-center"
              style={{ width: `${pct}%`, backgroundColor: g.color }}
            >
              {pct > 12 && (
                <span className="text-[9px] font-black text-white tabular-nums">{Math.round(g.value ?? 0)}%</span>
              )}
            </div>
          ) : null
        })}
      </div>

      {/* Legend + detail bars */}
      <div className="space-y-3">
        {groups.map((g) => (
          <HBar key={g.label} label={`${g.label} jaar`} value={g.value} max={max} color={g.color} suffix="%" />
        ))}
      </div>

      {/* Insight */}
      <div className="mt-4 rounded-[14px] bg-amber-50/60 p-4">
        <p className="text-[12px] text-slate-600 leading-relaxed">
          <span className="font-bold" style={{ color: dominant.color }}>{dominant.desc}</span>
          {' is de grootste groep'}
          {dominant.value != null ? ` (${Math.round(dominant.value)}%)` : ''}.
          {' '}
          {(l.perc_65_plus ?? 0) >= 25
            ? 'Vergrijzende wijk — doorstroomwoningen en levensloopbestendig bouwen kansrijk.'
            : (l.perc_25_44 ?? 0) >= 30
            ? 'Jong-werkende wijk — huurappartementen en starterswoningen in trek.'
            : 'Gebalanceerde leeftijdsopbouw — breed woningaanbod passend.'}
        </p>
      </div>
    </>
  )
}

function InkomenContent({ metrics }: { metrics: CbsNeighborhoodMetrics }) {
  const ink = metrics.data.inkomen
  if (!ink) return <p className="text-[13px] text-slate-400">Geen inkomensdata beschikbaar.</p>
  return (
    <>
      <SectionHeader title="Inkomensverdeling" />
      <div className="space-y-1">
        <StatRow label="Gem. per ontvanger" value={ink.gem_per_ontvanger != null ? `€${Math.round(ink.gem_per_ontvanger).toLocaleString('nl-NL')}` : '—'} />
        <StatRow label="Gem. per inwoner" value={ink.gem_per_inwoner != null ? `€${Math.round(ink.gem_per_inwoner).toLocaleString('nl-NL')}` : '—'} />
        <StatRow label="Gestandaardiseerd" value={ink.gem_gestandaardiseerd != null ? `€${Math.round(ink.gem_gestandaardiseerd).toLocaleString('nl-NL')}` : '—'} />
      </div>
      <SectionHeader title="Verdeling" />
      <div className="space-y-3">
        <HBar label="Laagste 40%" value={ink.perc_laagste_40} max={100} color={AMBER.dark} suffix="%" />
        <HBar label="Hoogste 20%" value={ink.perc_hoogste_20} max={100} color={AMBER.base} suffix="%" />
      </div>
      {ink.peiljaar && (
        <p className="text-[10px] text-slate-400 mt-3">
          Inkomensdata: CBS peiljaar {ink.peiljaar}
        </p>
      )}
    </>
  )
}

function HuishoudensContent({ metrics }: { metrics: CbsNeighborhoodMetrics }) {
  const hh = metrics.data.huishoudens
  if (!hh) return <p className="text-[13px] text-slate-400">Geen huishoudensdata beschikbaar.</p>
  const max = hh.totaal ?? 1
  return (
    <>
      <div className="space-y-1">
        <StatRow label="Totaal huishoudens" value={hh.totaal?.toLocaleString('nl-NL') ?? '—'} />
        <StatRow label="Gem. grootte" value={hh.gemiddelde_grootte != null ? String(Math.round(hh.gemiddelde_grootte * 10) / 10) : '—'} />
      </div>
      <SectionHeader title="Huishoudsamenstelling" />
      <div className="space-y-3">
        <HBar label="Eenpersoons" value={hh.eenpersoons} max={max} color={AMBER.base} />
        <HBar label="Zonder kinderen" value={hh.zonder_kinderen} max={max} color={AMBER.dark} />
        <HBar label="Met kinderen" value={hh.met_kinderen} max={max} color={AMBER.deep} />
      </div>
    </>
  )
}

function CriminaliteitContent({ metrics }: { metrics: CbsNeighborhoodMetrics }) {
  const c = metrics.criminaliteit
  if (!c) return <p className="text-[13px] text-slate-400">Geen criminaliteitsdata beschikbaar.</p>
  const cat = c.categorien
  const maxCat = Math.max(cat.vermogensdelicten?.per_1000 ?? 0, cat.vernieling?.per_1000 ?? 0, cat.geweld?.per_1000 ?? 0, 1)
  return (
    <>
      <SectionHeader title="Criminaliteit per 1.000 inwoners" />
      <div className="space-y-3">
        <HBar label="Vermogen" value={cat.vermogensdelicten?.per_1000} max={maxCat} color={AMBER.base} suffix="/1k" />
        <HBar label="Vernieling" value={cat.vernieling?.per_1000} max={maxCat} color={AMBER.dark} suffix="/1k" />
        <HBar label="Geweld" value={cat.geweld?.per_1000} max={maxCat} color={AMBER.deep} suffix="/1k" />
      </div>
      <div className="mt-4 space-y-1">
        <StatRow label="Totaal misdrijven" value={c.totaal_misdrijven?.toLocaleString('nl-NL') ?? '—'} />
        <StatRow label="Per 1.000 inwoners" value={c.per_1000_inwoners != null ? String(Math.round(c.per_1000_inwoners * 10) / 10) : '—'} />
      </div>
    </>
  )
}

function NabijheidContent({ metrics }: { metrics: CbsNeighborhoodMetrics }) {
  const n = metrics.nabijheid
  if (!n) return <p className="text-[13px] text-slate-400">Geen nabijheidsdata beschikbaar.</p>
  const a = n.afstanden
  const maxKm = Math.max(a.supermarkt_km ?? 0, a.huisarts_km ?? 0, a.basisschool_km ?? 0, a.kinderdagverblijf_km ?? 0, a.treinstation_km ?? 0, a.overstapstation_km ?? 0, 1)
  return (
    <>
      <SectionHeader title="Afstand tot voorzieningen (km)" />
      <div className="space-y-3">
        <HBar label="Supermarkt" value={a.supermarkt_km} max={maxKm} color={AMBER.base} suffix=" km" />
        <HBar label="Huisarts" value={a.huisarts_km} max={maxKm} color={AMBER.mid} suffix=" km" />
        <HBar label="Basisschool" value={a.basisschool_km} max={maxKm} color={AMBER.dark} suffix=" km" />
        <HBar label="Kinderopvang" value={a.kinderdagverblijf_km} max={maxKm} color={AMBER.dark} suffix=" km" />
        <HBar label="Treinstation" value={a.treinstation_km} max={maxKm} color={AMBER.deep} suffix=" km" />
        <HBar label="OV-knooppunt" value={a.overstapstation_km} max={maxKm} color={AMBER.deep} suffix=" km" />
      </div>
    </>
  )
}

function SimpleStatContent({ metrics, metricKey }: { metrics: CbsNeighborhoodMetrics; metricKey: MetricKey }) {
  const d = metrics.data
  switch (metricKey) {
    case 'dichtheid': {
      const sted = d.stedelijkheid
      return (
        <>
          <SectionHeader title="Stedelijkheid" />
          <div className="space-y-1">
            <StatRow label="Klasse" value={sted?.omschrijving ?? '—'} />
            <StatRow label="Adressendichtheid" value={sted?.omgevingsadressendichtheid != null ? `${Math.round(sted.omgevingsadressendichtheid)}/km²` : '—'} />
            <StatRow label="Stedelijkheidsklasse" value={sted?.klasse != null ? `${sted.klasse} van 5` : '—'} />
          </div>
          <div className="mt-4 rounded-[14px] bg-amber-50/60 p-4">
            <p className="text-[12px] text-slate-600 leading-relaxed">
              {(sted?.klasse ?? 5) <= 2
                ? 'Zeer stedelijk gebied — hoge dichtheid, meer concurrentie maar ook meer vraag. Focus op transformatie en verdichting.'
                : (sted?.klasse ?? 5) <= 3
                ? 'Matig stedelijk — balans tussen vraag en beschikbaarheid. Geschikt voor diverse ontwikkelstrategieën.'
                : 'Landelijk gebied — meer ruimte, lagere grondprijzen. Geschikt voor nieuwbouw en grotere projecten.'}
            </p>
          </div>
        </>
      )
    }
    case 'woz':
      return (
        <>
          <SectionHeader title="WOZ-waarde" />
          <StatRow label="Gemiddelde WOZ" value={d.gemiddelde_woz_waarde != null ? `€${Math.round(d.gemiddelde_woz_waarde * 1000).toLocaleString('nl-NL')}` : '—'} />
          <div className="mt-4 rounded-[14px] bg-amber-50/60 p-4">
            <p className="text-[12px] text-slate-600 leading-relaxed">
              De gemiddelde WOZ-waarde geeft een indicatie van het prijsniveau. Vergelijk met aankoopprijs om rendementspotentieel te beoordelen.
            </p>
          </div>
        </>
      )
    case 'inwoners':
      return (
        <>
          <SectionHeader title="Bevolking" />
          <StatRow label="Aantal inwoners" value={d.demografie?.aantal_inwoners?.toLocaleString('nl-NL') ?? '—'} />
          <StatRow label="Stedelijkheid" value={d.stedelijkheid?.omschrijving ?? '—'} />
          <StatRow label="Adressendichtheid" value={d.stedelijkheid?.omgevingsadressendichtheid != null ? `${Math.round(d.stedelijkheid.omgevingsadressendichtheid)}/km²` : '—'} />
        </>
      )
    default:
      return <p className="text-[13px] text-slate-400">Geen aanvullende data beschikbaar.</p>
  }
}

/* ── Main component ────────────────────────────────────────── */

export function WijkDetailModal({ metricKey, metrics, wijkNaam, onClose }: WijkDetailModalProps) {
  const title = `${METRIC_TITLES[metricKey]} · ${wijkNaam}`
  const peiljaar = metrics.peiljaar

  const footer = peiljaar ? (
    <span className="text-[10px] text-slate-400">
      CBS data · peiljaar {peiljaar}
    </span>
  ) : undefined

  return (
    <GemeenteModal title={title} onClose={onClose} footer={footer}>
      {metricKey === 'koopwoning' && <KoopwoningContent metrics={metrics} />}
      {metricKey === 'leeftijd' && <LeeftijdContent metrics={metrics} />}
      {metricKey === 'inkomen' && <InkomenContent metrics={metrics} />}
      {metricKey === 'eenpersoons' && <HuishoudensContent metrics={metrics} />}
      {metricKey === 'criminaliteit' && <CriminaliteitContent metrics={metrics} />}
      {metricKey === 'supermarkt' && <NabijheidContent metrics={metrics} />}
      {(metricKey === 'dichtheid' || metricKey === 'woz' || metricKey === 'inwoners') && (
        <SimpleStatContent metrics={metrics} metricKey={metricKey} />
      )}
    </GemeenteModal>
  )
}
