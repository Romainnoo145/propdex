import { Download, X } from 'lucide-react'

interface BulkActionBarProps {
  selectedCount: number
  onExport: () => void
  onClearSelection: () => void
}

export function BulkActionBar({
  selectedCount,
  onExport,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="shrink-0 mt-3 flex items-center justify-between rounded-2xl border border-[#EAEFEF] bg-white px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold text-[#0E1111]">
          {selectedCount} {selectedCount === 1 ? 'perceel' : 'percelen'}
        </span>
        <button
          onClick={onClearSelection}
          className="inline-flex items-center gap-1 rounded-full border border-[#EAEFEF] px-2.5 py-1 text-[11px] text-slate-500 hover:text-[#0E1111] hover:border-[#0E1111] transition-colors"
        >
          <X size={10} />
          Deselecteren
        </button>
      </div>
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 transition-colors"
      >
        <Download size={14} />
        Exporteer
      </button>
    </div>
  )
}
