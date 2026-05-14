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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import {
  useGemeenteDataSources,
  useGemeentenSummary,
} from '@/lib/queries/data-sources-admin'
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
          >
            {payload.cascade_uploads.map((row) => (
              <DataSourceRow
                key={row.source_key}
                gemeenteCode={gemeenteCode}
                row={row}
              />
            ))}
          </DataSourceSection>

          <DataSourceSection
            title="Open API-bronnen"
            count={payload.open_apis.length}
          >
            {payload.open_apis.map((row) => (
              <DataSourceRow
                key={row.source_key}
                gemeenteCode={gemeenteCode}
                row={row}
              />
            ))}
          </DataSourceSection>

          <DataSourceSection
            title="Betaalde integraties"
            count={payload.paid_integrations.length}
          >
            {payload.paid_integrations.map((row) => (
              <DataSourceRow
                key={row.source_key}
                gemeenteCode={gemeenteCode}
                row={row}
              />
            ))}
          </DataSourceSection>
        </div>
      )}
    </div>
  )
}
