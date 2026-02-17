import { createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <ResultsShell>
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-grey-800 bg-grey-900 p-8 text-center">
          <h1 className="text-2xl font-semibold text-grey-100">Dashboard</h1>
          <p className="mt-2 text-grey-400">Binnenkort beschikbaar</p>
        </div>
      </div>
    </ResultsShell>
  )
}
