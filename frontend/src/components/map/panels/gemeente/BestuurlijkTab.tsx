import { ExternalLink, FileText, Loader2 } from 'lucide-react'
import { useRaadsinformatie, type RaadsstukResponse } from '@/hooks/useRaadsinformatie'

interface BestuurlijkTabProps {
  gemeenteNaam: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function RaadsstukCard({ stuk }: { stuk: RaadsstukResponse }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <FileText
          size={14}
          strokeWidth={1.5}
          className="text-slate-400 mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h4
            className="text-[13px] font-semibold text-[#0E1111] leading-snug line-clamp-2"
            title={stuk.titel}
          >
            {stuk.titel}
          </h4>

          <div className="flex items-center gap-2 mt-1">
            {stuk.datum && (
              <span className="text-[11px] text-slate-400 tabular-nums">
                {formatDate(stuk.datum)}
              </span>
            )}
            {stuk.type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                {stuk.type}
              </span>
            )}
          </div>

          {stuk.samenvatting && (
            <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed line-clamp-3">
              {stuk.samenvatting}
            </p>
          )}

          {stuk.bron_url && (
            <a
              href={stuk.bron_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 mt-1.5 transition-colors"
            >
              Bekijk document
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Bestuurlijk tab — raadsinformatie from Open Raadsinformatie.
 * Shows development-relevant council documents for the gemeente.
 */
export function BestuurlijkTab({ gemeenteNaam }: BestuurlijkTabProps) {
  const { data, isLoading, error } = useRaadsinformatie(gemeenteNaam)

  return (
    <div className="px-8 pt-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-extrabold uppercase"
          style={{ letterSpacing: '0.15em', color: '#f59e0b' }}
        >
          Raadsinformatie
        </span>
        {data && data.dekking && (
          <span className="text-[10px] text-slate-400">
            {data.total_found} stuk{data.total_found !== 1 ? 'ken' : ''}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[12px]">Raadsinformatie ophalen...</span>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="py-6 text-center">
          <p className="text-[12px] text-slate-400">
            Kon raadsinformatie niet laden.
          </p>
        </div>
      )}

      {/* No coverage */}
      {data && !data.dekking && !isLoading && (
        <div className="py-6 text-center">
          <p className="text-[12px] text-slate-400">
            Niet beschikbaar voor deze gemeente.
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Open Raadsinformatie heeft geen data voor {gemeenteNaam}.
          </p>
        </div>
      )}

      {/* Empty results */}
      {data && data.dekking && data.stukken.length === 0 && !isLoading && (
        <div className="py-6 text-center">
          <p className="text-[12px] text-slate-400">
            Geen relevante stukken gevonden.
          </p>
        </div>
      )}

      {/* Results */}
      {data && data.dekking && data.stukken.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto">
          {data.stukken.map((stuk) => (
            <RaadsstukCard key={stuk.doc_id} stuk={stuk} />
          ))}
        </div>
      )}

      {/* Source attribution */}
      <div className="mt-4 pt-2 border-t border-slate-50">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: Open Raadsinformatie (VNG)
        </span>
      </div>
    </div>
  )
}
