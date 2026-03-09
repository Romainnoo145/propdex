import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { getJurisprudenceDoc } from '@/lib/api'
import type { ExplorerRuling } from '@/hooks/useExplorer'

/** Dutch display labels for rechtsgrond keys */
const RECHTSGROND_LABELS: Record<string, string> = {
  procedurefout: 'Procedurefout',
  motiveringsgebrek: 'Motiveringsgebrek',
  gelijkheidsbeginsel: 'Gelijkheidsbeginsel',
  disproportioneel: 'Disproportioneel',
  etfal_ruimtelijke_ordening: 'ETFAL / Ruimtelijke ordening',
}

/** Color mapping for uitkomst values — amber palette only */
function uitkomstColor(uitkomst: string | null): string {
  switch (uitkomst) {
    case 'toegewezen':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
    case 'afgewezen':
      return 'bg-red-500/15 text-red-400 border-red-500/25'
    case 'gedeeltelijk':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/25'
    default:
      return 'bg-grey-700/30 text-grey-400 border-grey-600/25'
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
}

export default function RulingCard({ ruling }: RulingCardProps) {
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

  const handleExpand = async () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)

    // Lazy-load full ruling text on first expand
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

  return (
    <div
      className="rounded-lg border border-grey-800 bg-grey-900 p-4 transition-colors hover:border-grey-700"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-mono text-grey-400">{ruling.ecli}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-grey-400">
            {ruling.instantie && <span>{ruling.instantie}</span>}
            {ruling.instantie && datumFormatted && (
              <span className="text-grey-600">|</span>
            )}
            {datumFormatted && <span>{datumFormatted}</span>}
          </div>
        </div>
        <button
          onClick={handleExpand}
          className="shrink-0 rounded p-1 text-grey-400 transition-colors hover:bg-grey-800 hover:text-grey-100"
          aria-label={expanded ? 'Inklappen' : 'Uitklappen'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Badges row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {ruling.extracted_gemeente && (
          <span className="inline-flex items-center rounded-full border border-grey-600/25 bg-grey-700/30 px-2 py-0.5 text-xs text-grey-300">
            {ruling.extracted_gemeente}
          </span>
        )}
        {ruling.vergunningstype && (
          <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
            {ruling.vergunningstype}
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${uitkomstColor(ruling.uitkomst)}`}
        >
          {uitkomstLabel(ruling.uitkomst)}
        </span>
        {ruling.doorlooptijd_dagen != null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-grey-600/25 bg-grey-700/30 px-2 py-0.5 text-xs text-grey-400">
            <Clock size={10} />
            {ruling.doorlooptijd_dagen}d
          </span>
        )}
      </div>

      {/* Tegenstanders badges */}
      {tegenstanders.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tegenstanders.map((t) => (
            <span
              key={t}
              className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Rechtsgrond tags */}
      {ruling.rechtsgronden.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ruling.rechtsgronden.map((rg) => (
            <span
              key={rg}
              className="rounded border border-grey-700/50 bg-grey-800/50 px-1.5 py-0.5 text-[10px] text-grey-400"
            >
              {RECHTSGROND_LABELS[rg] ?? rg}
            </span>
          ))}
        </div>
      )}

      {/* Summary preview (collapsed) */}
      {summaryText && !expanded && (
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-grey-300">
          {summaryText}
        </p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-grey-800 pt-3">
          {summaryText && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-grey-400">
                Samenvatting
              </h4>
              <p className="text-sm leading-relaxed text-grey-300">{summaryText}</p>
            </div>
          )}
          {relevantieText && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-grey-400">
                Relevantie
              </h4>
              <p className="text-sm leading-relaxed text-grey-300">{relevantieText}</p>
            </div>
          )}

          {/* Full ruling text */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase tracking-wider text-grey-400">
                Uitspraaktekst
              </h4>
              <a
                href={`https://uitspraken.rechtspraak.nl/details?id=${ruling.ecli}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-amber-400/70 transition-colors hover:text-amber-300"
              >
                Rechtspraak.nl <ExternalLink size={10} />
              </a>
            </div>
            {loadingText && (
              <div className="flex items-center gap-2 py-4 text-sm text-grey-500">
                <Loader2 size={14} className="animate-spin" />
                Uitspraak laden...
              </div>
            )}
            {fullText && (
              <div className="max-h-96 overflow-y-auto rounded border border-grey-800 bg-grey-950 p-3">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-grey-300">
                  {fullText}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
