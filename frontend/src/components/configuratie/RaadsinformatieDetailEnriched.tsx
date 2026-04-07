/**
 * Enriched Raadsinformatie detail for the configuratie source-detail view.
 *
 * Fetches raadsinformatie and renders:
 *  - metric card with total count + dekking indicator
 *  - type summary pills (neutral bg-slate-100)
 *  - search filter when > 5 stukken
 *  - scrollable list of stukken with type pills and external links
 *
 * Design contract follows JurisprudentieDetailEnriched / BekendmakingenDetailEnriched.
 */
import { useState, useMemo } from 'react'
import { useRaadsinformatie, type RaadsstukResponse } from '@/hooks/useRaadsinformatie'
import { ExternalLink, Search, Loader2 } from 'lucide-react'

interface Props {
  gemeenteNaam: string | null
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return dateFmt.format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

/* ─── Lightweight state helpers ──────────────────────────────── */

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

/* ─── Metric card ────────────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-4 text-center">
      <p className="text-[24px] font-bold text-[#0E1111]">{value ?? '—'}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

/* ─── Stuk list item ─────────────────────────────────────────── */

function StukItem({ stuk }: { stuk: RaadsstukResponse }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#EAEFEF] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#0E1111]">{stuk.titel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {stuk.datum && <span>{formatDate(stuk.datum)}</span>}
          {stuk.type && (
            <>
              <span className="text-slate-300">·</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {stuk.type}
              </span>
            </>
          )}
        </div>
        {stuk.samenvatting && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400 line-clamp-2">{stuk.samenvatting}</p>
        )}
      </div>
      {stuk.bron_url && (
        <a
          href={stuk.bron_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex-shrink-0 text-slate-400 hover:text-[#B07D18] transition-colors"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export function RaadsinformatieDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useRaadsinformatie(gemeenteNaam)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredStukken = useMemo(() => {
    if (!data?.stukken) return []
    if (!searchQuery.trim()) return data.stukken
    const q = searchQuery.trim().toLowerCase()
    return data.stukken.filter(
      (s) =>
        s.titel.toLowerCase().includes(q) ||
        (s.samenvatting && s.samenvatting.toLowerCase().includes(q)) ||
        (s.type && s.type.toLowerCase().includes(q)),
    )
  }, [data?.stukken, searchQuery])

  if (!gemeenteNaam) return <DetailEmpty message="Selecteer een gemeente." />
  if (isLoading) return <DetailLoading />
  if (error) return <DetailError error={error as Error} />
  if (!data || data.stukken.length === 0) return <DetailEmpty message="Geen raadsstukken gevonden." />

  // Type counts for summary pills
  const typeCounts: Record<string, number> = {}
  for (const stuk of data.stukken) {
    const t = stuk.type || 'Overig'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }
  const sortedTypes = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-5">
      {/* Summary: count + dekking */}
      <div className="flex items-center gap-4">
        <MetricCard label="Gevonden stukken" value={data.total_found} />
        <div className="flex items-center gap-2 rounded-full border border-[#EAEFEF] px-3 py-1.5">
          <span className={`size-2 rounded-full ${data.dekking ? 'bg-[#F9A826]' : 'bg-slate-300'}`} />
          <span className="text-[12px] font-semibold text-slate-500">
            {data.dekking ? 'Goede dekking' : 'Beperkte dekking'}
          </span>
        </div>
      </div>

      {/* Type pills — neutral, same pattern as category_label in BekendmakingenDetailEnriched */}
      {sortedTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedTypes.map(([type, count]) => (
            <span
              key={type}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500"
            >
              {type} ({count})
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      {data.stukken.length > 5 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek in raadsstukken..."
            className="w-full rounded-[12px] border border-[#EAEFEF] bg-white py-2.5 pl-9 pr-4 text-[13px] text-[#0E1111] placeholder:text-slate-300 outline-none focus:border-slate-300 transition-colors"
          />
        </div>
      )}

      {/* Stukken feed — same list pattern as JurisprudentieDetailEnriched */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          {searchQuery ? `Resultaten (${filteredStukken.length})` : 'Raadsstukken'}
        </p>
        {filteredStukken.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            {filteredStukken.map((stuk) => (
              <StukItem key={stuk.doc_id} stuk={stuk} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-slate-400">Geen resultaten voor deze zoekopdracht.</p>
        )}
      </div>
    </div>
  )
}
