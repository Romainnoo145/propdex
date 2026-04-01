/**
 * SectionNotes — section-bottom notes/upload area.
 *
 * When a parcelId is present, renders an UploadZone for document uploads.
 * Always renders a disabled notes teaser below indicating the feature is
 * coming soon ("binnenkort beschikbaar").
 */

'use client'

import { UploadZone } from './UploadZone'

export interface SectionNotesProps {
  parcelId: string | null | undefined
  documentTypes?: string[]
  label?: string
}

export function SectionNotes({
  parcelId,
  documentTypes,
  label,
}: SectionNotesProps) {
  return (
    <div className="mt-4 space-y-2">
      {parcelId && (
        <UploadZone
          parcelId={parcelId}
          documentTypes={documentTypes}
          label={label}
        />
      )}

      <div className="rounded-[16px] bg-slate-50 border border-dashed border-slate-200 px-4 py-3 text-[12px] text-slate-400">
        Notities — binnenkort beschikbaar
      </div>
    </div>
  )
}
