/**
 * GemeenteSourcesView — extracted gemeente body (M049/S03, generalized in scope-consolidation).
 *
 * Renders the full A/B/C catalog for one gemeente: 3 DataSourceSections
 * (Beleidsdocumenten / Open API-bronnen / Betaalde integraties) + all modals
 * (Upload / VersionHistory / Credential / ActionItem). Reused by the generalized
 * $entityType/$entityCode route for the `gemeente` branch.
 *
 * Caller (route) renders the ScopePicker + page header above this component.
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  dataSourcesAdminKeys,
  useGemeenteDataSources,
  useGemeentenSummary,
  useRefreshDataSource,
} from '@/lib/queries/data-sources-admin'
import { UploadDocumentModal, type GemeenteEntry } from '@/components/settings/beleid/UploadDocumentModal'
import { VersionHistoryPanel } from '@/components/settings/beleid/VersionHistoryPanel'
import { CredentialConfigModal } from '@/components/settings/CredentialConfigModal'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchPolicyDocumentBlob } from '@/lib/api'
import { ActionItemDetailModal } from '@/components/settings/data-bronnen/ActionItemDetailModal'
import { DataSourceRow } from '@/components/settings/data-bronnen/DataSourceRow'
import { DataSourceSection } from '@/components/settings/data-bronnen/DataSourceSection'
import { DataSourcesEmptyState } from '@/components/settings/data-bronnen/DataSourcesEmptyState'

interface Props {
  gemeenteCode: string
}

export function GemeenteSourcesView({ gemeenteCode }: Props) {
  const gemeentenQuery = useGemeentenSummary()
  const dataSourcesQuery = useGemeenteDataSources(gemeenteCode)

  // All hooks must be called unconditionally (React rules) — before any early returns
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const refreshMutation = useRefreshDataSource()

  // Open a document version inline in a new tab.
  const handleViewVersion = async (
    versionId: string,
    entityType: string,
    entityCode: string,
  ) => {
    const blob = await fetchPolicyDocumentBlob(entityType, entityCode, versionId, accessToken)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    // Revoke after a tick so the new tab has loaded the blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  // Download a document version with its original filename.
  const handleDownloadVersion = async (
    versionId: string,
    filename: string,
    entityType: string,
    entityCode: string,
  ) => {
    const blob = await fetchPolicyDocumentBlob(entityType, entityCode, versionId, accessToken)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename || 'document.pdf'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const [openUploadFor, setOpenUploadFor] = useState<string | null>(null)
  const [openVersionsFor, setOpenVersionsFor] = useState<string | null>(null)
  const [credentialSourceKey, setCredentialSourceKey] = useState<string | null>(
    null,
  )
  const [actionItemSourceKey, setActionItemSourceKey] = useState<string | null>(
    null,
  )

  if (dataSourcesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Bronnen laden…
      </div>
    )
  }
  if (dataSourcesQuery.isError || !dataSourcesQuery.data) {
    return (
      <div className="py-8 text-red-500">
        Kon bronnen niet laden voor {gemeenteCode}.{' '}
        <button
          type="button"
          onClick={() => void dataSourcesQuery.refetch()}
          className="underline"
        >
          Probeer opnieuw
        </button>
      </div>
    )
  }

  const payload = dataSourcesQuery.data

  const handleUploadSuccess = (sourceKey: string) => {
    // 1. Invalidate data-bronnen hub query so row re-fetches with new status
    void queryClient.invalidateQueries({ queryKey: dataSourcesAdminKeys.gemeente(gemeenteCode) })
    // 2. INT-04: Trigger Type A probe — probe sees the new PolicyDocument row and flips status to 'live'
    refreshMutation.mutate({
      gemeenteCode,
      sourceKey,
      sourceLabel: 'Beleidsdocument',
    })
  }

  // Build GemeenteEntry array for UploadDocumentModal (compatible shape)
  const gemeentenForModal: GemeenteEntry[] = (gemeentenQuery.data ?? []).map((g) => ({
    code: g.gemeente_code,
    naam: g.gemeente_naam,
    provincie_code: '',   // not available from S02 summary; UploadDocumentModal only uses code for entity_code
  }))

  const currentGemeenteEntry: GemeenteEntry | undefined = gemeentenForModal.find(
    (g) => g.code === gemeenteCode,
  )

  const totalRows =
    payload.cascade_uploads.length +
    payload.open_apis.length +
    payload.paid_integrations.length

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[22px] font-black tracking-tight text-[#0E1111]">
          Data-bronnen · {payload.gemeente_naam}
        </h1>
        <p className="text-[14px] text-slate-500">
          Vendor-managed catalog van scoring-bronnen per gemeente.
        </p>
      </header>

      {totalRows === 0 ? (
        <DataSourcesEmptyState />
      ) : (
        <div className="space-y-8">
          <DataSourceSection
            title="Beleidsdocumenten"
            count={payload.cascade_uploads.length}
            completed={payload.cascade_uploads.filter((r) => r.status === 'live').length}
          >
            {payload.cascade_uploads.map((row) => (
              <DataSourceRow
                key={row.source_key}
                gemeenteCode={gemeenteCode}
                row={row}
                onUpload={(sk) => setOpenUploadFor(sk)}
                onViewVersions={(sk) => setOpenVersionsFor(sk)}
                onConfigureCredential={(sk) => setCredentialSourceKey(sk)}
                onViewActionItem={(sk) => setActionItemSourceKey(sk)}
              />
            ))}
          </DataSourceSection>

          <DataSourceSection
            title="Open API-bronnen"
            count={payload.open_apis.length}
            completed={payload.open_apis.filter((r) => r.status === 'live').length}
          >
            {payload.open_apis.map((row) => (
              <DataSourceRow
                key={row.source_key}
                gemeenteCode={gemeenteCode}
                row={row}
                onUpload={(sk) => setOpenUploadFor(sk)}
                onViewVersions={(sk) => setOpenVersionsFor(sk)}
                onConfigureCredential={(sk) => setCredentialSourceKey(sk)}
                onViewActionItem={(sk) => setActionItemSourceKey(sk)}
              />
            ))}
          </DataSourceSection>

          <DataSourceSection
            title="Betaalde integraties"
            count={payload.paid_integrations.length}
            completed={payload.paid_integrations.filter((r) => r.status === 'live').length}
          >
            {payload.paid_integrations.map((row) => (
              <DataSourceRow
                key={row.source_key}
                gemeenteCode={gemeenteCode}
                row={row}
                onUpload={(sk) => setOpenUploadFor(sk)}
                onViewVersions={(sk) => setOpenVersionsFor(sk)}
                onConfigureCredential={(sk) => setCredentialSourceKey(sk)}
                onViewActionItem={(sk) => setActionItemSourceKey(sk)}
              />
            ))}
          </DataSourceSection>
        </div>
      )}

      {/* UploadDocumentModal — mounted at page level, one instance (eng-review §3) */}
      <UploadDocumentModal
        open={openUploadFor !== null}
        onClose={() => setOpenUploadFor(null)}
        gemeenten={gemeentenForModal}
        initialGemeente={currentGemeenteEntry}
        initialSourceKey={openUploadFor ?? undefined}
        onSuccess={() => {
          if (openUploadFor) handleUploadSuccess(openUploadFor)
        }}
      />

      {/* CredentialConfigModal — M049/S05 Type-C credentials (BRK / Vindsubsidies / NVM) */}
      <CredentialConfigModal
        open={credentialSourceKey !== null}
        onClose={() => setCredentialSourceKey(null)}
        sourceKey={credentialSourceKey}
      />

      {/* ActionItemDetailModal — M049/S06: surfaces migrated ActionItem content per row */}
      <ActionItemDetailModal
        open={actionItemSourceKey !== null}
        onClose={() => setActionItemSourceKey(null)}
        sourceKey={actionItemSourceKey}
      />

      {/* VersionHistoryPanel — modal overlay mode (plan 04-02 extension) */}
      <VersionHistoryPanel
        open={openVersionsFor !== null}
        onClose={() => setOpenVersionsFor(null)}
        gemeenteCode={gemeenteCode}
        sourceKey={openVersionsFor ?? ''}
        entityType="gemeente"
        entityCode={gemeenteCode}
        latestVersionNumber={1}
        onView={handleViewVersion}
        onDownload={handleDownloadVersion}
      />
    </div>
  )
}
