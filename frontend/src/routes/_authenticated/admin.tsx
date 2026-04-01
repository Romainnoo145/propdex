import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import { useEffect, useState } from 'react'
import { ShieldAlert, Loader2 } from 'lucide-react'

interface CostByDay {
  date: string
  total_cost: number
  total_calls: number
}

interface CostByCallSite {
  call_site: string
  total_cost: number
  total_calls: number
}

interface CostByUser {
  email: string | null
  total_cost: number
  total_calls: number
}

interface AiUsageSummary {
  cost_by_day: CostByDay[]
  cost_by_call_site: CostByCallSite[]
  cost_by_user: CostByUser[]
}

// ── Prompt improvement types ────────────────────────────────────────

interface PromptSuggestion {
  category: string
  description: string
  current_weakness: string
  suggested_improvement: string
}

interface ImprovePromptsResult {
  suggestions: PromptSuggestion[]
  analyzed_count: number
  prompt_analyzed: string
}

// ── DeepEval evaluation types ───────────────────────────────────────

interface EvalConversationResult {
  conversation_id: string
  status: string
  eval_pass: boolean
  scores: {
    conversation_completeness?: number
    turn_relevancy?: number
    role_adherence?: number
  }
  reason?: string
}

interface EvalRunResult {
  total: number
  passed: number
  failed: number
  errors: number
  results: EvalConversationResult[]
}

interface EvalResultEntry {
  id: string
  started_at: string | null
  last_message_at: string | null
  message_count: number
  eval_scores: Record<string, number> | null
  eval_pass: boolean | null
  eval_at: string | null
}

export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminDashboardPage,
})

