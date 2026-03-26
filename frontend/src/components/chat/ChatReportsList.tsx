/**
 * ChatReportsList — inline reports list for MY_REPORTS intent.
 */

import { FileText } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { ReportSummary } from '@/hooks/useChat'

interface Props {
  reports: ReportSummary[]
  count: number
  message?: string
}

export function ChatReportsList({ reports, count, message }: Props) {
  const navigate = useNavigate()

  if (reports.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <FileText size={16} />
        <span>{message || 'Geen rapporten gevonden.'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-[#0E1111]">
        {count} {count === 1 ? 'rapport' : 'rapporten'}
      </p>
      <div className="space-y-1">
        {reports.slice(0, 15).map((r) => (
          <button
            key={r.id}
            onClick={() => navigate({ to: '/rapport/$id', params: { id: r.id } })}
            className="w-full flex items-center gap-3 rounded-lg border border-[#EAEFEF] bg-white px-3 py-2 text-left hover:bg-[#F8FAF8] transition-colors"
          >
            <FileText size={14} className="text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[#0E1111] truncate">{r.report_name}</p>
              <p className="text-[10px] text-slate-400">
                {r.city && `${r.city} · `}
                {new Date(r.created_at).toLocaleDateString('nl-NL')}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
