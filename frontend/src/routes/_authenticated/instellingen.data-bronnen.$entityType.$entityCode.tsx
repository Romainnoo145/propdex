/**
 * /instellingen/data-bronnen/$entityType/$entityCode — generalized scope route
 * (scope-consolidation, supersedes the old $gemeenteCode route).
 *
 * Delegates its body to the reusable ScopeDataSourcesView (also rendered inside
 * ScopeDetailModal). Superuser-gated via beforeLoad.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'
import type { EntityType } from '@/lib/types/data-sources-admin'
import { ScopeDataSourcesView } from '@/components/settings/data-bronnen/ScopeDataSourcesView'

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
  return <ScopeDataSourcesView entityType={entityType} entityCode={entityCode} />
}
