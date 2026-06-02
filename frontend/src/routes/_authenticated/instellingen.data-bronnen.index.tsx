/**
 * /instellingen/data-bronnen/ — index handler (scope-consolidation).
 *
 * Landing surface for the data-bronnen hub: renders the ScopePicker so the
 * admin chooses Landelijk / Provincie / Gemeente. Empty-state when no
 * gemeenten exist yet. Superuser gate is enforced by the parent layout.
 */
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useGemeentenSummary } from '@/lib/queries/data-sources-admin'
import { DataSourcesEmptyState } from '@/components/settings/data-bronnen/DataSourcesEmptyState'
import { ScopePicker } from '@/components/settings/data-bronnen/ScopePicker'

export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen/',
)({
  component: DataBronnenIndexPage,
})

function DataBronnenIndexPage() {
  const gemeentenQuery = useGemeentenSummary()
  const gemeenten = gemeentenQuery.data ?? []

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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[20px] font-semibold text-[#0E1111]">Data-bronnen</h1>
        <p className="text-[12px] text-slate-500">
          Kies een scope om de bronnen te beheren.
        </p>
      </header>
      <ScopePicker />
    </div>
  )
}
