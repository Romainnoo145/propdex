/**
 * DossierCardSlot — single dossier card with drag-drop upload + document list.
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split,
 * M050/S06 cont.). Was named `DropzoneCard` pre-split.
 */
import { useCallback, useState } from 'react'
import { BookOpen, Download, Eye, Loader2, Trash2, Upload } from 'lucide-react'
import { TruncatedText } from '@/components/map/panels/parcel/TruncatedText'
import { GHOST_ICONS, type DossierCard } from '@/lib/cockpit/dossier-pages'

interface DossierCardSlotProps {
  card: DossierCard
  uploadingKey: string | null
  onUploadClick: (cardKey: string) => void
  onFileDrop: (cardKey: string, file: File) => void
  onDelete: (documentId: string) => void
  onDownload: (documentId: string, filename: string) => void
  onView: (documentId: string, filename?: string) => void
}

export function DossierCardSlot({
  card,
  uploadingKey,
  onUploadClick,
  onFileDrop,
  onDelete,
  onDownload,
  onView,
}: DossierCardSlotProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const isUploading = uploadingKey === card.key
  const hasDocuments = card.documents.length > 0
  const hasApiData = card.filled && card.value !== 'LEEG'
  const GhostIcon = GHOST_ICONS[card.key] ?? BookOpen

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragOver(false)
      if (event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0]
        if (file) {
          onFileDrop(card.key, file)
        }
      }
    },
    [card.key, onFileDrop],
  )

  const dragProps = { onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop }

  const docFileList = (variant: 'light' | 'dark') => {
    if (!hasDocuments) return null
    const isDark = variant === 'dark'

    return (
      <div className="space-y-0.5">
        {card.documents.map((document) => (
          <div key={document.id} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDownload(document.id, document.filename)
              }}
              className={`flex-1 cursor-pointer truncate text-left text-[9px] font-medium transition-colors hover:text-amber-400 ${
                isDark ? 'text-white/50' : 'text-slate-500'
              }`}
              title={document.filename}
            >
              {document.filename}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onView(document.id, document.filename)
              }}
              className={`shrink-0 transition-colors hover:text-amber-400 ${isDark ? 'text-white/30' : 'text-slate-400'}`}
              title="Bekijken"
            >
              <Eye className="size-3" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDownload(document.id, document.filename)
              }}
              className={`shrink-0 transition-colors hover:text-amber-400 ${isDark ? 'text-white/30' : 'text-slate-400'}`}
              title="Download"
            >
              <Download className="size-3" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(document.id)
              }}
              className={`shrink-0 transition-colors hover:text-red-400 ${isDark ? 'text-white/30' : 'text-slate-400'}`}
              title="Verwijderen"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  const uploadingIndicator = (
    <div className="mt-1 flex items-center gap-1">
      <Loader2 className="size-3 animate-spin text-amber-500" />
      <span className="text-[9px] font-black uppercase text-amber-500">Uploaden...</span>
    </div>
  )

  const addButton = (variant: 'light' | 'dark') => {
    const isDark = variant === 'dark'
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onUploadClick(card.key)
        }}
        className={`mt-1 flex items-center gap-1 text-[9px] font-bold transition-colors ${
          isDark ? 'text-white/40 hover:text-amber-400' : 'text-slate-400 hover:text-amber-400'
        }`}
      >
        <Upload className="size-2.5" />
        <span>{hasDocuments ? 'TOEVOEGEN' : 'UPLOAD'}</span>
      </button>
    )
  }

  if (hasDocuments) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUploadClick(card.key)}
        onKeyDown={(event) => event.key === 'Enter' && onUploadClick(card.key)}
        {...dragProps}
        className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[20px] border-2 p-4 transition-all duration-300 ${
          isDragOver ? 'scale-[1.02] border-amber-500' : 'border-amber-200 hover:border-amber-400'
        } bg-amber-50`}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="flex-1 truncate text-[10px] font-black uppercase tracking-[0.15em] text-amber-900/70">
            {card.label}
          </p>
          <span className="shrink-0 rounded-full bg-amber-200/60 px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-wide text-amber-700">
            {card.documents.length} {card.documents.length === 1 ? 'bestand' : 'bestanden'}
          </span>
        </div>

        {/* Vertically-centred file list — matches the centred focal of the empty
            / api-data cards so every card's content sits at the same height.
            Scrollable (no 2-cap) so every uploaded document stays reachable. */}
        <div className="flex min-h-0 flex-1 items-center justify-center py-2">
          <div className="max-h-full w-full overflow-y-auto">{docFileList('light')}</div>
        </div>

        <div className="shrink-0">
          {isUploading ? uploadingIndicator : addButton('light')}
        </div>
      </div>
    )
  }

  if (hasApiData) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUploadClick(card.key)}
        onKeyDown={(event) => event.key === 'Enter' && onUploadClick(card.key)}
        {...dragProps}
        className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[20px] border-2 p-4 transition-all duration-200 ${
          isDragOver ? 'scale-[1.02] border-amber-500 bg-amber-50/50' : 'border-emerald-200/60 bg-white hover:border-amber-400'
        }`}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="flex-1 truncate text-[10px] font-black uppercase tracking-[0.15em] text-slate-900">
            {card.label}
          </p>
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-emerald-400" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-2">
          <p className="text-center text-xl font-black leading-none tracking-tighter text-slate-900">
            {card.value}
          </p>
        </div>

        <div className="relative">
          {isUploading ? (
            uploadingIndicator
          ) : (
            <>
              {/* card.sub and the hover hint occupy the SAME line (hint absolute),
                  so the eyebrow doesn't sit higher than the other cards' eyebrows. */}
              <TruncatedText
                text={card.sub}
                className="truncate text-[9px] font-medium text-slate-400 transition-opacity group-hover:opacity-0"
              />
              <div className="absolute inset-0 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Upload className="size-2.5 text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-400">
                  VOEG BIJLAGE TOE
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onUploadClick(card.key)}
      onKeyDown={(event) => event.key === 'Enter' && onUploadClick(card.key)}
      {...dragProps}
      className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[20px] border-2 border-dashed p-4 transition-all duration-200 ${
        isUploading
          ? 'border-amber-400 bg-amber-50/30'
          : isDragOver
            ? 'scale-[1.02] border-amber-500 bg-amber-50/50'
            : 'border-slate-200 bg-slate-50/30 hover:border-amber-400 hover:bg-amber-50/20'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="flex-1 truncate text-[10px] font-black uppercase tracking-[0.15em] text-slate-900">
          {card.label}
        </p>
        <span
          className={`mt-0.5 size-2 shrink-0 rounded-full transition-colors ${
            isUploading ? 'animate-pulse bg-amber-400' : 'bg-slate-300'
          }`}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2">
        {isUploading ? (
          <>
            <Loader2 className="size-10 animate-spin text-amber-400" strokeWidth={1.5} />
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-500">UPLOADEN...</p>
          </>
        ) : (
          <>
            <GhostIcon
              className="size-10 text-slate-900 opacity-[0.05] transition-all duration-300 group-hover:scale-110 group-hover:opacity-[0.30]"
              strokeWidth={1.5}
            />
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 transition-colors group-hover:text-amber-400">
              SLEEP HIER OF KLIK
            </p>
          </>
        )}
      </div>

      <div>
        <TruncatedText text={card.sub} className="truncate text-[9px] font-medium text-slate-400" />
      </div>
    </div>
  )
}
