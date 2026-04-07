/**
 * Enriched Jurisprudentie detail for the configuratie source-detail view.
 *
 * Fetches the rulings feed for the active gemeente and renders:
 *  - win/loss summary bar (toegewezen / afgewezen / gedeeltelijk / onbekend)
 *  - scrollable list of the 10 most recent rulings with uitkomst badges
 *  - link to the full jurisprudentie explorer
 */

import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import {
  getGemeenteRulingsFeed,
  type GemeenteRulingsFeedItem,
  type WinLossRatio,
} from '@/lib/api'

/* ─── Uitkomst helpers (mirrored from RulingCard) ────────────── */

function uitkomstStyle(uitkomst: string | null): string {
  switch (uitkomst) {
    case 'toegewezen':
      return 'bg-emerald-500/15 text-emerald-600'
    case 'afgewezen':
      return 'bg-red-500/15 text-red-600'
    case 'gedeeltelijk':
      return 'bg-amber-500/15 text-amber-600'
    default:
      return 'bg-slate-100 text-slate-500'
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

/* ─── Lightweight state helpers (inline equiv of configuratie helpers) ── */

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

/* ─── Win / Loss summary bar ─────────────────────────────────── */

const WIN_LOSS_SEGMENTS: {
  key: keyof Omit<WinLossRatio, 'total'>
  label: string
  dot: string
  text: string
}[] = [
  { key: 'toegewezen', label: 'Toegewezen', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  { key: 'afgewezen', label: 'Afgewezen', dot: 'bg-red-500', text: 'text-red-600' },
  { key: 'gedeeltelijk', label: 'Gedeeltelijk', dot: 'bg-amber-500', text: 'text-amber-600' },
  { key: 'onbekend', label: 'Onbekend', dot: 'bg-slate-400', text: 'text-slate-500' },
]

function WinLossSummary({ data }: { data: WinLossRatio }) {
  const total = data.total || 1 // avoid division by zero

  return (
    <div className="space-y-3 rounded-[16px] border border-[#EAEFEF] bg-white p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Win / loss verdeling</p>

      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {WIN_LOSS_SEGMENTS.map(({ key, dot }) => {
          const pct = (data[key] / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={key}
              className={`${dot} transition-all`}
              style={{ width: `${pct}%` }}
            />
          )
        })}
      </div>

      {/* Legend pills */}
      <div className="flex flex-wrap gap-3">
        {WIN_LOSS_SEGMENTS.map(({ key, label, dot, text }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${dot}`} />
            <span className={`text-[12px] font-semibold ${text}`}>
              {data[key]} {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Ruling list item ───────────────────────────────────────── */

function RulingListItem({ ruling }: { ruling: GemeenteRulingsFeedItem }) {
  const formattedDate = ruling.datum_uitspraak
    ? dateFmt.format(new Date(ruling.datum_uitspraak))
    : null

  return (
    <div className="flex items-start gap-3 border-b border-[#EAEFEF] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#0E1111]">{ruling.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {formattedDate && <span>{formattedDate}</span>}
          {ruling.vergunningstype && (
            <>
              <span className="text-slate-300">·</span>
              <span>{ruling.vergunningstype}</span>
            </>
          )}
        </div>
      </div>
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${uitkomstStyle(ruling.uitkomst)}`}
      >
        {uitkomstLabel(ruling.uitkomst)}
      </span>
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

  const {
    data,
    isLoading,
    error,
  } = useQuery({
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
    <div className="space-y-5">
      {/* Win/loss summary */}
      <WinLossSummary data={data.win_loss} />

      {/* Recent rulings */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Recente uitspraken
        </p>
        <div className="max-h-[400px] overflow-y-auto">
          {recentRulings.map((ruling) => (
            <RulingListItem key={ruling.ecli} ruling={ruling} />
          ))}
        </div>
      </div>

      {/* Link to full explorer */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <a
          href="/jurisprudentie"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
        >
          Bekijk volledige jurisprudentie-analyse
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  )
}
