import { Scale, AlertTriangle, Clock } from 'lucide-react'
import { Skeleton } from '@/components/feedback/Skeleton'
import type { AnalyzeGemeenteResponse, DoorlooptijdStats } from '@/lib/api'

interface JuridischKlimaatCardProps {
  analysis: AnalyzeGemeenteResponse | null
  isLoading: boolean
  doorlooptijd?: Record<string, DoorlooptijdStats> | null
}

const DISCLAIMER_FALLBACK =
  'Indicatief -- gebaseerd op historische uitspraken, geen juridisch advies'

/**
 * Color class for doorlooptijd duration values.
 * Green: <= 180 days, Amber: 181-365, Red: > 365
 */
function doorlooptijdColor(avgDagen: number): string {
  if (avgDagen <= 180) return 'text-emerald-400'
  if (avgDagen <= 365) return 'text-amber-accent'
  return 'text-red-400'
}

/**
 * Score card showing aggregated juridisch klimaat score,
 * vergunnings-succeskans percentage, risk summary, top risk factors,
 * and doorlooptijd statistics per vergunningstype.
 */
export function JuridischKlimaatCard({ analysis, isLoading, doorlooptijd }: JuridischKlimaatCardProps) {
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

  // Compute risk summary + factors from ruling_analyses
  const riskFactors: string[] = []
  const afgewezen = analysis.ruling_analyses.filter(r => r.uitkomst === 'afgewezen')
  if (afgewezen.length > 0) {
    // Extract unique bezwaargronden as risk factors
    const seen = new Set<string>()
    for (const r of afgewezen) {
      if (!seen.has(r.bezwaargrond) && riskFactors.length < 5) {
        seen.add(r.bezwaargrond)
        riskFactors.push(r.bezwaargrond)
      }
    }
  }

  const doorlooptijdEntries = doorlooptijd ? Object.values(doorlooptijd) : []

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

      {/* Analysis progress */}
      {analysis.pending_count > 0 && (
        <p className="text-[10px] text-grey-500">
          {analysis.analyzed_count} van {analysis.total_count} uitspraken geanalyseerd
        </p>
      )}

      {/* Top risk factors */}
      {riskFactors.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-grey-400">
            <AlertTriangle className="w-3 h-3" />
            <span>Risicofactoren</span>
          </div>
          <ul className="space-y-1 pl-4">
            {riskFactors.map((factor, i) => (
              <li key={i} className="text-xs text-grey-400 list-disc">
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Doorlooptijd section */}
      <div className="space-y-1.5 pt-1 border-t border-overlay/5">
        <div className="flex items-center gap-1.5 text-xs text-grey-400">
          <Clock className="w-3 h-3" />
          <span>Gemiddelde Doorlooptijd</span>
        </div>

        {doorlooptijdEntries.length === 0 ? (
          <p className="text-[10px] text-grey-500 italic">
            {doorlooptijd === null || doorlooptijd === undefined
              ? 'Doorlooptijddata wordt berekend...'
              : 'Geen doorlooptijddata beschikbaar'}
          </p>
        ) : (
          <div className="space-y-1">
            {doorlooptijdEntries.map((stat) => (
              <div key={stat.vergunningstype} className="flex items-center justify-between text-xs">
                <span className="text-grey-400 truncate mr-2">
                  {stat.vergunningstype}
                </span>
                {stat.insufficient_data ? (
                  <span className="text-grey-600 text-[10px] whitespace-nowrap">
                    onvoldoende data ({stat.count} uitspraken)
                  </span>
                ) : (
                  <span className={`font-medium tabular-nums whitespace-nowrap ${doorlooptijdColor(stat.avg_dagen!)}`}>
                    {stat.avg_dagen} dagen
                    <span className="text-grey-600 font-normal ml-1">
                      ({stat.min_dagen}-{stat.max_dagen})
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer (mandatory) */}
      <p className="text-[10px] italic text-grey-600 pt-1 border-t border-overlay/5">
        {DISCLAIMER_FALLBACK}
      </p>
    </div>
  )
}
