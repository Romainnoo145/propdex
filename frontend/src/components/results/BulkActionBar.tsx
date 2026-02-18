import { Download, FolderPlus } from 'lucide-react'

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
    <div className="bg-grey-850 border-t border-grey-800 px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-grey-100">
          {selectedCount} {selectedCount === 1 ? 'perceel' : 'percelen'}{' '}
          geselecteerd
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-grey-400 hover:text-grey-100 underline transition-colors"
        >
          Deselecteren
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-grey-950 bg-amber-accent hover:bg-amber-accent-hover rounded transition-colors"
        >
          <Download size={14} />
          Exporteer selectie
        </button>
        <button
          disabled
          title="Binnenkort beschikbaar"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-grey-400 bg-grey-800 rounded cursor-not-allowed opacity-60"
        >
          <FolderPlus size={14} />
          Toevoegen aan project
        </button>
      </div>
    </div>
  )
}
