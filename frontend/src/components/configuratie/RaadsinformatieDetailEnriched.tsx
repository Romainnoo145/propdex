/**
 * RaadsinformatieDetailEnriched — enriched detail view for raadsinformatie source.
 * Shows stukken count, dekking indicator, and scrollable feed with type pills.
 */
import { useState, useMemo } from 'react'
import { useRaadsinformatie, type RaadsinformatieResponse, type RaadsstukResponse } from '@/hooks/useRaadsinformatie'
import { FileText, ExternalLink, Search, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  gemeenteNaam: string | null
}

const TYPE_COLORS: Record<string, string> = {
  Agendapunt: 'bg-blue-100 text-blue-700',
  MediaObject: 'bg-slate-100 text-slate-600',
  Vergadering: 'bg-violet-100 text-violet-700',
  Motie: 'bg-amber-100 text-amber-700',
  Amendement: 'bg-orange-100 text-orange-700',
  Besluit: 'bg-emerald-100 text-emerald-700',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

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

  if (isLoading || !gemeenteNaam) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="text-[13px] text-slate-400">Raadsinformatie kon niet worden geladen.</p>
      </div>
    )
  }

  // Group by type for summary
  const typeCounts: Record<string, number> = {}
  for (const stuk of data.stukken) {
    const t = stuk.type || 'Overig'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }
  const sortedTypes = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
            <FileText size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-[20px] font-black text-[#0E1111]">{data.total_found} <span className="text-[14px] font-bold text-slate-400">gevonden stukken</span></p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-[#EAEFEF] px-3 py-1.5">
            {data.dekking ? (
              <CheckCircle2 size={14} className="text-emerald-500" />
            ) : (
              <XCircle size={14} className="text-slate-400" />
            )}
            <span className="text-[12px] font-semibold text-slate-500">
              {data.dekking ? 'Goede dekking' : 'Beperkte dekking'}
            </span>
          </div>
        </div>

        {/* Type pills */}
        {sortedTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sortedTypes.map(([type, count]) => (
              <span
                key={type}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-500'}`}
              >
                {type} ({count})
              </span>
            ))}
          </div>
        )}
      </div>

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

      {/* Stukken feed */}
      {filteredStukken.length > 0 ? (
        <div className="max-h-[520px] overflow-y-auto rounded-[16px] border border-[#EAEFEF] bg-white divide-y divide-[#EAEFEF]">
          {filteredStukken.map((stuk) => (
            <StukItem key={stuk.doc_id} stuk={stuk} />
          ))}
        </div>
      ) : (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] text-slate-400">
            {searchQuery ? 'Geen resultaten voor deze zoekopdracht.' : 'Geen raadsstukken gevonden.'}
          </p>
        </div>
      )}
    </div>
  )
}

function StukItem({ stuk }: { stuk: RaadsstukResponse }) {
  const typeClass = TYPE_COLORS[stuk.type || ''] ?? 'bg-slate-100 text-slate-500'

  return (
    <div className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#0E1111] leading-snug">{stuk.titel}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {stuk.datum && (
              <span className="text-[11px] text-slate-400 tabular-nums">{formatDate(stuk.datum)}</span>
            )}
            {stuk.type && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeClass}`}>
                {stuk.type}
              </span>
            )}
          </div>
          {stuk.samenvatting && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500 line-clamp-2">{stuk.samenvatting}</p>
          )}
        </div>
        {stuk.bron_url && (
          <a
            href={stuk.bron_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:text-[#0E1111] hover:bg-slate-100 transition-colors"
            title="Bekijk bron"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  )
}
