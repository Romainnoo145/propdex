import { useState } from 'react'
import { Maximize2, Layers, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScanResultItem } from '@/lib/types/scan'
import { ParcelHero } from './ParcelHero'
import { ScoreGauge } from './ScoreGauge'
import { BouwjaarTimeline } from './BouwjaarTimeline'

export type CategoryKey = 'potentie' | 'risico' | 'juridisch'

interface ParcelBentoOverviewProps {
  parcel: ScanResultItem
  onSelectCategory: (cat: CategoryKey) => void
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

function scoreCategory(cat: string | null): {
  label: string
  color: string
} {
  switch (cat) {
    case 'High':
      return { label: 'High potential', color: 'bg-aura-green/10 text-aura-green' }
    case 'Medium':
      return { label: 'Medium', color: 'bg-amber-100 text-amber-700' }
    case 'Low':
      return { label: 'Low', color: 'bg-slate-100 text-slate-600' }
    default:
      return { label: 'Onbekend', color: 'bg-slate-100 text-slate-400' }
  }
}

/* ── Bento Grid card types ─────────────────────────────────── */

type BentoCard = 'aerial' | 'bestemming' | 'score'


/* ── Section title ─────────────────────────────────────────── */

const sectionTitle =
  'text-[10px] uppercase text-slate-400 tracking-widest font-medium mb-3'

/* ── Pod tint helpers ──────────────────────────────────────── */

const POD_TINTS = [
  'bg-[#D1E2D8]/15 border-[#D1E2D8]/30',
  'bg-[#F9A826]/8 border-[#F9A826]/20',
  'bg-white/50 border-slate-100',
] as const

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
}: ParcelBentoOverviewProps) {
  const [activeCard, setActiveCard] = useState<BentoCard>('aerial')
  const category = deriveBestemmingCategory(parcel.bestemmingen)
  const bm = parcel.building_metrics
  const actualBouwlagen = bm?.actual_bouwlagen
  const maxBouwlagen = bm?.max_bouwlagen
  const bouwlagenDisplay =
    actualBouwlagen != null && maxBouwlagen != null
      ? `${actualBouwlagen}/${maxBouwlagen}`
      : actualBouwlagen != null
        ? `${actualBouwlagen}`
        : maxBouwlagen != null
          ? `—/${maxBouwlagen}`
          : '—'
  const sc = scoreCategory(parcel.score_category)

  return (
    <div className="px-8 pb-8">
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

      {/* ── Kenmerken ────────────────────────────────── */}
      <div className="mt-8">
        <h3 className={sectionTitle}>Kenmerken</h3>
        <div className="grid grid-cols-3 gap-3">
          <KenmerkenPod
            icon={<Maximize2 size={18} strokeWidth={1.5} />}
            value={parcel.area_m2 != null ? `${Math.round(parcel.area_m2)}` : '—'}
            unit={parcel.area_m2 != null ? ' m²' : ''}
            label="Oppervlakte"
            tint={POD_TINTS[0]}
          />
          <KenmerkenPod
            icon={<Layers size={18} strokeWidth={1.5} />}
            value={bouwlagenDisplay}
            label="Bouwlagen"
            tint={POD_TINTS[1]}
          />
          <KenmerkenPod
            icon={<Home size={18} strokeWidth={1.5} />}
            value={formatPandStatus(parcel.pand_status)}
            label="Status"
            small
            tint={POD_TINTS[2]}
          />
        </div>
      </div>

      {/* ── Quick Tags ───────────────────────────────── */}
      <div className="mt-6 flex flex-wrap gap-2">
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-medium',
            parcel.has_pand
              ? 'bg-aura-green/10 text-aura-green'
              : 'bg-slate-100 text-slate-600',
          )}
        >
          {parcel.has_pand ? 'Bebouwd' : 'Leeg perceel'}
        </span>
        {parcel.vacancy_signal && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium text-amber-700">
            {parcel.vacancy_signal}
          </span>
        )}
        <span
          className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium', sc.color)}
        >
          {sc.label}
        </span>
      </div>

      {/* ── Trust Metadata ───────────────────────────── */}
      <div className="mt-6 flex items-center justify-between">
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

/* ── KenmerkenPod ──────────────────────────────────────────── */

function KenmerkenPod({
  icon,
  value,
  unit,
  label,
  small,
  tint,
}: {
  icon: React.ReactNode
  value: string
  unit?: string
  label: string
  small?: boolean
  tint: string
}) {
  return (
    <div className={cn('rounded-[16px] border p-4', tint)}>
      <div className="text-slate-300">{icon}</div>
      <p
        className={cn(
          'mt-3 font-bold tabular-nums text-slate-900',
          small ? 'text-sm' : 'text-xl',
        )}
      >
        {value}
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  )
}
