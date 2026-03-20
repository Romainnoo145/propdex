import { ExternalLink, FileText, Loader2, Banknote, ScrollText } from 'lucide-react'
import { useRaadsinformatie, type RaadsstukResponse } from '@/hooks/useRaadsinformatie'
import { useSubsidies, type SubsidieResponse } from '@/hooks/useSubsidies'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'

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
        <FileText size={14} strokeWidth={1.5} className="text-slate-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h4
            className="text-[13px] font-semibold text-[#0E1111] leading-snug line-clamp-2"
            title={stuk.titel}
          >
            {stuk.titel}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            {stuk.datum && (
              <span className="text-[11px] text-slate-400 tabular-nums">{formatDate(stuk.datum)}</span>
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

function SubsidieCard({ subsidie }: { subsidie: SubsidieResponse }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <Banknote size={14} strokeWidth={1.5} className="text-emerald-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-semibold text-[#0E1111] leading-snug line-clamp-2">
            {subsidie.title}
          </h4>
          {subsidie.intro && (
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
              {subsidie.intro}
            </p>
          )}
          {subsidie.url && (
            <a
              href={subsidie.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 mt-1.5 transition-colors"
            >
              Meer info
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Bestuurlijk tab — raadsinformatie + subsidies.
 * Shows development-relevant council documents and national subsidies.
 */
export function BestuurlijkTab({ gemeenteNaam }: BestuurlijkTabProps) {
  const { data: raadsData, isLoading: raadsLoading } = useRaadsinformatie(gemeenteNaam)
  const { data: subsidieData, isLoading: subsidieLoading } = useSubsidies()
  const { data: hvvData, isLoading: hvvLoading } = useHuisvestingsverordening(gemeenteNaam)

  return (
    <div className="px-8 pt-5 pb-6">
      {/* ── Raadsinformatie section ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: '0.15em', color: '#f59e0b' }}
          >
            Raadsinformatie
          </span>
          {raadsData && raadsData.dekking && (
            <span className="text-[10px] text-slate-400">
              {raadsData.total_found} stuk{raadsData.total_found !== 1 ? 'ken' : ''}
            </span>
          )}
        </div>

        {raadsLoading && (
          <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[12px]">Raadsinformatie ophalen...</span>
          </div>
        )}

        {!raadsLoading && raadsData && raadsData.dekking && raadsData.stukken.length > 0 && (
          <div className="max-h-[240px] overflow-y-auto">
            {raadsData.stukken.slice(0, 5).map((stuk) => (
              <RaadsstukCard key={stuk.doc_id} stuk={stuk} />
            ))}
          </div>
        )}

        {!raadsLoading && raadsData && (!raadsData.dekking || raadsData.stukken.length === 0) && (
          <p className="text-[12px] text-slate-400 py-2">
            {raadsData.dekking ? 'Geen relevante stukken gevonden.' : 'Niet beschikbaar voor deze gemeente.'}
          </p>
        )}
      </div>

      {/* ── Huisvestingsverordening section ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: '0.15em', color: '#8b5cf6' }}
          >
            Huisvestingsverordening
          </span>
        </div>

        {hvvLoading && (
          <div className="flex items-center gap-2 py-3 justify-center text-slate-400">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[12px]">Verordening zoeken...</span>
          </div>
        )}

        {!hvvLoading && hvvData && hvvData.heeft_verordening && (
          <div className="flex items-start gap-2.5 py-2">
            <ScrollText size={14} strokeWidth={1.5} className="text-violet-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-semibold text-[#0E1111] leading-snug">
                {hvvData.title}
              </h4>
              {hvvData.modified && (
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {formatDate(hvvData.modified)}
                </span>
              )}
              {hvvData.url && (
                <a
                  href={hvvData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-700 mt-1 transition-colors"
                >
                  Bekijk verordening
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        )}

        {!hvvLoading && hvvData && !hvvData.heeft_verordening && (
          <p className="text-[12px] text-slate-400 py-2">
            Geen huisvestingsverordening gevonden voor {gemeenteNaam}.
          </p>
        )}
      </div>

      {/* ── Subsidies section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: '0.15em', color: '#22c55e' }}
          >
            Subsidies
          </span>
          {subsidieData && (
            <span className="text-[10px] text-slate-400">
              {subsidieData.total} regeling{subsidieData.total !== 1 ? 'en' : ''}
            </span>
          )}
        </div>

        {subsidieLoading && (
          <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[12px]">Subsidies ophalen...</span>
          </div>
        )}

        {!subsidieLoading && subsidieData && subsidieData.subsidies.length > 0 && (
          <div className="max-h-[240px] overflow-y-auto">
            {subsidieData.subsidies.slice(0, 8).map((s) => (
              <SubsidieCard key={s.id} subsidie={s} />
            ))}
          </div>
        )}

        {!subsidieLoading && subsidieData && subsidieData.subsidies.length === 0 && (
          <p className="text-[12px] text-slate-400 py-2">Geen relevante subsidies gevonden.</p>
        )}
      </div>

      {/* Source attribution */}
      <div className="mt-4 pt-2 border-t border-slate-50">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: Open Raadsinformatie (VNG) · RVO
        </span>
      </div>
    </div>
  )
}
