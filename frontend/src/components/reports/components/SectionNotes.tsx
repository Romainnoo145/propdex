/**
 * SectionNotes — section-bottom notes area for rapport sections.
 *
 * When a parcelId is present, renders the MultiNoteBlock (full CRUD notes)
 * matching the workspace Notities pattern. When no parcelId, shows a
 * disabled teaser.
 */

import { MultiNoteBlock } from '@/components/shared/MultiNoteBlock'

export interface SectionNotesProps {
  parcelId: string | null | undefined
  documentTypes?: string[]
  label?: string
}

export function SectionNotes({ parcelId }: SectionNotesProps) {
  if (!parcelId) {
    return (
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
          Notities
        </p>
        <div className="rounded-[16px] bg-slate-50 border border-dashed border-slate-200 px-4 py-3 text-[12px] text-slate-400">
          Koppel een perceel om notities toe te voegen
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
        Notities
      </p>
      <MultiNoteBlock parcelId={parcelId} />
    </div>
  )
}
