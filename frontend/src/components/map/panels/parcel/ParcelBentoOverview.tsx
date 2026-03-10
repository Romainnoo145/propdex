import { useState } from 'react'
import { Grid3x3, Building2, LandPlot, ChevronUp, ChevronDown } from 'lucide-react'
import type { ScanResultItem } from '@/lib/types/scan'
import { ParcelHero } from './ParcelHero'
import { ScoreGauge } from './ScoreGauge'
import { BouwjaarTimeline } from './BouwjaarTimeline'

export type CategoryKey = 'potentie' | 'risico' | 'juridisch'

interface ParcelBentoOverviewProps {
  parcel: ScanResultItem
  onSelectCategory: (cat: CategoryKey) => void
  meldingenCount: number | null
}

/* ── Helpers ───────────────────────────────────────────────── */

type BestemmingCategory =
  | 'wonen'
  | 'commercieel'
  | 'centrum'
  | 'maatschappelijk'
  | 'groen'
  | 'industrie'
  | 'gemengd'

const BESTEMMING_META: Record<BestemmingCategory, { label: string; image: string }> = {
  wonen: { label: 'Wonen', image: '/images/bestemmingen/wonen.jpg' },
  commercieel: { label: 'Commercieel', image: '/images/bestemmingen/commercieel.jpg' },
  centrum: { label: 'Centrum', image: '/images/bestemmingen/centrum.jpg' },
  maatschappelijk: { label: 'Maatschappelijk', image: '/images/bestemmingen/maatschappelijk.jpg' },
  groen: { label: 'Groen', image: '/images/bestemmingen/groen.jpg' },
  industrie: { label: 'Industrie', image: '/images/bestemmingen/industrie.jpg' },
  gemengd: { label: 'Gemengd', image: '/images/bestemmingen/gemengd.jpg' },
}

function deriveBestemmingCategory(
  bestemmingen: ScanResultItem['bestemmingen'],
): BestemmingCategory {
  if (!bestemmingen || bestemmingen.length === 0) return 'gemengd'
  const text = JSON.stringify(bestemmingen).toLowerCase()

  // Specific categories first (most precise match wins)
  if (text.includes('maatschappelijk')) return 'maatschappelijk'
  if (text.includes('groen') || text.includes('natuur') || text.includes('bos')) return 'groen'
  if (text.includes('bedrijf') || text.includes('bedrijventerrein')) return 'industrie'
  if (text.includes('centrum') || text.includes('centrumgebied')) return 'centrum'
  if (text.includes('detailhandel') || text.includes('kantoor') || text.includes('horeca')) return 'commercieel'

  const hasWonen = text.includes('wonen') || text.includes('woongebied')
  const hasMix = text.includes('gemengd')
  if (hasWonen && hasMix) return 'gemengd'
  if (hasWonen) return 'wonen'
  return 'gemengd'
}

function formatPandStatus(status: string | null): string {
  if (!status) return 'Onbekend'
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── Bento Grid card types ─────────────────────────────────── */

type BentoCard = 'aerial' | 'bestemming' | 'score'


/* ── Section title ─────────────────────────────────────────── */

const sectionTitle =
  'text-[10px] uppercase text-slate-400 tracking-widest font-medium mb-1'

/* ── Card Label Bar ────────────────────────────────────────── */

function CardLabelBar({ label, isActive }: { label: string; isActive: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        height: 28,
        background: isActive ? '#F9A826' : '#F2F6F3',
      }}
    >
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: isActive ? '#FFFFFF' : '#8A948D',
          textTransform: 'uppercase',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.2em',
        }}
      >
        {label}
      </span>
    </div>
  )
}

/* ── Component ─────────────────────────────────────────────── */

