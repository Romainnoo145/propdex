/**
 * VersionHistoryPanel — M045/S05 + M049/S04
 *
 * Rendered underneath an expanded DocumentRow (inline), OR as a modal overlay
 * when mounted from the data-bronnen detail route (open/onClose/gemeenteCode pattern).
 */
import type React from 'react'
import { Download, Eye, Loader2 } from 'lucide-react'
import { useAdminPolicyVersions } from '@/hooks/useAdminPolicyVersions'
import type { AdminPolicyVersionRow } from '@/lib/types/policy-admin'
import { formatRelativeNL } from '@/lib/utils/datetime'

interface Props {
  entityType: string
  entityCode: string
  sourceKey: string
  latestVersionNumber: number
  onView: (versionId: string, entityType: string, entityCode: string) => void
  onDownload: (
    versionId: string,
    filename: string,
    entityType: string,
    entityCode: string,
  ) => void
  // NEW — modal overlay mode (used when mounted from data-bronnen hub)
  open?: boolean           // if provided and false, renders nothing (modal closed)
  onClose?: () => void     // if provided, shows a close button / backdrop click dismisses
  gemeenteCode?: string    // shorthand: sets entityType='gemeente', entityCode=gemeenteCode
}

const PANEL_BASE =
  'border border-t-0 border-[#EAEFEF] border-l-2 border-l-[#F9A826] rounded-b-[8px] bg-white'

export function VersionHistoryPanel({
  entityType,
  entityCode,
  sourceKey,
  latestVersionNumber,
  onView,
  onDownload,
  open,
  onClose,
  gemeenteCode,
}: Props) {
  // Resolve entityType/entityCode from shorthand props when provided.
  const resolvedEntityType = gemeenteCode ? 'gemeente' : entityType
  const resolvedEntityCode = gemeenteCode ?? entityCode

  const { data, isLoading, isError } = useAdminPolicyVersions({
    entityType: resolvedEntityType,
    entityCode: resolvedEntityCode,
    sourceKey,
  })

  // Modal mode: respect open=false (hooks always run above)
  if (open === false) return null

  if (isLoading) {
    const body = (
      <div className={`${PANEL_BASE} px-3.5 py-3 flex items-center gap-2 text-[12px] text-slate-500`}>
        <Loader2 size={14} className="animate-spin" /> Versies laden…
      </div>
    )
    if (onClose) return <ModalShell onClose={onClose}>{body}</ModalShell>
    return body
  }

  if (isError || !data) {
    const body = (
      <div className={`${PANEL_BASE} px-3.5 py-3 text-[12px] text-red-500`}>
        Kon versies niet laden.
      </div>
    )
    if (onClose) return <ModalShell onClose={onClose}>{body}</ModalShell>
    return body
  }

  const versionRows = (
    <VersionRows
      versions={data.versions}
      latestVersionNumber={latestVersionNumber}
      resolvedEntityType={resolvedEntityType}
      resolvedEntityCode={resolvedEntityCode}
      onView={onView}
      onDownload={onDownload}
    />
  )

  if (onClose) {
    return (
      <ModalShell onClose={onClose}>
        <div className="px-5 py-3">{versionRows}</div>
      </ModalShell>
    )
  }

  return <div className={`${PANEL_BASE} px-3.5 py-1`}>{versionRows}</div>
}

// ---------------------------------------------------------------------------
// Internal: shared version rows list
// ---------------------------------------------------------------------------

interface VersionRowsProps {
  versions: AdminPolicyVersionRow[]
  latestVersionNumber: number
  resolvedEntityType: string
  resolvedEntityCode: string
  onView: (versionId: string, entityType: string, entityCode: string) => void
  onDownload: (versionId: string, filename: string, entityType: string, entityCode: string) => void
}

function VersionRows({
  versions,
  latestVersionNumber,
  resolvedEntityType,
  resolvedEntityCode,
  onView,
  onDownload,
}: VersionRowsProps) {
  return (
    <>
      {versions.map((v, i) => (
        <div
          key={v.id}
          className={`py-2.5 flex items-center justify-between ${
            i < versions.length - 1 ? 'border-b border-dashed border-slate-200' : ''
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`text-[10px] font-black tracking-[0.05em] tabular-nums w-6
                ${v.version_number === latestVersionNumber ? 'text-[#F9A826]' : 'text-slate-400'}`}
            >
              v{v.version_number}
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[#0F172A] truncate">
                {v.filename}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {v.uploader_name} · {formatRelativeNL(v.uploaded_at)} · {formatBytes(v.file_size)}
              </div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onView(v.id, resolvedEntityType, resolvedEntityCode)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#EAEFEF] text-[10px] font-bold uppercase tracking-[0.05em] text-[#0E1111] hover:bg-[#F2F6F3]"
            >
              <Eye size={11} /> Bekijk
            </button>
            <button
              type="button"
              onClick={() => onDownload(v.id, v.filename, resolvedEntityType, resolvedEntityCode)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#EAEFEF] text-[10px] font-bold uppercase tracking-[0.05em] text-[#0E1111] hover:bg-[#F2F6F3]"
            >
              <Download size={11} /> Download
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Internal: Modal shell wrapper (only used in modal-overlay mode)
// ---------------------------------------------------------------------------

interface ModalShellProps {
  onClose: () => void
  children: React.ReactNode
}

function ModalShell({ onClose, children }: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[600px] max-w-[calc(100vw-32px)] max-h-[80vh] overflow-y-auto rounded-[24px] bg-white border border-[#EAEFEF] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#EAEFEF]">
          <p className="text-[13px] font-semibold text-[#0E1111]">Versiegeschiedenis</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="inline-flex items-center justify-center size-7 rounded-full text-slate-400 hover:text-[#0E1111] hover:bg-[#F2F6F3]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
