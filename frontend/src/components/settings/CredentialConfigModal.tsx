/**
 * CredentialConfigModal — M049/S05
 *
 * Aura-styled modal for configuring vendor-managed Type-C credentials
 * (BRK / Vindsubsidies / NVM). Form fields rendered dynamically from
 * CREDENTIAL_FIELDS[sourceKey] — no per-source layout code.
 *
 * States:
 *  - EMPTY (no GET result, or post-delete): form for each missing field
 *  - FILLED (GET returns entries): shows "{label}: configured ({date})"
 *    with per-field "Roteren" button → DELETE then back to EMPTY
 *  - ROTATING: spinner state during DELETE round-trip
 *
 * Never displays the secret value or its ciphertext — backend GET shape
 * (CredentialEntryRead) does not include them.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { KeyRound, Lock, RotateCw, X } from 'lucide-react'

import { CREDENTIAL_FIELDS } from '@/lib/constants/credentialFields'
import {
  useCreateCredential,
  useCredentialsForSource,
  useDeleteCredential,
} from '@/lib/queries/integration-credentials-admin'
import type {
  CredentialEntryRead,
  CredentialField,
} from '@/lib/types/integration-credentials'
import { formatRelativeNL } from '@/lib/utils/datetime'

interface Props {
  open: boolean
  onClose: () => void
  sourceKey: string | null
}

const SOURCE_LABEL: Record<string, string> = {
  brk: 'BRK (Kadaster)',
  vindsubsidies: 'Vindsubsidies',
  nvm: 'NVM',
}

export function CredentialConfigModal({ open, onClose, sourceKey }: Props) {
  // Hooks must run before any early-return per React rules.
  const fields: CredentialField[] = sourceKey
    ? (CREDENTIAL_FIELDS[sourceKey] ?? [])
    : []
  const { data: entries = [], isLoading } = useCredentialsForSource(
    open && sourceKey ? sourceKey : undefined,
  )
  const createMut = useCreateCredential()
  const deleteMut = useDeleteCredential()

  const [formValues, setFormValues] = useState<Record<string, string>>({})

  const entriesByName = useMemo(() => {
    const m: Record<string, CredentialEntryRead> = {}
    for (const e of entries) m[e.credential_name] = e
    return m
  }, [entries])

  if (!open || !sourceKey) return null

  const allFieldsHaveEntries =
    fields.length > 0 && fields.every((f) => entriesByName[f.name])

  const handleSaveField = async (field: CredentialField) => {
    const value = formValues[field.name]?.trim()
    if (!value) return
    await createMut.mutateAsync({
      source_key: sourceKey,
      credential_name: field.name,
      value,
    })
    setFormValues((prev) => ({ ...prev, [field.name]: '' }))
  }

  const handleRotate = async (field: CredentialField) => {
    const entry = entriesByName[field.name]
    if (!entry) return
    await deleteMut.mutateAsync({ id: entry.id, sourceKey })
    // After delete the GET cache refetches → entry disappears → form reappears.
  }

  return (
    <AnimatePresence>
      <motion.div
        key="credential-modal-backdrop"
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-xl mx-4 rounded-[24px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.10)] p-8"
          style={{ fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui' }}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="absolute top-4 right-4 text-slate-500 hover:text-[#0E1111]"
          >
            <X size={20} />
          </button>

          <header className="flex items-center gap-3 mb-1">
            <KeyRound size={22} className="text-[#F9A826]" strokeWidth={1.5} />
            <h2 className="text-xl font-semibold text-[#0E1111]">
              Credential configureren · {SOURCE_LABEL[sourceKey] ?? sourceKey}
            </h2>
          </header>
          <p className="text-sm text-slate-600 mb-6 flex items-center gap-1.5">
            <Lock size={14} strokeWidth={1.5} /> Versleuteld opgeslagen
            (Fernet, vendor-managed)
          </p>

          {isLoading ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Laden…
            </div>
          ) : (
            <div className="space-y-5">
              {fields.map((field) => {
                const entry = entriesByName[field.name]
                if (entry) {
                  return (
                    <FilledField
                      key={field.name}
                      field={field}
                      entry={entry}
                      isRotating={
                        deleteMut.isPending &&
                        deleteMut.variables?.id === entry.id
                      }
                      onRotate={() => handleRotate(field)}
                    />
                  )
                }
                return (
                  <EmptyField
                    key={field.name}
                    field={field}
                    value={formValues[field.name] ?? ''}
                    onChange={(v) =>
                      setFormValues((prev) => ({ ...prev, [field.name]: v }))
                    }
                    isSaving={
                      createMut.isPending &&
                      createMut.variables?.credential_name === field.name
                    }
                    onSave={() => handleSaveField(field)}
                  />
                )
              })}
            </div>
          )}

          {allFieldsHaveEntries && !isLoading && (
            <p className="text-sm text-[#22C55E] mt-6">
              Alle velden geconfigureerd. M051/M052/M053 integraties kunnen
              deze credentials gebruiken.
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function EmptyField({
  field,
  value,
  onChange,
  isSaving,
  onSave,
}: {
  field: CredentialField
  value: string
  onChange: (v: string) => void
  isSaving: boolean
  onSave: () => void
}) {
  const isTextarea = field.input_type === 'textarea'
  const inputType =
    field.input_type === 'password'
      ? 'password'
      : field.input_type === 'url'
        ? 'url'
        : 'text'

  return (
    <div className="space-y-1.5">
      <label
        className="text-sm font-medium text-[#1A1C1E]"
        htmlFor={`cred-${field.name}`}
      >
        {field.label}
      </label>
      {isTextarea ? (
        <textarea
          id={`cred-${field.name}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="w-full rounded-xl bg-white/70 border border-white/60 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F9A826]/40"
        />
      ) : (
        <input
          id={`cred-${field.name}`}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl bg-white/70 border border-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F9A826]/40"
        />
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim() || isSaving}
          className="px-4 py-2 rounded-xl bg-[#0E1111] text-white text-sm font-medium disabled:opacity-40 hover:bg-black"
        >
          {isSaving ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>
    </div>
  )
}

function FilledField({
  field,
  entry,
  isRotating,
  onRotate,
}: {
  field: CredentialField
  entry: CredentialEntryRead
  isRotating: boolean
  onRotate: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/40 border border-white/60 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[#0E1111]">{field.label}</div>
        <div className="text-xs text-slate-500">
          Geconfigureerd{' '}
          {entry.configured_at ? formatRelativeNL(entry.configured_at) : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onRotate}
        disabled={isRotating}
        className="px-3 py-1.5 rounded-xl text-sm text-slate-700 hover:text-[#0E1111] inline-flex items-center gap-1.5 disabled:opacity-40"
      >
        <RotateCw
          size={14}
          strokeWidth={1.75}
          className={isRotating ? 'animate-spin' : ''}
        />
        {isRotating ? 'Roteren…' : 'Roteren'}
      </button>
    </div>
  )
}
