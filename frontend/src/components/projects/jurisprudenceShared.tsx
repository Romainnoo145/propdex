import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import type { AnalyzeGemeenteResponse, RulingAnalysis } from '@/lib/api'

export const OUTCOME_STYLES: Record<string, string> = {
  toegewezen: 'border border-aura-green/20 bg-aura-green/10 text-aura-green',
  afgewezen: 'border border-aura-red/20 bg-aura-red/10 text-aura-red',
  gedeeltelijk: 'border border-aura-amber/20 bg-aura-amber/10 text-aura-amber-dark',
  onbekend: 'border border-neutral-200 bg-neutral-50 text-neutral-600',
}

export const DISCLAIMER_TEXT =
  'Indicatief - gebaseerd op historische uitspraken, geen juridisch advies'

export function parseCourtFromTitle(ecli: string, title: string): string {
  const withoutEcli = title.replace(ecli, '').replace(/^,\s*/, '')
  const parts = withoutEcli.split(', ')
  return parts[0] ?? ''
}

export function formatDateLabel(dateValue: string | null | undefined): string {
  if (!dateValue) return 'Onbekende datum'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return dateValue
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatRulingTitle(ecli: string, title: string): string {
  return title.replace(ecli, '').replace(/^,\s*/, '')
}

export function GeoRelevanceBadge({ relevance }: { relevance: 'gemeente' | 'arrondissement' }) {
  const isGemeente = relevance === 'gemeente'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        isGemeente
          ? 'border-aura-amber/20 bg-aura-amber/10 text-aura-amber-dark'
          : 'border-neutral-200 bg-aura-glass-white/60 text-neutral-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isGemeente ? 'bg-aura-amber' : 'bg-neutral-400'
        }`}
      />
      {isGemeente ? 'Gemeente' : 'Arrondissement'}
    </span>
  )
}

export function RulingAiSummaryBadge({
  ecli,
  analysis,
}: {
  ecli: string
  analysis: AnalyzeGemeenteResponse | null
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (!analysis) return null

  const ruling: RulingAnalysis | undefined = analysis.ruling_analyses.find((r) => r.ecli === ecli)
  if (!ruling) return null

  return (
    <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/40">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((value) => !value)
        }}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-aura-amber" />
        <span className="text-sm font-medium text-aura-ink">AI samenvatting</span>
        {ruling.vergunningstype && ruling.vergunningstype !== 'overig' && (
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            {ruling.vergunningstype}
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 text-neutral-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-neutral-200 px-3 py-3">
          <div>
            <p className="text-label text-neutral-500">Bezwaargrond</p>
            <p className="mt-1 text-sm leading-6 text-neutral-700">{ruling.bezwaargrond}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-label text-neutral-500">Uitkomst</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLES[ruling.uitkomst] ?? OUTCOME_STYLES.onbekend}`}>
              {ruling.uitkomst}
            </span>
          </div>
          <div>
            <p className="text-label text-neutral-500">Relevantie</p>
            <p className="mt-1 text-sm leading-6 text-neutral-700">{ruling.relevantie}</p>
          </div>
          <p className="border-t border-neutral-200 pt-2 text-[10px] italic text-neutral-500">
            {DISCLAIMER_TEXT}
          </p>
        </div>
      )}
    </div>
  )
}
