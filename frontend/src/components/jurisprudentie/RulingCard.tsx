import { useState } from 'react'
import { Clock, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { getJurisprudenceDoc } from '@/lib/api'
import type { ExplorerRuling } from '@/hooks/useExplorer'
import type { ExplorerFilters } from '@/lib/api'

/** Dutch display labels for rechtsgrond keys */
const RECHTSGROND_LABELS: Record<string, string> = {
  procedurefout: 'Procedurefout',
  motiveringsgebrek: 'Motiveringsgebrek',
  gelijkheidsbeginsel: 'Gelijkheidsbeginsel',
  disproportioneel: 'Disproportioneel',
  etfal_ruimtelijke_ordening: 'ETFAL / Ruimtelijke ordening',
}

function uitkomstStyle(uitkomst: string | null): string {
  switch (uitkomst) {
    case 'toegewezen':
      return 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25'
    case 'afgewezen':
      return 'bg-red-500/15 text-red-600 hover:bg-red-500/25'
    case 'gedeeltelijk':
      return 'bg-aura-amber/15 text-aura-amber hover:bg-aura-amber/25'
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

interface RulingCardProps {
  ruling: ExplorerRuling
  onFilterChange?: (dimension: keyof ExplorerFilters, value: string) => void
}

export default function RulingCard({ ruling, onFilterChange }: RulingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [fullText, setFullText] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const { accessToken } = useAuth()

  const aiAnalysis = ruling.ai_analysis as {
    bezwaargrond?: string
    relevantie?: string
    uitkomst?: string
    tegenstanders?: string[]
  } | null

  const summaryText = aiAnalysis?.bezwaargrond ?? ruling.summary ?? null
  const relevantieText = aiAnalysis?.relevantie ?? null
  const tegenstanders = aiAnalysis?.tegenstanders ?? []

  const datumFormatted = ruling.datum_uitspraak
    ? dateFmt.format(new Date(ruling.datum_uitspraak))
    : null

  const handleCardClick = async () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)

    if (newExpanded && fullText === null && !loadingText) {
      setLoadingText(true)
      try {
        const res = await getJurisprudenceDoc(ruling.ecli, accessToken)
        setFullText(res.document.text)
      } catch {
        setFullText('Kon uitspraaktekst niet laden.')
      } finally {
        setLoadingText(false)
      }
    }
  }

  /** Pill click → set filter, stop event from toggling card */
  const pill = (
    dimension: keyof ExplorerFilters,
    value: string | null,
    label: string,
    className: string,
  ) => {
    if (!value) return null
    const clickable = !!onFilterChange
    return (
      <button
        key={`${dimension}-${value}`}
        type="button"
        disabled={!clickable}
        onClick={clickable ? (e) => { e.stopPropagation(); onFilterChange(dimension, value) } : undefined}
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${className} ${clickable ? 'cursor-pointer' : ''}`}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      onClick={handleCardClick}
      className="rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-6 py-5 transition-all hover:shadow-md cursor-pointer select-none"
    >
      {/* Header: Instantie left, datum right */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {(ruling.instantie || ruling.extracted_gemeente) && (
            <p className="text-[14px] font-semibold text-aura-obsidian">
              {ruling.instantie}{ruling.extracted_gemeente ? ` — ${ruling.extracted_gemeente}` : ''}
            </p>
          )}
          <p className="mt-1 text-[10px] text-slate-500 tracking-wide">{ruling.ecli}</p>
        </div>
        {datumFormatted && (
          <span className="rounded-full bg-aura-glass-white/60 px-3 py-1 text-[11px] font-semibold tabular-nums text-aura-obsidian border border-neutral-200 shrink-0">
            {datumFormatted}
          </span>
        )}
      </div>

      {/* Filter pills */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pill('uitkomst', ruling.uitkomst, uitkomstLabel(ruling.uitkomst), uitkomstStyle(ruling.uitkomst))}

        {pill('vergunningstype', ruling.vergunningstype, ruling.vergunningstype ?? '', 'bg-aura-amber/10 text-aura-amber hover:bg-aura-amber/20')}

        {ruling.doorlooptijd_dagen != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-aura-canvas px-2.5 py-0.5 text-[11px] text-slate-500 tabular-nums">
            <Clock size={10} />
            {ruling.doorlooptijd_dagen}d
          </span>
        )}

        {ruling.rechtsgronden.map((rg) =>
          pill('rechtsgrond', rg, RECHTSGROND_LABELS[rg] ?? rg, 'bg-slate-50 text-slate-400 font-medium hover:bg-slate-100 hover:text-slate-600')
        )}
      </div>

      {/* Summary (collapsed only) */}
      {summaryText && !expanded && (
        <p className="mt-4 line-clamp-2 text-[13px] leading-[1.7] text-slate-500">
          {summaryText}
        </p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-6 space-y-6 border-t border-neutral-200 pt-6">
          {summaryText && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-aura-obsidian mb-2">
                Samenvatting
              </p>
              <p className="text-[13px] leading-[1.8] text-slate-600">{summaryText}</p>
            </div>
          )}

          {relevantieText && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-aura-obsidian mb-2">
                Relevantie
              </p>
              <p className="text-[13px] leading-[1.8] text-slate-600">{relevantieText}</p>
            </div>
          )}

          {/* Tegenstanders */}
          {tegenstanders.length > 0 && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-aura-obsidian mb-2">
                Tegenstanders
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tegenstanders.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-aura-canvas px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Full text */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-aura-obsidian">
                Uitspraaktekst
              </p>
              <a
                href={`https://uitspraken.rechtspraak.nl/details?id=${ruling.ecli}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] font-medium text-aura-amber transition-colors hover:text-aura-amber/80"
              >
                Rechtspraak.nl <ExternalLink size={10} />
              </a>
            </div>
            {loadingText && (
              <div className="flex items-center gap-2 py-6 text-[13px] text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Uitspraak laden...
              </div>
            )}
            {fullText && (
              <div className="max-h-[500px] overflow-y-auto rounded-[14px] bg-aura-canvas p-6">
                <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-aura-obsidian/80">
                  {fullText}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
