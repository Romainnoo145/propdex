import { useState, useCallback, createElement } from 'react'
import { Upload } from 'lucide-react'
import type { DossierCard } from '@/lib/cockpit/dossier-pages'

export type DossierSlotState = 'empty' | 'data' | 'docs'

/** docs = has user uploads · data = API-filled value · empty = nothing yet. */
export function dossierSlotState(card: DossierCard): DossierSlotState {
  if (card.documents.length > 0) return 'docs'
  if (card.filled && card.value !== 'LEEG') return 'data'
  return 'empty'
}

interface DossierSlotCardProps {
  card: DossierCard
  onClick: () => void
  onDragFile?: (file: File) => void
}

export function DossierSlotCard({ card, onClick, onDragFile }: DossierSlotCardProps) {
  const state = dossierSlotState(card)
  const [dragOver, setDragOver] = useState(false)
  const iconNode = createElement(card.Icon, { size: 20, strokeWidth: 1.5 })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && onDragFile) onDragFile(file)
  }, [onDragFile])

  const border = state === 'empty'
    ? 'border border-dashed border-slate-200 bg-white/50'
    : state === 'docs'
      ? 'border border-amber-200 bg-amber-50'
      : 'border border-emerald-200 bg-white'
  const tile = state === 'empty'
    ? 'bg-slate-100 text-slate-300'
    : state === 'docs'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-50 text-emerald-700'
  const dotColor = state === 'docs' ? 'bg-amber-400' : state === 'data' ? 'bg-emerald-500' : 'bg-slate-300'
  const valColor = state === 'empty' ? 'text-slate-300' : state === 'docs' ? 'text-amber-900' : 'text-slate-900'
  const valText = state === 'empty' ? 'Sleep of klik' : card.value === 'LEEG'
    ? `${card.documents.length} bestand${card.documents.length > 1 ? 'en' : ''}` : card.value

  return (
    <div
      role="button" tabIndex={0}
      aria-label={`${card.label}: ${valText}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
      onDrop={handleDrop}
      className={`flex min-h-[128px] cursor-pointer flex-col rounded-[18px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all ${border} ${dragOver ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-[42px] w-[42px] items-center justify-center rounded-[13px] ${tile}`}>{iconNode}</span>
        {state === 'docs'
          ? <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">{card.documents.length}</span>
          : <span className={`mt-1.5 h-2 w-2 rounded-full ${dotColor}`} />}
      </div>
      <div className="mt-auto pt-3 text-left">
        <p className={`text-[10px] font-extrabold uppercase tracking-[0.13em] ${state === 'docs' ? 'text-amber-900/70' : 'text-slate-400'}`}>{card.label}</p>
        <p className={`mt-0.5 text-[18px] font-extrabold leading-tight tracking-[-0.02em] ${valColor} ${state === 'empty' ? 'text-[12px] uppercase tracking-wide' : ''}`}>{valText}</p>
        {state !== 'empty' && card.sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{card.sub}</p>}
        {state === 'empty' && (
          <p className="mt-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-300">
            <Upload size={11} strokeWidth={2} /> {card.sub}
          </p>
        )}
      </div>
    </div>
  )
}
