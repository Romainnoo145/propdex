/**
 * UploadZone + DisabledUploadZone — unified document upload components.
 *
 * Unified from three variants:
 *   - S1: singular documentType (now pass as single-element array)
 *   - S4/S3: documentTypes[] + label
 *   - S5/S6: parcelId-only (hardcoded type — callers now pass documentTypes)
 *
 * Signature: { parcelId, documentTypes?, label? }
 *   - documentTypes defaults to ['overig']
 *   - label defaults to 'Document toevoegen'
 */

'use client'

import { useRef } from 'react'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'

/* ─── UploadZone ─────────────────────────────────────────────── */

export interface UploadZoneProps {
  parcelId: string
  documentTypes?: string[]
  label?: string
}

export function UploadZone({
  parcelId,
  documentTypes = ['overig'],
  label = 'Document toevoegen',
}: UploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: docs } = useParcelDocuments(parcelId)
  const upload = useUploadDocument()

  const existing =
    docs?.documents?.filter((d) => documentTypes.includes(d.document_type)) ?? []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate({ parcelId, documentType: documentTypes[0] ?? 'overig', file })
    e.target.value = ''
  }

  return (
    <div
      className="rounded-[16px] border border-dashed border-[#EAEFEF] px-4 py-3 text-[12px] text-slate-400 flex items-center justify-between gap-3 cursor-pointer"
      onClick={() => fileRef.current?.click()}
    >
      <div>
        <p className="font-semibold text-slate-600">{label}</p>
        {existing.length > 0 && (
          <p className="mt-0.5 text-slate-500">
            {existing.length} document{existing.length !== 1 ? 'en' : ''} geupload
          </p>
        )}
      </div>
      <input ref={fileRef} type="file" onChange={handleChange} className="hidden" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          fileRef.current?.click()
        }}
        disabled={upload.isPending}
        className="text-[12px] font-semibold text-slate-500 hover:text-[#0E1111] transition-colors disabled:opacity-50"
      >
        {upload.isPending ? 'Uploaden...' : '+ Toevoegen'}
      </button>
    </div>
  )
}

/* ─── DisabledUploadZone ─────────────────────────────────────── */

export function DisabledUploadZone() {
  return (
    <div className="rounded-[16px] border border-dashed border-[#EAEFEF] px-4 py-3 text-[12px] text-slate-400">
      Koppel een perceel om documenten te uploaden
    </div>
  )
}