export function ParcelBentoOverview({
  parcel,
  onSelectCategory,
  meldingenCount,
}: ParcelBentoOverviewProps) {
  const [activeCard, setActiveCard] = useState<BentoCard>('aerial')
  const category = deriveBestemmingCategory(parcel.bestemmingen)
  const bm = parcel.building_metrics
  const vrijPct =
    parcel.area_m2 != null && parcel.area_m2 > 0 && bm?.pand_oppervlakte_m2 != null
      ? Math.round(((parcel.area_m2 - bm.pand_oppervlakte_m2) / parcel.area_m2) * 100)
      : parcel.area_m2 != null && !parcel.has_pand
        ? 100
        : null

  return (
    <div className="flex-1 flex flex-col px-8 pb-8">
      {/* ── Bento Image Grid (3 cards) ───────────────── */}
      <div className="grid grid-cols-3 gap-1.5 mt-6">
        {/* Card 1: Aerial View */}
        <button
          type="button"
          onClick={() => setActiveCard('aerial')}
          className="flex flex-col rounded-[20px] overflow-hidden transition-all duration-200"
          style={{
            border: activeCard === 'aerial' ? '2px solid #F9A826' : '2px solid transparent',
          }}
        >
          <div className="relative aspect-[5/6] overflow-hidden">
            <ParcelHero parcelId={parcel.parcel_id} />
          </div>
          <CardLabelBar label="Satelliet" isActive={activeCard === 'aerial'} />
        </button>

        {/* Card 2: Bestemming type */}
        <button
          type="button"
          onClick={() => {
            setActiveCard('bestemming')
            onSelectCategory('juridisch')
          }}
          className="flex flex-col rounded-[20px] overflow-hidden transition-all duration-200"
          style={{
            border: activeCard === 'bestemming' ? '2px solid #F9A826' : '2px solid transparent',
          }}
        >
          <div className="relative aspect-[5/6] overflow-hidden">
            <img
              src={BESTEMMING_META[category].image}
              alt={BESTEMMING_META[category].label}
              className="h-full w-full object-cover"
            />
          </div>
          <CardLabelBar label={BESTEMMING_META[category].label} isActive={activeCard === 'bestemming'} />
        </button>

        {/* Card 3: Score gauge */}
        <button
          type="button"
          onClick={() => {
            setActiveCard('score')
            onSelectCategory('potentie')
          }}
          className="flex flex-col rounded-[20px] overflow-hidden transition-all duration-200"
          style={{
            border: activeCard === 'score' ? '2px solid #F9A826' : '2px solid transparent',
          }}
        >
          <div className="aspect-[5/6] flex items-center justify-center bg-[#F8FAF9]">
            <ScoreGauge score={parcel.score} />
          </div>
          <CardLabelBar label="Score" isActive={activeCard === 'score'} />
        </button>
      </div>

      {/* ── Bouwjaar ─────────────────────────────────── */}
      <div className="mt-6">
        <h3 className={sectionTitle}>Bouwjaar</h3>
        <BouwjaarTimeline bouwjaar={parcel.bouwjaar} />
      </div>

      {/* ── Kenmerken (flex filler) ────────────────── */}
      <div className="mt-6 flex-1 grid grid-cols-3 gap-1.5">
        <KenmerkenCard
          icon={<LandPlot size={16} strokeWidth={1.5} />}
          label="Perceel"
          value={parcel.area_m2 != null ? `${Math.round(parcel.area_m2)}` : '—'}
          unit="m²"
        />
        <KenmerkenCard
          icon={<Building2 size={16} strokeWidth={1.5} />}
          label="Gebouw"
          value={bm?.pand_oppervlakte_m2 ? `${Math.round(bm.pand_oppervlakte_m2)}` : '—'}
          unit="m²"
        />
        <KenmerkenCard
          icon={<Grid3x3 size={16} strokeWidth={1.5} />}
          label="Beschikbaar"
          value={vrijPct != null ? `${vrijPct}` : '—'}
          unit="%"
          highlight={vrijPct != null && vrijPct >= 40}
        />
      </div>

      {/* ── Secondary Fields ──────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        <SecondaryField
          value={parcel.has_pand ? formatPandStatus(parcel.pand_status) : 'Leeg perceel'}
        />
        <SecondaryField
          value={
            meldingenCount === null
              ? '...'
              : meldingenCount === 0
                ? 'Geen vergunningen'
                : `${meldingenCount} vergunning${meldingenCount === 1 ? '' : 'en'}`
          }
        />
      </div>

      {/* ── Trust Metadata ───────────────────────────── */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: Kadaster · BAG · DSO
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          {parcel.parcel_code}
        </span>
      </div>
    </div>
  )
}

/* ── KenmerkenCard ─────────────────────────────────────────── */

function KenmerkenCard({
  icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  highlight?: boolean
}) {
  return (
    <div
      className="flex flex-col justify-between h-full rounded-[24px] p-5"
      style={{
        background: highlight ? 'rgba(249, 168, 38, 0.08)' : '#FFFFFF',
        border: highlight ? '1px solid rgba(249, 168, 38, 0.3)' : '1px solid #EAEFEF',
      }}
    >
      {/* Top: icon + label + chevrons */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: highlight ? '#F9A826' : '#cbd5e1' }}>{icon}</span>
          <span
            className="text-[11px] font-extrabold uppercase"
            style={{
              letterSpacing: '0.15em',
              color: highlight ? '#F9A826' : '#94a3b8',
            }}
          >
            {label}
          </span>
        </div>
        <div className="flex flex-col -space-y-1 text-slate-200">
          <ChevronUp size={14} strokeWidth={2} />
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      {/* Bottom: big value */}
      <div>
        <p
          className="text-3xl font-black tracking-tighter tabular-nums leading-none"
          style={{ color: highlight ? '#F9A826' : '#0E1111' }}
        >
          {value}
        </p>
        {unit && (
          <span
            className="text-[10px] font-bold uppercase mt-1 block"
            style={{ color: highlight ? 'rgba(249, 168, 38, 0.6)' : '#cbd5e1' }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── SecondaryField ────────────────────────────────────────── */

function SecondaryField({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-center h-[40px] rounded-[14px] bg-[#F2F6F3]">
      <span className="text-[13px] font-semibold text-[#0E1111]">
        {value}
      </span>
    </div>
  )
}
