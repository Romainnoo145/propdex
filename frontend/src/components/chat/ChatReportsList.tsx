/**
 * ChatReportsList — inline reports list for MY_REPORTS intent.
 * Shows key metrics (potentie, risico, bouwjaar, oppervlakte) when available.
 */

import { FileText, TrendingUp, ShieldAlert, Calendar, Maximize2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { ReportSummary } from '@/hooks/useChat'

interface Props {
  reports: ReportSummary[]
  count: number
  message?: string
}

function RiskBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null
  const cls = level === 'hoog'
    ? 'border-red-200 bg-red-50 text-red-700'
    : level === 'middel'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-green-200 bg-green-50 text-green-700'
  return (
    <span className={`rounded-full border px-1.5 py-0 text-[9px] font-medium ${cls}`}>
      {level}
    </span>
  )
}

export function ChatReportsList({ reports, count, message }: Props) {
  const navigate = useNavigate()

  if (reports.length === 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[13px] text-slate-400">
          <FileText size={16} />
          <span>{message || 'Geen rapporten gevonden.'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {message && (
        <p className="text-[13px] text-slate-600">{message}</p>
      )}
      <p className="text-[13px] font-semibold text-aura-obsidian">
        {count} {count === 1 ? 'rapport' : 'rapporten'}
      </p>
      <div className="space-y-1">
        {reports.slice(0, 15).map((r) => (
          <button
            key={r.id}
            onClick={() => navigate({ to: '/rapport/$id', params: { id: r.id } })}
            className="w-full flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left hover:bg-aura-canvas transition-colors"
          >
            <FileText size={14} className="text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-aura-obsidian truncate">{r.report_name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {r.potentie != null && (
                  <span className="flex items-center gap-1 text-[10px] text-green-700">
                    <TrendingUp size={10} />
                    {Math.round(r.potentie)}
                  </span>
                )}
                {r.risico != null && (
                  <span className="flex items-center gap-1 text-[10px] text-red-600">
                    <ShieldAlert size={10} />
                    {Math.round(r.risico)}
                  </span>
                )}
                {r.bouwjaar && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Calendar size={10} />
                    {r.bouwjaar}
                  </span>
                )}
                {r.oppervlakte && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Maximize2 size={10} />
                    {r.oppervlakte}m²
                  </span>
                )}
                {r.bestemming && (
                  <span className="text-[10px] text-slate-400">{r.bestemming}</span>
                )}
                <RiskBadge level={r.fysiek_risk} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
