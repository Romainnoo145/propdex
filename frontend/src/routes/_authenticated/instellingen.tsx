import { Outlet, createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'
import { SettingsTabNav } from '@/components/settings/SettingsTabNav'

export const Route = createFileRoute('/_authenticated/instellingen')({
  component: InstellingenLayout,
})

function InstellingenLayout() {
  return (
    <ResultsShell>
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-5 py-4">
        <h1 className="text-2xl font-semibold text-aura-ink">Instellingen</h1>
        <p className="mt-1 text-neutral-600">Beheer je account en voorkeuren</p>
      </div>
      <SettingsTabNav />
      <div className="mt-6 max-w-3xl pb-8">
        <Outlet />
      </div>
    </ResultsShell>
  )
}
