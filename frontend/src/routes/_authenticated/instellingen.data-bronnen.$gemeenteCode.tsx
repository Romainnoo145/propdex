/**
 * /instellingen/data-bronnen/$gemeenteCode — detail route (M049/S03)
 *
 * Renders GemeentePicker + 3 DataSourceSection (Beleidsdocumenten / Open
 * API-bronnen / Betaalde integraties). Section titles locked in
 * 03-CONTEXT.md §6. Empty-state when all 3 sections have zero rows.
 *
 * Path-param validation: ^GM\d{4}$ via parseParams.
 * Superuser-gated via beforeLoad (mirrors instellingen.beleid-beheer.tsx).
 */
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
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
import { DataSourceRow } from '@/components/settings/data-bronnen/DataSourceRow'
import { DataSourceSection } from '@/components/settings/data-bronnen/DataSourceSection'
import { GemeentePicker } from '@/components/settings/data-bronnen/GemeentePicker'
import { DataSourcesEmptyState } from '@/components/settings/data-bronnen/DataSourcesEmptyState'

const GEMEENTE_CODE_RE = /^GM\d{4}$/

export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen/$gemeenteCode',
)({
  parseParams: (params) => {
    if (!GEMEENTE_CODE_RE.test(params.gemeenteCode)) {
      throw new Error(`Invalid gemeente code: ${params.gemeenteCode}`)
    }
    return { gemeenteCode: params.gemeenteCode }
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) {
      throw redirect({ to: '/instellingen' })
    }
  },
  component: GemeenteDataSourcesPage,
})

function GemeenteDataSourcesPage() {
  const { gemeenteCode } = Route.useParams()
  const gemeentenQuery = useGemeentenSummary()
  const dataSourcesQuery = useGemeenteDataSources(gemeenteCode)

  // All hooks must be called unconditionally (React rules) — before any early returns
  const queryClient = useQueryClient()
  const refreshMutation = useRefreshDataSource()
  const [openUploadFor, setOpenUploadFor] = useState<string | null>(null)
  const [openVersionsFor, setOpenVersionsFor] = useState<string | null>(null)
  const [credentialSourceKey, setCredentialSourceKey] = useState<string | null>(
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
        <h1 className="text-[20px] font-semibold text-[#0E1111]">
          Data-bronnen · {payload.gemeente_naam}
        </h1>
        <p className="text-[12px] text-slate-500">
          Vendor-managed catalog van scoring-bronnen per gemeente.
        </p>
      </header>

      {gemeentenQuery.data && gemeentenQuery.data.length > 0 && (
        <GemeentePicker
          gemeenten={gemeentenQuery.data}
          activeGemeenteCode={gemeenteCode}
        />
      )}

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

      {/* VersionHistoryPanel — modal overlay mode (plan 04-02 extension) */}
      <VersionHistoryPanel
        open={openVersionsFor !== null}
        onClose={() => setOpenVersionsFor(null)}
        gemeenteCode={gemeenteCode}
        sourceKey={openVersionsFor ?? ''}
        entityType="gemeente"
        entityCode={gemeenteCode}
        latestVersionNumber={1}
        onView={() => {}}
        onDownload={() => {}}
      />
    </div>
  )
}
