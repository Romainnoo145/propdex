/**
 * Enriched Jurisprudentie detail for the configuratie source-detail view.
 *
 * Follows CONFIGURATIE-DESIGN-CONTRACT.md strictly:
 * - SectionInsightCard wrappers
 * - TimelineRow-style list items (contract §6)
 * - SemanticPill for uitkomst (contract §5)
 * - space-y-6 top-level with Plus Jakarta font
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, Scale, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import {
  getGemeenteRulingsFeed,
  type GemeenteRulingsFeedItem,
  type WinLossRatio,
} from '@/lib/api'
import { SectionInsightCard } from '@/components/reports/components/SectionInsightCard'

/* ─── Uitkomst helpers ──────────────────────────────────────── */

function uitkomstStyle(uitkomst: string | null): string {
  switch (uitkomst) {
    case 'toegewezen':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'afgewezen':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'gedeeltelijk':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function uitkomstLabel(uitkomst: string | null): string {
  switch (uitkomst) {
    case 'toegewezen':
      return 'Toegewezen'
    case 'afgewezen':
      return 'Afgewezen'
    case 'gedeeltelijk':
      return 'Gedeeltelijk'
    default:
      return 'Onbekend'
  }
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/* ─── State helpers (contract §10) ────────────────────────────── */

function DetailLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-12">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-[13px] text-slate-400">Data laden…</span>
    </div>
  )
}

function DetailEmpty({ message }: { message?: string }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-slate-400">{message ?? 'Geen data beschikbaar.'}</p>
    </div>
  )
}

function DetailError({ error }: { error: Error | null }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-red-400">{error?.message ?? 'Er is een fout opgetreden.'}</p>
    </div>
  )
}

/* ─── Win / Loss distribution bar (contract §9) ──────────────── */

const WIN_LOSS_SEGMENTS: {
  key: keyof Omit<WinLossRatio, 'total'>
  label: string
  bg: string
  color: string
}[] = [
  { key: 'toegewezen', label: 'Toegewezen', bg: 'bg-emerald-500', color: 'text-emerald-700' },
  { key: 'afgewezen', label: 'Afgewezen', bg: 'bg-red-500', color: 'text-red-700' },
  { key: 'gedeeltelijk', label: 'Gedeeltelijk', bg: 'bg-amber-500', color: 'text-amber-700' },
  { key: 'onbekend', label: 'Onbekend', bg: 'bg-slate-400', color: 'text-slate-600' },
]

function WinLossSummary({ data }: { data: WinLossRatio }) {
  const total = data.total || 1

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {WIN_LOSS_SEGMENTS.map(({ key, bg }, i) => {
          const pct = (data[key] / total) * 100
          if (pct === 0) return null
          return (
            <motion.div
              key={key}
              className={bg}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {WIN_LOSS_SEGMENTS.map(({ key, label, bg, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${bg}`} />
            <span className={`text-[11px] font-semibold ${color}`}>
              {data[key]} {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Ruling list item (contract §6: TimelineRow) ─────────────── */

function RulingListItem({ ruling, idx, total }: { ruling: GemeenteRulingsFeedItem; idx: number; total: number }) {
  const formattedDate = ruling.datum_uitspraak ? dateFmt.format(new Date(ruling.datum_uitspraak)) : null

  return (
    <div className="flex gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
      <div className="flex flex-col items-center pt-1.5">
        <span className="h-2 w-2 rounded-full bg-aura-amber shrink-0" />
        {idx < total - 1 && <span className="w-px flex-1 bg-[#EAEFEF] mt-1" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2">
          {ruling.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {formattedDate && <span>{formattedDate}</span>}
          {ruling.vergunningstype && (
            <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
              {ruling.vergunningstype}
            </span>
          )}
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${uitkomstStyle(ruling.uitkomst)}`}
          >
            {uitkomstLabel(ruling.uitkomst)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export default function JurisprudentieDetailEnriched({
  gemeenteNaam,
}: {
  gemeenteNaam: string | null
}) {
  const { accessToken } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['gemeente-rulings-feed', gemeenteNaam],
    queryFn: () => getGemeenteRulingsFeed(gemeenteNaam!, accessToken),
    enabled: !!gemeenteNaam,
  })

  if (!gemeenteNaam) return <DetailEmpty message="Selecteer een gemeente." />
  if (isLoading) return <DetailLoading />
  if (error) return <DetailError error={error as Error} />
  if (!data || data.rulings.length === 0) return <DetailEmpty message="Geen uitspraken gevonden." />

  const recentRulings = data.rulings.slice(0, 10)

  return (
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Win/loss summary */}
      <SectionInsightCard kicker="Uitkomsten" title="Win / loss verdeling" Icon={Scale}>
        <WinLossSummary data={data.win_loss} />
      </SectionInsightCard>

      {/* Recent rulings */}
      <SectionInsightCard
        kicker="Uitspraken"
        title={`Recente uitspraken (${recentRulings.length})`}
        Icon={Scale}
      >
        <div className="max-h-[400px] overflow-y-auto">
          {recentRulings.map((ruling, idx) => (
            <RulingListItem key={ruling.ecli} ruling={ruling} idx={idx} total={recentRulings.length} />
          ))}
        </div>
      </SectionInsightCard>

      {/* Link to full explorer */}
      <SectionInsightCard kicker="Meer" title="Volledige jurisprudentie" Icon={ExternalLink}>
        <a
          href="/jurisprudentie"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
        >
          Bekijk volledige jurisprudentie-analyse
          <ArrowRight size={14} />
        </a>
      </SectionInsightCard>
    </div>
  )
}
