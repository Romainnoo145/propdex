/**
 * S5 Potentie & Risico Analyse — Due Diligence Dashboard section 5
 *
 * Score hero with three rings + per-factor breakdown tables (shared
 * ScoreAnalyseOverview), plus report-only section notes.
 */

import { Lightbulb } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes } from '../components'
import { ScoreAnalyseOverview } from './ScoreAnalyseOverview'
import { parseScores, parseFactors } from './scoreAnalyse'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S5PotentieRisicoAnalyseProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Section ────────────────────────────────────────────────── */

export function S5PotentieRisicoAnalyse({ data, sourceParcelId }: S5PotentieRisicoAnalyseProps) {
  const scores = parseScores(data.scores_v3)
  const allFactors = parseFactors(data.score_breakdown_v3)

  if (!scores && allFactors.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-[13px] font-semibold text-[#0E1111]">Score analyse niet beschikbaar</p>
          <p className="mt-2 text-[12px] text-slate-400 max-w-sm mx-auto">
            Genereer een nieuw rapport vanuit een perceelscan voor scores met per-factor breakdown.
          </p>
        </div>
        <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
          <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['quickscan']} />
        </SectionInsightCard>
      </div>
    )
  }

  const potentieFactors = allFactors
    .filter((f) => f.categorie === 'potentie')
    .sort((a, b) => (b.bijdrage ?? 0) - (a.bijdrage ?? 0))

  const risicoFactors = allFactors
    .filter((f) => f.categorie === 'risico')
    .sort((a, b) => (b.bijdrage ?? 0) - (a.bijdrage ?? 0))

  return (
    <div className="space-y-6">
      <ScoreAnalyseOverview
        scores={scores}
        potentieFactors={potentieFactors}
        risicoFactors={risicoFactors}
      />
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['quickscan']} />
      </SectionInsightCard>
    </div>
  )
}
