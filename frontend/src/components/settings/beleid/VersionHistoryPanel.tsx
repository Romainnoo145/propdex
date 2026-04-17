/**
 * VersionHistoryPanel — M045/S05
 *
 * Rendered underneath an expanded DocumentRow. Fetches /admin/versions via
 * useAdminPolicyVersions and lists all versions newest-first, each with
 * Bekijk + Download buttons.
 */
import { Download, Eye, Loader2 } from 'lucide-react'
import { useAdminPolicyVersions } from '@/hooks/useAdminPolicyVersions'
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
}: Props) {
  const { data, isLoading, isError } = useAdminPolicyVersions({
    entityType,
    entityCode,
    sourceKey,
  })

  if (isLoading) {
    return (
      <div className={`${PANEL_BASE} px-3.5 py-3 flex items-center gap-2 text-[12px] text-slate-500`}>
        <Loader2 size={14} className="animate-spin" /> Versies laden…
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className={`${PANEL_BASE} px-3.5 py-3 text-[12px] text-red-500`}>
        Kon versies niet laden.
      </div>
    )
  }

  return (
    <div className={`${PANEL_BASE} px-3.5 py-1`}>
      {data.versions.map((v, i) => (
        <div
          key={v.id}
          className={`py-2.5 flex items-center justify-between ${
            i < data.versions.length - 1 ? 'border-b border-dashed border-slate-200' : ''
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
              onClick={() => onView(v.id, entityType, entityCode)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#EAEFEF] text-[10px] font-bold uppercase tracking-[0.05em] text-[#0E1111] hover:bg-[#F2F6F3]"
            >
              <Eye size={11} /> Bekijk
            </button>
            <button
              type="button"
              onClick={() => onDownload(v.id, v.filename, entityType, entityCode)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#EAEFEF] text-[10px] font-bold uppercase tracking-[0.05em] text-[#0E1111] hover:bg-[#F2F6F3]"
            >
              <Download size={11} /> Download
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
