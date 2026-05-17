/**
 * PipelineStagePill
 *
 * Two usage modes:
 *
 * 1. Display pill (existing callers: FavoritedParcelCard, PipelineStageFilter):
 *    <PipelineStagePill stage={fav.pipeline_stage} onClick={...} />
 *
 * 2. Self-contained dropdown switcher (new: SavedParcelCard in M050/S06):
 *    <PipelineStagePill parcelId={parcel.parcel_id} currentStage={parcel.pipeline_stage} />
 *    — wires useUpdatePipelineStage internally, renders a portal dropdown on click.
 */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { useUpdatePipelineStage } from '@/hooks/useFavorites'
import type { PipelineStage } from '@/lib/types/portfolio'

/* ── Shared ─────────────────────────────────────────────────── */

export const STAGES: PipelineStage[] = [
  'Gesignaleerd',
  'Onderzoek',
  'Contact',
  'Besluit',
  'Afgerond',
]

export const STAGE_STYLES: Record<PipelineStage, string> = {
  Gesignaleerd: 'bg-aura-mint/40 text-aura-ink',
  Onderzoek: 'bg-aura-amber/20 text-aura-amber',
  Contact: 'bg-blue-50 text-blue-700',
  Besluit: 'bg-purple-50 text-purple-700',
  Afgerond: 'bg-neutral-100 text-neutral-600',
}

/* ── Props (discriminated union) ─────────────────────────────── */

interface DisplayPillProps {
  /** Display-only mode: pass `stage` + optional `onClick` */
  stage: PipelineStage
  onClick?: () => void
  afgerondReden?: string | null
  /** Dropdown mode props must NOT be present */
  parcelId?: never
  currentStage?: never
}

interface DropdownPillProps {
  /** Dropdown mode: pass `parcelId` + `currentStage` — wires mutation internally */
  parcelId: string
  currentStage: PipelineStage
  /** Display-mode props must NOT be present */
  stage?: never
  onClick?: never
  afgerondReden?: never
}

type PipelineStagePillProps = DisplayPillProps | DropdownPillProps

/* ── Component ───────────────────────────────────────────────── */

export function PipelineStagePill(props: PipelineStagePillProps) {
  // Dropdown mode
  if (props.parcelId !== undefined) {
    return <DropdownPill parcelId={props.parcelId} currentStage={props.currentStage!} />
  }

  // Display mode (legacy)
  const { stage, onClick, afgerondReden } = props
  const pillClass = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_STYLES[stage]}`

  return (
    <div className="flex flex-col items-end gap-0.5">
      {onClick ? (
        <button
          onClick={onClick}
          className={`${pillClass} cursor-pointer hover:opacity-80 transition-opacity`}
        >
          {stage}
        </button>
      ) : (
        <span className={pillClass}>{stage}</span>
      )}
      {afgerondReden && stage === 'Afgerond' && (
        <span className="text-[10px] text-neutral-400">{afgerondReden}</span>
      )}
    </div>
  )
}

/* ── Dropdown sub-component (M050/S06) ─────────────────────── */

function DropdownPill({
  parcelId,
  currentStage,
}: {
  parcelId: string
  currentStage: PipelineStage
}) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const updateStage = useUpdatePipelineStage()

  useEffect(() => {
    if (!isOpen) return undefined
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- positioning from DOM rect is external system sync
    if (!isOpen) { setMenuPosition(null); return undefined }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({
        top: rect.bottom + 6,
        left: Math.min(window.innerWidth - 180 - 12, Math.max(12, rect.right - 180)),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen((o) => !o) }}
        className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
      >
        {currentStage}
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }}
          className="w-[180px] rounded-[16px] border border-slate-200 bg-white py-1.5 shadow-xl"
        >
          {STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (stage !== currentStage) {
                  updateStage.mutate({ parcelId, stage })
                }
                setIsOpen(false)
              }}
              className="flex w-full items-center justify-between px-4 py-2 text-[12px] hover:bg-slate-50 transition-colors"
            >
              <span className={stage === currentStage ? 'font-bold text-aura-ink' : 'text-slate-600'}>
                {stage}
              </span>
              {stage === currentStage && <Check size={12} className="text-amber-500" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
