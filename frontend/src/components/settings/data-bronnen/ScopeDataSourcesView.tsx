/**
 * ScopeDataSourcesView — scope-detail body extracted from the
 * /instellingen/data-bronnen/$entityType/$entityCode route so it can be
 * reused both in the route and inside ScopeDetailModal (pop-up).
 *
 * Branches on entityType:
 *   - gemeente  → full A/B/C catalog (GemeenteSourcesView).
 *   - landelijk → type-A document rows only (cascade_uploads).
 *   - provincie → type-A document rows only (cascade_uploads).
 *
 * Detail-only: no ScopePicker / ScopeHub inside (the modal supplies its own
 * chrome). Keeps a compact heading so the route still shows one.
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  dataSourcesAdminKeys,
  useGemeentenSummary,
  useScopeDataSources,
} from '@/lib/queries/data-sources-admin'
import type { EntityType } from '@/lib/types/data-sources-admin'
import { UploadDocumentModal, type GemeenteEntry } from '@/components/settings/beleid/UploadDocumentModal'
import { VersionHistoryPanel } from '@/components/settings/beleid/VersionHistoryPanel'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchPolicyDocumentBlob } from '@/lib/api'
import { DataSourceRow } from '@/components/settings/data-bronnen/DataSourceRow'
import { DataSourceSection } from '@/components/settings/data-bronnen/DataSourceSection'
import { GemeenteSourcesView } from '@/components/settings/data-bronnen/GemeenteSourcesView'

export function ScopeDataSourcesView({
  entityType,
  entityCode,
}: {
  entityType: EntityType
  entityCode: string
}) {
  if (entityType === 'gemeente') {
    return <GemeenteSourcesView gemeenteCode={entityCode} />
  }
  return <ScopeDocumentsView entityType={entityType} entityCode={entityCode} />
}

/**
 * Type-A only view for landelijk / provincie scopes: a single Beleidsdocumenten
 * section plus the Upload + VersionHistory modals. No open_apis / paid_integrations.
 */
function ScopeDocumentsView({
  entityType,
  entityCode,
}: {
  entityType: EntityType
  entityCode: string
}) {
  const dataSourcesQuery = useScopeDataSources(entityType, entityCode)
  const gemeentenQuery = useGemeentenSummary()
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const [openUploadFor, setOpenUploadFor] = useState<string | null>(null)
  const [openVersionsFor, setOpenVersionsFor] = useState<string | null>(null)

  const handleViewVersion = async (
    versionId: string,
    et: string,
    ec: string,
  ) => {
    const blob = await fetchPolicyDocumentBlob(et, ec, versionId, accessToken)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const handleDownloadVersion = async (
    versionId: string,
    filename: string,
    et: string,
    ec: string,
  ) => {
    const blob = await fetchPolicyDocumentBlob(et, ec, versionId, accessToken)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename || 'document.pdf'
    anchor.click()
    URL.revokeObjectURL(url)
  }

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
        Kon bronnen niet laden voor {entityCode}.{' '}
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

  // Upload modal needs a gemeenten list (for its gemeente niveau); pass the
  // summary list so the dropdown still works if the admin switches niveau.
  const gemeentenForModal: GemeenteEntry[] = (gemeentenQuery.data ?? []).map((g) => ({
    code: g.gemeente_code,
    naam: g.gemeente_naam,
    provincie_code: '',
  }))

  const handleUploadSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: dataSourcesAdminKeys.scope(entityType, entityCode),
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[22px] font-black tracking-tight text-[#0E1111]">
          Data-bronnen · {payload.entity_naam}
        </h1>
        <p className="text-[14px] text-slate-500">
          Vendor-managed beleidsdocumenten op{' '}
          {entityType === 'landelijk' ? 'landelijk' : 'provinciaal'} niveau.
        </p>
      </header>

      <DataSourceSection
        title="Beleidsdocumenten"
        count={payload.cascade_uploads.length}
        completed={payload.cascade_uploads.filter((r) => r.status === 'live').length}
      >
        {payload.cascade_uploads.map((row) => (
          <DataSourceRow
            key={row.source_key}
            gemeenteCode={entityCode}
            row={row}
            onUpload={(sk) => setOpenUploadFor(sk)}
            onViewVersions={(sk) => setOpenVersionsFor(sk)}
          />
        ))}
      </DataSourceSection>

      {/* UploadDocumentModal — prefill niveau + entity from the current scope. */}
      <UploadDocumentModal
        open={openUploadFor !== null}
        onClose={() => setOpenUploadFor(null)}
        gemeenten={gemeentenForModal}
        initialNiveau={entityType}
        initialEntityCode={entityCode}
        initialSourceKey={openUploadFor ?? undefined}
        onSuccess={handleUploadSuccess}
      />

      {/* VersionHistoryPanel — modal overlay mode, scope entityType/entityCode. */}
      <VersionHistoryPanel
        open={openVersionsFor !== null}
        onClose={() => setOpenVersionsFor(null)}
        sourceKey={openVersionsFor ?? ''}
        entityType={entityType}
        entityCode={entityCode}
        latestVersionNumber={1}
        onView={handleViewVersion}
        onDownload={handleDownloadVersion}
      />
    </div>
  )
}
