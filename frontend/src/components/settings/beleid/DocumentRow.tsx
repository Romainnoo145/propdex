/**
 * DocumentRow — M045/S05
 *
 * Compact one-line row representing one (entity, source_key) slot, showing
 * the latest version. Click expands a VersionHistoryPanel underneath.
 * Hover reveals Eye + Download icon-buttons for the LATEST version inline.
 *
 * Styling mirrors BeleidsdocumentenSection CompactRow: amber left-border,
 * pale background.
 */
import type { MouseEvent } from 'react'
import { ChevronDown, Download, Eye } from 'lucide-react'
import { formatRelativeNL } from '@/lib/utils/datetime'
import type { AdminPolicyOverviewRow } from '@/lib/types/policy-admin'

interface Props {
  row: AdminPolicyOverviewRow
  isExpanded: boolean
  onToggle: () => void
  onView: (versionId: string, entityType: string, entityCode: string) => void
  onDownload: (
    versionId: string,
    filename: string,
    entityType: string,
    entityCode: string,
  ) => void
}

export function DocumentRow({ row, isExpanded, onToggle, onView, onDownload }: Props) {
  const stopAnd = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group w-full py-3 px-3.5 rounded-[8px] border-l-2 border-[#F9A826] text-left transition-colors flex items-center justify-between
        ${isExpanded ? 'bg-[#F2F6F3] rounded-b-none' : 'bg-[#FAFBFA] hover:bg-[#F2F6F3]'}`}
    >
      <div className="min-w-0">
        <div className="font-bold text-[13px] text-[#0F172A] truncate">
          {row.entity_type === 'landelijk'
            ? row.source_key_label
            : `${row.entity_display_name} · ${row.source_key_label}`}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
          {row.entity_code} · {row.source_key}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-0.5 transition-opacity
            ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <span
            role="button"
            tabIndex={0}
            onClick={stopAnd(() => onView(row.latest_version_id, row.entity_type, row.entity_code))}
            className="inline-flex items-center justify-center size-[26px] rounded-md text-slate-500 hover:bg-white hover:text-[#0E1111] cursor-pointer"
            title="Bekijk laatste versie"
          >
            <Eye size={14} />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={stopAnd(() =>
              onDownload(
                row.latest_version_id,
                row.latest_filename,
                row.entity_type,
                row.entity_code,
              ),
            )}
            className="inline-flex items-center justify-center size-[26px] rounded-md text-slate-500 hover:bg-white hover:text-[#0E1111] cursor-pointer"
            title="Download laatste versie"
          >
            <Download size={14} />
          </span>
        </span>
        {row.auto_ingest && (
          <span
            className="text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[5px] bg-white border border-[#EAEFEF] text-slate-500"
            title="Wekelijks automatisch geïmporteerd uit de CVDR overheidsbron"
          >
            Auto
          </span>
        )}
        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-[5px] bg-[#0E1111] text-white tabular-nums">
          v{row.latest_version_number}
        </span>
        <span className="text-[11px] text-slate-500">
          {formatRelativeNL(row.latest_uploaded_at)}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-[#0E1111]' : ''}`}
        />
      </div>
    </button>
  )
}
