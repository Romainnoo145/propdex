import { useState } from 'react'
import { Scale, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Skeleton } from '@/components/feedback/Skeleton'
import type { AnalyzeGemeenteResponse, DoorlooptijdStats } from '@/lib/api'

interface JuridischKlimaatCardProps {
  analysis: AnalyzeGemeenteResponse | null
  isLoading: boolean
  doorlooptijd?: Record<string, DoorlooptijdStats> | null
}

/**
 * Color class for doorlooptijd duration values.
 * Green: <= 180 days, Amber: 181-365, Red: > 365
 */
function doorlooptijdColor(avgDagen: number): string {
  if (avgDagen <= 180) return 'text-emerald-400'
  if (avgDagen <= 365) return 'text-amber-accent'
  return 'text-red-400'
}

function RiskFactorsCollapsible({ factors }: { factors: string[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-xs text-grey-400 hover:text-grey-300 transition-colors"
      >
        <AlertTriangle className="w-3 h-3" />
        <span>Risicofactoren</span>
        <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
          {factors.length}
        </span>
        {open ? (
          <ChevronUp className="w-3 h-3 ml-auto" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-auto" />
        )}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-4">
          {factors.map((factor, i) => (
            <li key={i} className="text-xs text-grey-400 list-disc">
              {factor}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
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

      {/* Top risk factors — collapsible */}
      {riskFactors.length > 0 && (
        <RiskFactorsCollapsible factors={riskFactors} />
      )}

      {/* Doorlooptijd section — only shown when meaningful data exists */}
      {doorlooptijdEntries.some(s => !s.insufficient_data) && (
        <div className="space-y-1.5 pt-1 border-t border-overlay/5">
          <div className="flex items-center gap-1.5 text-xs text-grey-400">
            <Clock className="w-3 h-3" />
            <span>Gemiddelde Doorlooptijd</span>
          </div>
          <div className="space-y-1">
            {doorlooptijdEntries.filter(s => !s.insufficient_data).map((stat) => (
              <div key={stat.vergunningstype} className="flex items-center justify-between text-xs">
                <span className="text-grey-400 truncate mr-2">
                  {stat.vergunningstype}
                </span>
                <span className={`font-medium tabular-nums whitespace-nowrap ${doorlooptijdColor(stat.avg_dagen!)}`}>
                  {stat.avg_dagen} dagen
                  <span className="text-grey-600 font-normal ml-1">
                    ({stat.min_dagen}-{stat.max_dagen})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
