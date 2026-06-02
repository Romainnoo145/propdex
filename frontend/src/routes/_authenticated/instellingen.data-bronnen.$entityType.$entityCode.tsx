/**
 * /instellingen/data-bronnen/$entityType/$entityCode — generalized scope route
 * (scope-consolidation, supersedes the old $gemeenteCode route).
 *
 * Branches on entityType:
 *   - gemeente  → full A/B/C catalog (GemeenteSourcesView).
 *   - landelijk → type-A document rows only (cascade_uploads).
 *   - provincie → type-A document rows only (cascade_uploads).
 *
 * ScopePicker renders at the top of both branches. Superuser-gated via beforeLoad.
 */
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
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
import { ScopePicker } from '@/components/settings/data-bronnen/ScopePicker'

const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'gemeente',
  'landelijk',
  'provincie',
])

export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen/$entityType/$entityCode',
)({
  parseParams: (params) => {
    if (!VALID_ENTITY_TYPES.has(params.entityType)) {
      throw new Error(`Invalid entity type: ${params.entityType}`)
    }
    return {
      entityType: params.entityType as EntityType,
      entityCode: params.entityCode,
    }
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) {
      throw redirect({ to: '/instellingen' })
    }
  },
  component: ScopeDataSourcesPage,
})

function ScopeDataSourcesPage() {
  const { entityType, entityCode } = Route.useParams()

  return (
    <div className="space-y-6">
      <ScopePicker activeEntityType={entityType} activeEntityCode={entityCode} />

      {entityType === 'gemeente' ? (
        <GemeenteSourcesView gemeenteCode={entityCode} />
      ) : (
        <ScopeDocumentsView entityType={entityType} entityCode={entityCode} />
      )}
    </div>
  )
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
        <h1 className="text-[20px] font-semibold text-[#0E1111]">
          Data-bronnen · {payload.entity_naam}
        </h1>
        <p className="text-[12px] text-slate-500">
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

      {/* UploadDocumentModal — niveau defaults internally; admin selects entity. */}
      <UploadDocumentModal
        open={openUploadFor !== null}
        onClose={() => setOpenUploadFor(null)}
        gemeenten={gemeentenForModal}
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
