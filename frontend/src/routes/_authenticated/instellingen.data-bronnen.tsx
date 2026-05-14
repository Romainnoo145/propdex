/**
 * /instellingen/data-bronnen — index route (M049/S03)
 *
 * Loads gemeente summaries and redirects to the first gemeente_code
 * available (sorted last_activity_at DESC server-side). If no gemeenten
 * exist yet, renders DataSourcesEmptyState. Superuser-gated.
 */
import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useGemeentenSummary } from '@/lib/queries/data-sources-admin'
import { DataSourcesEmptyState } from '@/components/settings/data-bronnen/DataSourcesEmptyState'

export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen',
)({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) {
      throw redirect({ to: '/instellingen' })
    }
  },
  component: DataBronnenIndexPage,
})

function DataBronnenIndexPage() {
  const navigate = useNavigate()
  const gemeentenQuery = useGemeentenSummary()

  const gemeenten = gemeentenQuery.data ?? []
  const firstGemeenteCode = gemeenten[0]?.gemeente_code

  // Auto-redirect to first gemeente when summary loads
  useEffect(() => {
    if (firstGemeenteCode) {
      void navigate({
        to: '/instellingen/data-bronnen/$gemeenteCode',
        params: { gemeenteCode: firstGemeenteCode },
        replace: true,
      })
    }
  }, [firstGemeenteCode, navigate])

  if (gemeentenQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Gemeenten laden…
      </div>
    )
  }
  if (gemeentenQuery.isError) {
    return (
      <div className="py-8 text-red-500">
        Kon gemeenten niet laden.{' '}
        <button
          type="button"
          onClick={() => void gemeentenQuery.refetch()}
          className="underline"
        >
          Probeer opnieuw
        </button>
      </div>
    )
  }
  if (gemeenten.length === 0) {
    return <DataSourcesEmptyState />
  }
  // While auto-redirect effect runs, render a transient spinner
  const firstName = gemeenten[0]?.gemeente_naam ?? firstGemeenteCode
  return (
    <div className="flex items-center gap-2 py-8 text-slate-500">
      <Loader2 size={16} className="animate-spin" /> Omleiden naar {firstName}…
    </div>
  )
}
