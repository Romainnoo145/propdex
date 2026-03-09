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
    <div className="bg-aura-glass-white/40 border-t border-neutral-200 px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-aura-ink">
          {selectedCount} {selectedCount === 1 ? 'perceel' : 'percelen'}{' '}
          geselecteerd
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-neutral-600 hover:text-aura-ink underline transition-colors"
        >
          Deselecteren
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aura-obsidian bg-aura-amber hover:bg-aura-amber-hover rounded transition-colors"
        >
          <Download size={14} />
          Exporteer selectie
        </button>
        <button
          disabled
          title="Binnenkort beschikbaar"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-200 rounded cursor-not-allowed opacity-60"
        >
          <FolderPlus size={14} />
          Toevoegen aan project
        </button>
      </div>
    </div>
  )
}
