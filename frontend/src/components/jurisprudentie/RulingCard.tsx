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
      return 'bg-neutral-300/30 text-neutral-600 border-neutral-300/25'
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
      className="rounded-lg border border-neutral-200 bg-aura-glass-white/60 p-4 transition-colors hover:border-neutral-300"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-mono text-neutral-600">{ruling.ecli}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            {ruling.instantie && <span>{ruling.instantie}</span>}
            {ruling.instantie && datumFormatted && (
              <span className="text-neutral-500">|</span>
            )}
            {datumFormatted && <span>{datumFormatted}</span>}
          </div>
        </div>
        <button
          onClick={handleExpand}
          className="shrink-0 rounded p-1 text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-aura-ink"
          aria-label={expanded ? 'Inklappen' : 'Uitklappen'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Badges row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {ruling.extracted_gemeente && (
          <span className="inline-flex items-center rounded-full border border-neutral-300/25 bg-neutral-300/30 px-2 py-0.5 text-xs text-neutral-700">
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
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300/25 bg-neutral-300/30 px-2 py-0.5 text-xs text-neutral-600">
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
              className="rounded border border-neutral-300/50 bg-neutral-200/50 px-1.5 py-0.5 text-[10px] text-neutral-600"
            >
              {RECHTSGROND_LABELS[rg] ?? rg}
            </span>
          ))}
        </div>
      )}

      {/* Summary preview (collapsed) */}
      {summaryText && !expanded && (
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-neutral-700">
          {summaryText}
        </p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3">
          {summaryText && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-600">
                Samenvatting
              </h4>
              <p className="text-sm leading-relaxed text-neutral-700">{summaryText}</p>
            </div>
          )}
          {relevantieText && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-600">
                Relevantie
              </h4>
              <p className="text-sm leading-relaxed text-neutral-700">{relevantieText}</p>
            </div>
          )}

          {/* Full ruling text */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase tracking-wider text-neutral-600">
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
              <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
                <Loader2 size={14} className="animate-spin" />
                Uitspraak laden...
              </div>
            )}
            {fullText && (
              <div className="max-h-96 overflow-y-auto rounded border border-neutral-200 bg-aura-canvas p-3">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">
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
