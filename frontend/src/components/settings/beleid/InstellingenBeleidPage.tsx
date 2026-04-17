/**
 * InstellingenBeleidPage — M045/S05
 *
 * Vendor-only admin page listing all cascade policy documents grouped by
 * level. Drives upload, view, download, and version-history inspection.
 */
import { useCallback, useState } from 'react'
import { Building2, Landmark, Loader2, MapPin, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import { useAdminPolicyOverview } from '@/hooks/useAdminPolicyOverview'
import { useAdminGemeenten } from '@/hooks/useAdminGemeenten'
import { formatRelativeNL } from '@/lib/utils/datetime'
import { PDFViewerModal } from '@/components/ui/PDFViewerModal'
import { CascadeLevelAccordion } from './CascadeLevelAccordion'
import { DocumentRow } from './DocumentRow'
import { UploadDocumentModal } from './UploadDocumentModal'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import type { AdminPolicyOverviewRow } from '@/lib/types/policy-admin'

function buildDocUrl(versionId: string, entityType: string, entityCode: string): string {
  return `/api/policy-documents/${entityType}/${entityCode}/${versionId}`
}

export function InstellingenBeleidPage() {
  const { accessToken } = useAuth()
  const overview = useAdminPolicyOverview()
  const gemeentenQuery = useAdminGemeenten()

  const [openLevels, setOpenLevels] = useState<Record<string, boolean>>({
    landelijk: true,
  })
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewerState, setViewerState] = useState<
    { url: string; title: string } | null
  >(null)

  const toggleLevel = (level: string) =>
    setOpenLevels((prev) => ({ ...prev, [level]: !prev[level] }))

  const toggleRow = (slotKey: string) =>
    setExpandedRowId((prev) => (prev === slotKey ? null : slotKey))

  const handleView = useCallback(
    (versionId: string, entityType: string, entityCode: string) => {
      setViewerState({
        url: buildDocUrl(versionId, entityType, entityCode),
        title: 'Beleidsdocument',
      })
    },
    [],
  )

  const handleDownload = useCallback(
    async (
      versionId: string,
      filename: string,
      entityType: string,
      entityCode: string,
    ) => {
      if (!accessToken) {
        toast.error('Geen sessie')
        return
      }
      try {
        const response = await fetch(buildDocUrl(versionId, entityType, entityCode), {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        })
        if (!response.ok) {
          throw new Error(`Download faalde (${response.status})`)
        }
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(blobUrl)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Download faalde')
      }
    },
    [accessToken],
  )

  if (overview.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Overzicht laden…
      </div>
    )
  }
  if (overview.isError || !overview.data) {
    return (
      <div className="py-8 text-red-500">
        Kon overzicht niet laden.{' '}
        <button
          type="button"
          onClick={() => overview.refetch()}
          className="underline"
        >
          Probeer opnieuw
        </button>
      </div>
    )
  }

  const { landelijk, provinciaal, gemeentelijk, totals } = overview.data

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-500">
          {totals.total_docs} documenten · {totals.total_gemeenten} gemeenten
          {totals.latest_upload_at && (
            <> · laatste upload {formatRelativeNL(totals.latest_upload_at)}</>
          )}
        </p>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0E1111] px-4 py-2 text-[12px] font-bold text-white hover:opacity-90"
        >
          <Plus size={14} strokeWidth={2.5} /> Upload document
        </button>
      </div>

      <div className="space-y-3">
        <CascadeLevelAccordion
          icon={Landmark}
          title="Landelijk"
          description="Nederland-brede documenten — BENG, klimaatakkoord, nationale omgevingsvisie. Zichtbaar bij alle klanten."
          count={`${landelijk.length} docs`}
          isOpen={!!openLevels.landelijk}
          onToggle={() => toggleLevel('landelijk')}
        >
          <LevelBody
            rows={landelijk}
            expandedRowId={expandedRowId}
            onToggleRow={toggleRow}
            onView={handleView}
            onDownload={handleDownload}
          />
        </CascadeLevelAccordion>

        <CascadeLevelAccordion
          icon={Building2}
          title="Provinciaal"
          description="Omgevingsvisies en woonagenda's per provincie. Zichtbaar bij klanten binnen die provincie."
          count={`${provinciaal.length} docs · ${new Set(provinciaal.map((r) => r.entity_code)).size} provincies`}
          isOpen={!!openLevels.provincie}
          onToggle={() => toggleLevel('provincie')}
        >
          <LevelBody
            rows={provinciaal}
            expandedRowId={expandedRowId}
            onToggleRow={toggleRow}
            onView={handleView}
            onDownload={handleDownload}
          />
        </CascadeLevelAccordion>

        <CascadeLevelAccordion
          icon={MapPin}
          title="Gemeentelijk"
          description="Woonvisies, omgevingsplannen, huisvestingsverordeningen. Zichtbaar bij klanten binnen die gemeente. Auto-geïmporteerde docs tonen een 'Auto' pill."
          count={`${gemeentelijk.length} docs · ${new Set(gemeentelijk.map((r) => r.entity_code)).size} gemeenten`}
          isOpen={!!openLevels.gemeente}
          onToggle={() => toggleLevel('gemeente')}
        >
          <LevelBody
            rows={gemeentelijk}
            expandedRowId={expandedRowId}
            onToggleRow={toggleRow}
            onView={handleView}
            onDownload={handleDownload}
          />
        </CascadeLevelAccordion>
      </div>

      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        gemeenten={gemeentenQuery.data ?? []}
      />

      {viewerState && (
        <PDFViewerModal
          url={viewerState.url}
          title={viewerState.title}
          onClose={() => setViewerState(null)}
        />
      )}
    </div>
  )
}

interface LevelBodyProps {
  rows: AdminPolicyOverviewRow[]
  expandedRowId: string | null
  onToggleRow: (slotKey: string) => void
  onView: (versionId: string, entityType: string, entityCode: string) => void
  onDownload: (
    versionId: string,
    filename: string,
    entityType: string,
    entityCode: string,
  ) => void
}

function LevelBody({
  rows,
  expandedRowId,
  onToggleRow,
  onView,
  onDownload,
}: LevelBodyProps) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-slate-400">Nog geen documenten op dit niveau.</p>
  }
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const slotKey = `${row.entity_type}|${row.entity_code}|${row.source_key}`
        const expanded = expandedRowId === slotKey
        return (
          <div key={slotKey}>
            <DocumentRow
              row={row}
              isExpanded={expanded}
              onToggle={() => onToggleRow(slotKey)}
              onView={onView}
              onDownload={onDownload}
            />
            {expanded && (
              <VersionHistoryPanel
                entityType={row.entity_type}
                entityCode={row.entity_code}
                sourceKey={row.source_key}
                latestVersionNumber={row.latest_version_number}
                onView={onView}
                onDownload={onDownload}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
