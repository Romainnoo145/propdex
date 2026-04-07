/**
 * AiKostenDashboard — AI cost overview using design system components.
 *
 * Replaces the three inline BarChartSection renders in the admin route
 * with SectionInsightCard + KVRow cards and a summary totals card.
 * Horizontal amber bars preserve the visual weight of the old chart.
 */

import { ShieldAlert, Calendar, Code, Users, Coins } from 'lucide-react'
import { SectionInsightCard, KVRow } from '@/components/reports/components'
import {
  useAdminAiUsage,
  type CostByDay,
  type CostByCallSite,
  type CostByUser,
} from '@/hooks/useAdminAiUsage'

/* ─── Helpers ────────────────────────────────────────────────── */

function fmt(cost: number): string {
  return `€${cost.toFixed(2)}`
}

/**
 * Inline proportional bar — keeps the visual weight of the old BarChartSection.
 * Renders a label, an amber bar proportional to `value / max`, and a trailing stat.
 */
function CostBar({
  label,
  cost,
  calls,
  max,
}: {
  label: string
  cost: number
  calls: number
  max: number
}) {
  const pct = max > 0 ? Math.max((cost / max) * 100, 2) : 2

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#EAEFEF] last:border-b-0">
      <span
        className="w-36 shrink-0 truncate text-[12px] text-slate-400"
        title={label}
      >
        {label}
      </span>
      <div className="flex-1 h-6 bg-[#F8FAFA] rounded-lg overflow-hidden">
        <div
          className="h-full bg-aura-amber/80 rounded-lg flex items-center px-2 transition-all duration-300"
          style={{ width: `${pct}%` }}
        >
          <span className="text-[11px] font-semibold text-[#0E1111] whitespace-nowrap">
            {fmt(cost)}
          </span>
        </div>
      </div>
      <span className="text-[11px] text-slate-400 w-16 text-right shrink-0 tabular-nums">
        {calls} calls
      </span>
    </div>
  )
}

/* ─── Detail card renderers ──────────────────────────────────── */

function DayCard({ items }: { items: CostByDay[] }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((d) => d.total_cost), 0.001)

  return (
    <SectionInsightCard kicker="PER DAG" title="Kosten per dag" Icon={Calendar}>
      {items.map((d) => (
        <CostBar
          key={d.date}
          label={d.date}
          cost={d.total_cost}
          calls={d.total_calls}
          max={max}
        />
      ))}
    </SectionInsightCard>
  )
}

function CallSiteCard({ items }: { items: CostByCallSite[] }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((d) => d.total_cost), 0.001)

  return (
    <SectionInsightCard kicker="PER CALL SITE" title="Kosten per call site" Icon={Code}>
      {items.map((d) => (
        <CostBar
          key={d.call_site}
          label={d.call_site}
          cost={d.total_cost}
          calls={d.total_calls}
          max={max}
        />
      ))}
    </SectionInsightCard>
  )
}

function UserCard({ items }: { items: CostByUser[] }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((d) => d.total_cost), 0.001)

  return (
    <SectionInsightCard kicker="PER GEBRUIKER" title="Kosten per gebruiker" Icon={Users}>
      {items.map((d, i) => (
        <CostBar
          key={d.email ?? `unknown-${i}`}
          label={d.email ?? 'Onbekend'}
          cost={d.total_cost}
          calls={d.total_calls}
          max={max}
        />
      ))}
    </SectionInsightCard>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export function AiKostenDashboard() {
  const { data, isLoading, isError, error } = useAdminAiUsage()

  /* Loading */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[13px] text-slate-400">Laden…</p>
      </div>
    )
  }

  /* Error */
  if (isError) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <ShieldAlert size={28} className="mx-auto mb-3 text-red-400" />
        <p className="text-[13px] text-red-700">
          {error?.message ?? 'Kon AI-gebruiksdata niet ophalen.'}
        </p>
      </div>
    )
  }

  /* Empty */
  if (!data) {
    return (
      <p className="text-[13px] text-slate-400 py-8 text-center">Geen data.</p>
    )
  }

  /* Compute summary totals from cost_by_day (canonical daily aggregation) */
  const totalCost = data.cost_by_day.reduce((sum, d) => sum + d.total_cost, 0)
  const totalCalls = data.cost_by_day.reduce((sum, d) => sum + d.total_calls, 0)

  return (
    <div className="space-y-4">
      {/* ── Summary card ─────────────────────────────────────── */}
      <SectionInsightCard
        kicker="OVERZICHT"
        title="Totale AI Kosten"
        Icon={Coins}
        badge={fmt(totalCost)}
      >
        <KVRow label="Totale calls" value={String(totalCalls)} />
        <KVRow label="Periode" value="Laatste 30 dagen" />
      </SectionInsightCard>

      {/* ── Detail cards ─────────────────────────────────────── */}
      <DayCard items={data.cost_by_day} />
      <CallSiteCard items={data.cost_by_call_site} />
      <UserCard items={data.cost_by_user} />
    </div>
  )
}
