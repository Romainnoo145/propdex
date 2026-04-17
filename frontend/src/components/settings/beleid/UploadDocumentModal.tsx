/**
 * UploadDocumentModal — M045/S05
 *
 * Modal for vendor admins to upload a new policy document. Fields:
 *   Niveau → Entity (conditional) → Source key → PDF file.
 *
 * On submit: delegates to the existing useUploadPolicyDocument mutation so
 * both the admin overview cache and the per-entity policy-documents cache
 * stay consistent. On success: sonner toast with the new version_number
 * plus an explicit admin-overview invalidation; modal closes.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUploadPolicyDocument } from '@/hooks/usePolicyDocuments'
import {
  getSourcesForLevel,
  LEVEL_LABELS,
  type CascadeLevel,
} from '@/lib/constants/dataSources'

// 12 provincies, mirrors backend _PROVINCIE_NAMES.
const PROVINCIES: ReadonlyArray<{ code: string; naam: string }> = [
  { code: 'PV20', naam: 'Groningen' },
  { code: 'PV21', naam: 'Fryslân' },
  { code: 'PV22', naam: 'Drenthe' },
  { code: 'PV23', naam: 'Overijssel' },
  { code: 'PV24', naam: 'Flevoland' },
  { code: 'PV25', naam: 'Gelderland' },
  { code: 'PV26', naam: 'Utrecht' },
  { code: 'PV27', naam: 'Noord-Holland' },
  { code: 'PV28', naam: 'Zuid-Holland' },
  { code: 'PV29', naam: 'Zeeland' },
  { code: 'PV30', naam: 'Noord-Brabant' },
  { code: 'PV31', naam: 'Limburg' },
]

export interface GemeenteEntry {
  code: string
  naam: string
  provincie_code: string
}

interface Props {
  open: boolean
  onClose: () => void
  gemeenten: GemeenteEntry[]
}

export function UploadDocumentModal({ open, onClose, gemeenten }: Props) {
  const queryClient = useQueryClient()
  const uploadMutation = useUploadPolicyDocument()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [niveau, setNiveau] = useState<CascadeLevel>('landelijk')
  const [entityCode, setEntityCode] = useState<string>('NL')
  const [sourceKey, setSourceKey] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)

  const sourceKeyOptions = useMemo(() => getSourcesForLevel(niveau), [niveau])

  // Reset entity + source_key whenever niveau changes.
  useEffect(() => {
    const firstKey = getSourcesForLevel(niveau)[0]?.key ?? ''
    if (niveau === 'landelijk') {
      setEntityCode('NL')
    } else if (niveau === 'provincie') {
      setEntityCode(PROVINCIES[0]!.code)
    } else {
      setEntityCode(gemeenten[0]?.code ?? '')
    }
    setSourceKey(firstKey)
  }, [niveau, gemeenten])

  // Close on ESC.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Kies een PDF bestand')
      return
    }
    if (!entityCode || !sourceKey) {
      toast.error('Kies eerst een entity en documenttype')
      return
    }

    try {
      const doc = await uploadMutation.mutateAsync({
        entityType: niveau,
        entityCode,
        sourceKey,
        file,
      })
      const label = sourceKeyOptions.find((s) => s.key === sourceKey)?.label ?? sourceKey
      const v = doc.version_number
      const msg =
        v === 1
          ? `${label} v1 geüpload`
          : `${label} v${v} geüpload — vervangt v${v - 1} in cascade`
      toast.success(msg)
      await queryClient.invalidateQueries({ queryKey: ['admin-policy-overview'] })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload faalde')
    }
  }

  const isSubmitting = uploadMutation.isPending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[540px] max-w-[calc(100vw-32px)] rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E1111]">
            Nieuw beleidsdocument
          </p>
          <p className="text-[13px] text-slate-500 mt-1">
            Een upload wordt automatisch zichtbaar bij alle klanten in de cascade.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[12px] font-semibold text-[#0E1111]">Niveau</label>
          <select
            value={niveau}
            onChange={(e) => setNiveau(e.target.value as CascadeLevel)}
            className="w-full rounded-[10px] border border-[#EAEFEF] bg-white px-3 py-2 text-[13px] text-[#0E1111] outline-none focus:border-[#F9A826]"
          >
            <option value="landelijk">{LEVEL_LABELS.landelijk}</option>
            <option value="provincie">{LEVEL_LABELS.provincie}</option>
            <option value="gemeente">{LEVEL_LABELS.gemeente}</option>
          </select>
        </div>

        {niveau === 'provincie' && (
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-[#0E1111]">Provincie</label>
            <select
              value={entityCode}
              onChange={(e) => setEntityCode(e.target.value)}
              className="w-full rounded-[10px] border border-[#EAEFEF] bg-white px-3 py-2 text-[13px]"
            >
              {PROVINCIES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.naam}
                </option>
              ))}
            </select>
          </div>
        )}

        {niveau === 'gemeente' && (
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-[#0E1111]">Gemeente</label>
            <select
              value={entityCode}
              onChange={(e) => setEntityCode(e.target.value)}
              className="w-full rounded-[10px] border border-[#EAEFEF] bg-white px-3 py-2 text-[13px]"
            >
              {gemeenten.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.code} · {g.naam}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[12px] font-semibold text-[#0E1111]">Documenttype</label>
          <select
            value={sourceKey}
            onChange={(e) => setSourceKey(e.target.value)}
            className="w-full rounded-[10px] border border-[#EAEFEF] bg-white px-3 py-2 text-[13px]"
          >
            {sourceKeyOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[12px] font-semibold text-[#0E1111]">PDF bestand</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-[10px] border border-[#EAEFEF] bg-white px-3 py-2 text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-[#F2F6F3] file:px-3 file:py-1 file:text-[#0E1111] file:text-[11px] file:font-semibold"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-[12px] font-semibold text-slate-500 hover:bg-[#F2F6F3]"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || isSubmitting}
            className="px-5 py-2 rounded-full text-[12px] font-bold bg-[#0E1111] text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Uploaden…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

