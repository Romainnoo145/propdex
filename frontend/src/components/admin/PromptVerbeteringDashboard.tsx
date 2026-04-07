/**
 * PromptVerbeteringDashboard — Self-contained prompt improvement dashboard
 * using the design system (SectionInsightCard + KVRow).
 *
 * Replaces the inline Prompt Verbetering section from the admin route.
 * All state is managed via the React Query mutation hook — no prop drilling needed.
 */

import { Lightbulb, Loader2 } from 'lucide-react'
import { SectionInsightCard, KVRow } from '@/components/reports/components'
import {
  useImprovePrompts,
  type PromptSuggestion,
} from '@/hooks/useAdminPromptImprovement'

/* ─── Suggestion card ────────────────────────────────────────── */

function SuggestionCard({ suggestion }: { suggestion: PromptSuggestion }) {
  return (
    <div className="rounded-lg bg-neutral-100 p-4">
      <p className="font-semibold text-aura-ink mb-1">{suggestion.category}</p>
      <p className="text-sm text-neutral-700 mb-2">{suggestion.description}</p>
      <KVRow label="Huidige zwakte" value={suggestion.current_weakness} />
      <KVRow label="Voorgestelde verbetering" value={suggestion.suggested_improvement} />
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export function PromptVerbeteringDashboard() {
  const improvePrompts = useImprovePrompts()
  const result = improvePrompts.data

  return (
    <SectionInsightCard
      kicker="PROMPT ANALYSE"
      title="Prompt Verbetering"
      Icon={Lightbulb}
    >
      {/* Action bar */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => improvePrompts.mutate()}
          disabled={improvePrompts.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-aura-amber px-4 py-2 text-sm font-medium text-aura-ink transition-colors hover:bg-aura-amber/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {improvePrompts.isPending && <Loader2 size={16} className="animate-spin" />}
          {improvePrompts.isPending ? 'Analyseren…' : 'Verbeter Prompts'}
        </button>

        {result && (
          <span className="text-sm text-neutral-600">
            {result.analyzed_count} gesprekken geanalyseerd
          </span>
        )}
      </div>

      {/* Mutation error */}
      {improvePrompts.isError && (
        <p className="text-sm text-red-600 mb-4">
          {improvePrompts.error?.message ?? 'Prompt verbetering mislukt.'}
        </p>
      )}

      {/* Suggestion cards or empty state */}
      {result && result.suggestions.length > 0 ? (
        <div className="space-y-3">
          {result.suggestions.map((s, i) => (
            <SuggestionCard key={i} suggestion={s} />
          ))}
        </div>
      ) : !result ? (
        <p className="text-sm text-neutral-400">
          Nog geen verbeteringen. Klik op &apos;Verbeter Prompts&apos; om te starten.
        </p>
      ) : null}
    </SectionInsightCard>
  )
}
