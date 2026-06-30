/**
 * BestemmingModal — Shows zoning designation details for a parcel
 *
 * Explains what the bestemming means for development potential,
 * and shows building metrics when available.
 */

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Home,
  Building2,
  Store,
  TreePine,
  Factory,
  Landmark,
  Layers,
  Ruler,
  ArrowUpFromLine,
  Percent,
  Ratio,
} from 'lucide-react'

/* ── Bestemming type metadata ────────────────────────────────── */

interface BestemmingTypeMeta {
  icon: typeof Home
  color: string
  description: string
}

const TYPE_META: Record<string, BestemmingTypeMeta> = {
  wonen: {
    icon: Home,
    color: '#F59E0B',
    description:
      'Dit perceel heeft een woonbestemming. Woningbouw en bijbehorende voorzieningen zijn hier toegestaan. Herbestemming naar andere functies vereist een bestemmingsplanwijziging.',
  },
  bedrijven: {
    icon: Factory,
    color: '#8B5CF6',
    description:
      'Dit perceel is bestemd voor bedrijvigheid. Afhankelijk van de milieucategorie zijn lichte tot zware bedrijfsactiviteiten toegestaan. Woningbouw is doorgaans niet toegestaan.',
  },
  centrum: {
    icon: Landmark,
    color: '#EC4899',
    description:
      'Centrumbestemming staat een mix van functies toe: winkels, horeca, dienstverlening en vaak ook wonen op de bovenverdiepingen. Flexibel voor herontwikkeling.',
  },
  detailhandel: {
    icon: Store,
    color: '#F97316',
    description:
      'Bestemd voor detailhandel en winkels. Afhankelijk van het bestemmingsplan kunnen aanvullende functies zoals wonen boven winkels zijn toegestaan.',
  },
  groen: {
    icon: TreePine,
    color: '#22C55E',
    description:
      'Groenbestemming is bedoeld voor parken, plantsoenen en openbaar groen. Bebouwing is zeer beperkt toegestaan. Herbestemming is complex maar biedt kansen bij transformatiegebieden.',
  },
  maatschappelijk: {
    icon: Building2,
    color: '#0EA5E9',
    description:
      'Maatschappelijke bestemming is bedoeld voor scholen, zorginstellingen, kerken en andere publieke voorzieningen. Transformatie naar wonen is vaak kansrijk bij leegstand.',
  },
  gemengd: {
    icon: Layers,
    color: '#6366F1',
    description:
      'Gemengde bestemming staat meerdere functies toe, zoals wonen, werken en voorzieningen. Dit biedt de meeste flexibiliteit voor ontwikkeling.',
  },
  kantoor: {
    icon: Building2,
    color: '#64748B',
    description:
      'Kantoorbestemming staat kantoorgebouwen en zakelijke dienstverlening toe. Bij leegstand is transformatie naar wonen een veelvoorkomende herbestemming.',
  },
  horeca: {
    icon: Store,
    color: '#F43F5E',
    description:
      'Horecabestemming is bedoeld voor restaurants, cafés en hotels. De categorie bepaalt welke horecatypen zijn toegestaan.',
  },
}

const FALLBACK_META: BestemmingTypeMeta = {
  icon: Layers,
  color: '#94a3b8',
  description:
    'De exacte bestemmingsregels zijn afhankelijk van het lokale bestemmingsplan. Raadpleeg ruimtelijkeplannen.nl voor de volledige voorschriften.',
}

function getTypeMeta(type: string): BestemmingTypeMeta {
  const lower = type.toLowerCase()
  for (const [key, meta] of Object.entries(TYPE_META)) {
    if (lower.includes(key)) return meta
  }
  return FALLBACK_META
}

/* ── Bestemming interface ────────────────────────────────────── */

interface Bestemming {
  type?: string | null
  naam?: string | null
  max_bebouwingspercentage?: number | null
  max_floor_area_ratio?: number | null
  max_bouwhoogte?: number | null
  max_bouwlagen?: number | null
}

/* ── Props ────────────────────────────────────────────────────── */

