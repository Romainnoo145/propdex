/**
 * Enriched Raadsinformatie detail for the configuratie source-detail view.
 *
 * Reuses shared report components: SectionInsightCard, SubCard, StatCell.
 */
import { useState, useMemo } from 'react'
import { useRaadsinformatie, type RaadsstukResponse } from '@/hooks/useRaadsinformatie'
import { FileText, ExternalLink, Search, Loader2 } from 'lucide-react'
import { SectionInsightCard, SubCard, StatCell } from '@/components/reports/components'

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

function DetailLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-12">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-[13px] text-slate-400">Data laden…</span>
    </div>
  )
}

/* ─── Stuk list item — same structure as RulingListItem ──────── */

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

  if (!gemeenteNaam || isLoading) return <DetailLoading />
  if (error || !data) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
        <p className="text-[13px] text-slate-400">{error ? 'Fout bij laden.' : 'Geen data beschikbaar.'}</p>
      </div>
    )
  }

  if (data.stukken.length === 0) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
        <p className="text-[13px] text-slate-400">Geen raadsstukken gevonden.</p>
      </div>
    )
  }

  // Type counts
  const typeCounts: Record<string, number> = {}
  for (const stuk of data.stukken) {
    const t = stuk.type || 'Overig'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }
  const sortedTypes = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-5">
      {/* Main card — reuses SectionInsightCard */}
      <SectionInsightCard
        kicker="Raadsinformatie"
        title={`${data.total_found} stukken`}
        Icon={FileText}
        badge={data.dekking ? 'Goede dekking' : 'Beperkte dekking'}
      >
        {/* Type summary — StatCells in a grid */}
        {sortedTypes.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {sortedTypes.slice(0, 3).map(([type, count]) => (
              <StatCell key={type} label={type} value={count} />
            ))}
          </div>
        )}

        {/* Remaining types as pills */}
        {sortedTypes.length > 3 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {sortedTypes.slice(3).map(([type, count]) => (
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
          <div className="relative mb-4">
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

        {/* Stukken feed */}
        {filteredStukken.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            {filteredStukken.map((stuk) => (
              <StukItem key={stuk.doc_id} stuk={stuk} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-slate-400">Geen resultaten voor deze zoekopdracht.</p>
        )}
      </SectionInsightCard>
    </div>
  )
}
