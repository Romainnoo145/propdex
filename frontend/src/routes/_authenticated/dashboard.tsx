import { createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <ResultsShell>
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-neutral-200 bg-aura-glass-white/60 p-8 text-center">
          <h1 className="text-2xl font-semibold text-aura-ink">Dashboard</h1>
          <p className="mt-2 text-neutral-600">Binnenkort beschikbaar</p>
        </div>
      </div>
    </ResultsShell>
  )
}
