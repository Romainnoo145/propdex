/**
 * ChatEvaluatieDashboard — Self-contained chat evaluation dashboard
 * using the design system (SectionInsightCard + KVRow).
 *
 * Replaces the inline Chat Evaluatie section from the admin route.
 * All state is managed via React Query hooks — no prop drilling needed.
 */

import { MessageSquare, Loader2, ShieldAlert } from 'lucide-react'
import { SectionInsightCard, KVRow } from '@/components/reports/components'
import {
  useAdminEvalResults,
  useEvalChats,
  type EvalResultEntry,
} from '@/hooks/useAdminEval'

/* ─── Helpers ────────────────────────────────────────────────── */

function formatScore(value: number | undefined): string {
  if (value === undefined || value === null) return '—'
  return `${Math.round(value * 100)}%`
}

/* ─── Eval results table ─────────────────────────────────────── */

function EvalResultsTable({ entries }: { entries: EvalResultEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-50 text-left">
            <th className="px-3 py-2 font-medium text-neutral-600">Datum</th>
            <th className="px-3 py-2 font-medium text-neutral-600">Berichten</th>
            <th className="px-3 py-2 font-medium text-neutral-600">Relevantie</th>
            <th className="px-3 py-2 font-medium text-neutral-600">Volledigheid</th>
            <th className="px-3 py-2 font-medium text-neutral-600">Rol</th>
            <th className="px-3 py-2 font-medium text-neutral-600">Resultaat</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const scores = entry.eval_scores ?? {}
            return (
              <tr key={entry.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 text-aura-ink">
                  {entry.started_at
                    ? new Date(entry.started_at).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-3 py-2 text-aura-ink">{entry.message_count}</td>
                <td className="px-3 py-2 text-aura-ink">
                  {formatScore(scores.turn_relevancy)}
                </td>
                <td className="px-3 py-2 text-aura-ink">
                  {formatScore(scores.conversation_completeness)}
                </td>
                <td className="px-3 py-2 text-aura-ink">
                  {formatScore(scores.role_adherence)}
                </td>
                <td className="px-3 py-2">
                  {entry.eval_pass ? (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Geslaagd
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Gefaald
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export function ChatEvaluatieDashboard() {
  const { data: evalResults, isLoading, isError, error } = useAdminEvalResults()
  const evalChats = useEvalChats()

  /* Loading */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[13px] text-slate-400">Laden…</p>
      </div>
    )
  }

  /* Error fetching results */
  if (isError) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <ShieldAlert size={28} className="mx-auto mb-3 text-red-400" />
        <p className="text-[13px] text-red-700">
          {error?.message ?? 'Kon evaluatieresultaten niet ophalen.'}
        </p>
      </div>
    )
  }

  const results = evalResults ?? []
  const lastRun = evalChats.data

  return (
    <SectionInsightCard
      kicker="EVALUATIE"
      title="Chat Evaluatie"
      Icon={MessageSquare}
    >
      {/* Action bar */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => evalChats.mutate()}
          disabled={evalChats.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-aura-amber px-4 py-2 text-sm font-medium text-aura-ink transition-colors hover:bg-aura-amber/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {evalChats.isPending && <Loader2 size={16} className="animate-spin" />}
          {evalChats.isPending ? 'Evalueren…' : 'Evalueer Chats'}
        </button>

        {lastRun && (
          <span className="text-sm text-neutral-600">
            {lastRun.passed} van {lastRun.total} gesprekken geslaagd
          </span>
        )}
      </div>

      {/* Last-run summary */}
      {lastRun && (
        <div className="mb-4">
          <KVRow label="Geslaagd" value={`${lastRun.passed} / ${lastRun.total}`} />
          {lastRun.errors > 0 && (
            <KVRow label="Fouten" value={String(lastRun.errors)} />
          )}
        </div>
      )}

      {/* Mutation error */}
      {evalChats.isError && (
        <p className="text-sm text-red-600 mb-4">
          {evalChats.error?.message ?? 'Evaluatie mislukt.'}
        </p>
      )}

      {/* Results table or empty state */}
      {results.length > 0 ? (
        <EvalResultsTable entries={results} />
      ) : (
        <p className="text-sm text-neutral-400">
          Nog geen evaluatieresultaten. Klik op &apos;Evalueer Chats&apos; om te starten.
        </p>
      )}
    </SectionInsightCard>
  )
}