function AdminDashboardPage() {
  const { user, accessToken } = useAuth()
  const [data, setData] = useState<AiUsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── DeepEval state ──────────────────────────────────────────────────
  const [evalResults, setEvalResults] = useState<EvalResultEntry[]>([])
  const [evalRunning, setEvalRunning] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [lastRunResult, setLastRunResult] = useState<EvalRunResult | null>(null)

  // ── Prompt improvement state ──────────────────────────────────────
  const [improveRunning, setImproveRunning] = useState(false)
  const [improveError, setImproveError] = useState<string | null>(null)
  const [improveResult, setImproveResult] = useState<ImprovePromptsResult | null>(null)

  useEffect(() => {
    if (!user?.is_superuser) {
      setLoading(false)
      setError('Geen toegang — alleen voor administrators.')
      return
    }

    let cancelled = false

    async function fetchSummary() {
      try {
        const result = await apiFetch<AiUsageSummary>('/api/admin/ai-usage/summary', {
          method: 'GET',
          accessToken,
        })
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kon AI-gebruiksdata niet ophalen.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSummary()
    return () => { cancelled = true }
  }, [user, accessToken])

  // ── Fetch previous eval results on mount (superuser only) ─────────
  useEffect(() => {
    if (!user?.is_superuser) return
    let cancelled = false

    async function fetchEvalResults() {
      try {
        const results = await apiFetch<EvalResultEntry[]>('/api/admin/eval-results', {
          method: 'GET',
          accessToken,
        })
        if (!cancelled) setEvalResults(results)
      } catch {
        // Non-critical — silently ignore
      }
    }

    fetchEvalResults()
    return () => { cancelled = true }
  }, [user, accessToken])

  async function handleEvalChats() {
    setEvalRunning(true)
    setEvalError(null)
    try {
      const result = await apiFetch<EvalRunResult>('/api/admin/eval-chats', {
        method: 'POST',
        accessToken,
      })
      setLastRunResult(result)
      // Refresh previous results
      const updated = await apiFetch<EvalResultEntry[]>('/api/admin/eval-results', {
        method: 'GET',
        accessToken,
      })
      setEvalResults(updated)
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluatie mislukt.')
    } finally {
      setEvalRunning(false)
    }
  }

  async function handleImprovePrompts() {
    setImproveRunning(true)
    setImproveError(null)
    try {
      const result = await apiFetch<ImprovePromptsResult>('/api/admin/improve-prompts', {
        method: 'POST',
        accessToken,
      })
      setImproveResult(result)
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : 'Prompt verbetering mislukt.')
    } finally {
      setImproveRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-neutral-500">Laden…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <ShieldAlert size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-red-700">{error ?? 'Geen data beschikbaar.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-aura-ink mb-8">AI Kosten Dashboard</h1>

      <BarChartSection
        title="Kosten per dag"
        items={data.cost_by_day.map((d) => ({
          label: d.date,
          cost: d.total_cost,
          calls: d.total_calls,
        }))}
      />

      <BarChartSection
        title="Kosten per call site"
        items={data.cost_by_call_site.map((d) => ({
          label: d.call_site,
          cost: d.total_cost,
          calls: d.total_calls,
        }))}
      />

      <BarChartSection
        title="Kosten per gebruiker"
        items={data.cost_by_user.map((d) => ({
          label: d.email ?? 'Onbekend',
          cost: d.total_cost,
          calls: d.total_calls,
        }))}
      />

      {/* ── Chat Evaluatie Section ────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-aura-ink mb-4">Chat Evaluatie</h2>

        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleEvalChats}
            disabled={evalRunning}
            className="inline-flex items-center gap-2 rounded-md bg-aura-amber px-4 py-2 text-sm font-medium text-aura-ink transition-colors hover:bg-aura-amber/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {evalRunning && <Loader2 size={16} className="animate-spin" />}
            {evalRunning ? 'Evalueren…' : 'Evalueer Chats'}
          </button>

          {lastRunResult && (
            <span className="text-sm text-neutral-600">
              {lastRunResult.passed} van {lastRunResult.total} gesprekken geslaagd
            </span>
          )}
        </div>

        {evalError && (
          <p className="text-sm text-red-600 mb-4">{evalError}</p>
        )}

        {evalResults.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
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
                {evalResults.map((entry) => {
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
        ) : (
          <p className="text-sm text-neutral-400">
            Nog geen evaluatieresultaten. Klik op 'Evalueer Chats' om te starten.
          </p>
        )}
      </section>

      {/* ── Prompt Verbetering Section ────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-aura-ink mb-4">Prompt Verbetering</h2>

        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleImprovePrompts}
            disabled={improveRunning}
            className="inline-flex items-center gap-2 rounded-md bg-aura-amber px-4 py-2 text-sm font-medium text-aura-ink transition-colors hover:bg-aura-amber/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {improveRunning && <Loader2 size={16} className="animate-spin" />}
            {improveRunning ? 'Analyseren…' : 'Verbeter Prompts'}
          </button>

          {improveResult && (
            <span className="text-sm text-neutral-600">
              {improveResult.analyzed_count} gesprekken geanalyseerd
            </span>
          )}
        </div>

        {improveError && (
          <p className="text-sm text-red-600 mb-4">{improveError}</p>
        )}

        {improveResult && improveResult.suggestions.length > 0 ? (
          <div className="space-y-3">
            {improveResult.suggestions.map((s, i) => (
              <div key={i} className="rounded-lg bg-neutral-100 p-4">
                <p className="font-semibold text-aura-ink mb-1">{s.category}</p>
                <p className="text-sm text-neutral-700 mb-2">{s.description}</p>
                <div className="mb-2">
                  <p className="text-xs font-medium text-neutral-500">Huidige zwakte</p>
                  <p className="text-sm text-neutral-700">{s.current_weakness}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Voorgestelde verbetering</p>
                  <p className="text-sm text-neutral-700">{s.suggested_improvement}</p>
                </div>
              </div>
            ))}
          </div>
        ) : !improveResult ? (
          <p className="text-sm text-neutral-400">
            Nog geen verbeteringen. Klik op &apos;Verbeter Prompts&apos; om te starten.
          </p>
        ) : null}
      </section>
    </div>
  )
}

function formatScore(value: number | undefined): string {
  if (value === undefined || value === null) return '—'
  return `${Math.round(value * 100)}%`
}

interface BarChartItem {
  label: string
  cost: number
  calls: number
}

function BarChartSection({ title, items }: { title: string; items: BarChartItem[] }) {
  if (items.length === 0) {
    return (
      <section className="mb-10">
        <h2 className="text-lg font-medium text-aura-ink mb-4">{title}</h2>
        <p className="text-sm text-neutral-400">Geen data.</p>
      </section>
    )
  }

  const maxCost = Math.max(...items.map((i) => i.cost), 0.001)

  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium text-aura-ink mb-4">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const widthPct = Math.max((item.cost / maxCost) * 100, 2)
          return (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm text-aura-ink" title={item.label}>
                {item.label}
              </span>
              <div className="flex-1 h-7 bg-neutral-100 rounded overflow-hidden">
                <div
                  className="h-full bg-aura-amber rounded flex items-center px-2 transition-all duration-300"
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="text-xs font-medium text-aura-ink whitespace-nowrap">
                    €{item.cost.toFixed(2)}
                  </span>
                </div>
              </div>
              <span className="text-xs text-neutral-500 w-16 text-right shrink-0">
                {item.calls} calls
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