interface BestemmingModalProps {
  bestemmingen: Record<string, unknown>[] | null
  address: string | null
  onClose: () => void
}

/* ── Reduced motion ──────────────────────────────────────────── */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── Component ────────────────────────────────────────────────── */

export function BestemmingModal({ bestemmingen, address, onClose }: BestemmingModalProps) {
  const items = (bestemmingen ?? []) as Bestemming[]

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="bestemming-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[calc(100vh-80px)] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────── */}
          <div className="flex items-start justify-between px-8 pt-7 pb-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                  Bestemming
                </h2>
                <div className="flex items-center gap-1.5 rounded-full bg-[#F2F6F3] px-2.5 py-1">
                  <span className="text-[10px] font-semibold text-[#6B7280]">
                    {items.length} {items.length === 1 ? 'bestemming' : 'bestemmingen'}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[13px] text-[#6B7280]">
                {address ?? 'Bestemmingsplan voor dit perceel'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[#0E1111] transition-colors ml-4 mt-0.5"
              aria-label="Sluiten"
            ><X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* ── Content (scrollable) ────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Layers size={32} strokeWidth={1.5} className="text-[#cbd5e1]" />
                <p className="mt-4 text-[13px] text-[#6B7280]">
                  Geen bestemmingsgegevens beschikbaar voor dit perceel.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((b, i) => (
                  <BestemmingCard key={`${b.naam ?? b.type ?? i}`} bestemming={b} />
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────── */}
          <div className="shrink-0 px-8 pb-6 pt-3 border-t border-[#EAEFEF]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#94a3b8]">
                Bron: PDOK Planologische Registratie (PLU WMS)
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* ── BestemmingCard ───────────────────────────────────────────── */

function BestemmingCard({ bestemming }: { bestemming: Bestemming }) {
  const type = bestemming.type ?? 'Onbekend'
  const meta = getTypeMeta(type)
  const Icon = meta.icon

  const hasMetrics =
    bestemming.max_bebouwingspercentage != null ||
    bestemming.max_floor_area_ratio != null ||
    bestemming.max_bouwhoogte != null ||
    bestemming.max_bouwlagen != null

  return (
    <div className="rounded-[16px] bg-[#F2F6F3] p-5 transition-colors hover:bg-[#ECF1ED]">
      {/* Type header */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-0.5"
          style={{ background: `${meta.color}15` }}
        >
          <Icon size={18} strokeWidth={1.5} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#0E1111] leading-snug">
            {bestemming.naam ?? type}
          </p>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 mt-1 text-[10px] font-semibold"
            style={{ background: `${meta.color}15`, color: meta.color }}
          >
            {type}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 text-[13px] text-[#4B5563] leading-relaxed">
        {meta.description}
      </p>

      {/* Building metrics */}
      {hasMetrics && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {bestemming.max_bebouwingspercentage != null && (
            <MetricPill
              icon={<Percent size={13} strokeWidth={2} />}
              label="Bebouwing"
              value={`${bestemming.max_bebouwingspercentage}%`}
            />
          )}
          {bestemming.max_floor_area_ratio != null && (
            <MetricPill
              icon={<Ratio size={13} strokeWidth={2} />}
              label="FAR"
              value={`${bestemming.max_floor_area_ratio}`}
            />
          )}
          {bestemming.max_bouwhoogte != null && (
            <MetricPill
              icon={<ArrowUpFromLine size={13} strokeWidth={2} />}
              label="Bouwhoogte"
              value={`${bestemming.max_bouwhoogte}m`}
            />
          )}
          {bestemming.max_bouwlagen != null && (
            <MetricPill
              icon={<Ruler size={13} strokeWidth={2} />}
              label="Bouwlagen"
              value={`${bestemming.max_bouwlagen}`}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ── MetricPill ──────────────────────────────────────────────── */

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-white px-3 py-2">
      <span className="text-[#94a3b8]">{icon}</span>
      <span className="text-[11px] text-[#94a3b8]">{label}</span>
      <span className="ml-auto text-[13px] font-bold text-[#0E1111]">{value}</span>
    </div>
  )
}
