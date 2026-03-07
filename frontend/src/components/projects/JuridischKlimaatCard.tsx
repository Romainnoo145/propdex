import { Scale, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/feedback/Skeleton'
import type { JuridischAnalysisResult } from '@/lib/api'

interface JuridischKlimaatCardProps {
  analysis: JuridischAnalysisResult | null
  isLoading: boolean
}

const DISCLAIMER_FALLBACK =
  'Indicatief — gebaseerd op historische uitspraken, geen juridisch advies'

/**
 * Score card showing aggregated juridisch klimaat score,
 * vergunnings-succeskans percentage, risk summary, and top risk factors.
 */
export function JuridischKlimaatCard({ analysis, isLoading }: JuridischKlimaatCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-overlay/5 bg-grey-900 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-accent/70 animate-pulse" />
          <span className="text-xs font-medium text-amber-accent/70">Analyseren...</span>
        </div>
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    )
  }

  if (!analysis) return null

  const scoreColor =
    analysis.juridisch_klimaat_score >= 70
      ? 'text-emerald-400'
      : analysis.juridisch_klimaat_score >= 40
        ? 'text-amber-accent'
        : 'text-red-400'

  const succesBarColor =
    analysis.vergunnings_succeskans >= 70
      ? 'bg-emerald-500'
      : analysis.vergunnings_succeskans >= 40
        ? 'bg-amber-accent'
        : 'bg-red-500'

  return (
    <div className="rounded-xl border border-overlay/5 bg-grey-900 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-amber-accent/70" />
        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
          Juridisch Klimaat
        </span>
        <span className="ml-auto text-[10px] text-grey-500">
          {analysis.gemeente_naam}
        </span>
      </div>

      {/* Score */}
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>
          {analysis.juridisch_klimaat_score}
        </span>
        <span className="text-sm text-grey-500">/100</span>
      </div>

      {/* Vergunnings-succeskans progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-grey-400">Vergunnings-succeskans</span>
          <span className="font-medium text-grey-200">
            {analysis.vergunnings_succeskans}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-grey-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${succesBarColor}`}
            style={{ width: `${analysis.vergunnings_succeskans}%` }}
          />
        </div>
      </div>

      {/* Risk summary */}
      <p className="text-sm text-grey-300 leading-relaxed">
        {analysis.risico_samenvatting}
      </p>

      {/* Top risk factors */}
      {analysis.top_risico_factoren.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-grey-400">
            <AlertTriangle className="w-3 h-3" />
            <span>Risicofactoren</span>
          </div>
          <ul className="space-y-1 pl-4">
            {analysis.top_risico_factoren.map((factor, i) => (
              <li key={i} className="text-xs text-grey-400 list-disc">
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer (mandatory) */}
      <p className="text-[10px] italic text-grey-600 pt-1 border-t border-overlay/5">
        {analysis.disclaimer || DISCLAIMER_FALLBACK}
      </p>
    </div>
  )
}
