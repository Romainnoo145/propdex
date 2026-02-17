import { createFileRoute } from '@tanstack/react-router'
import ResultsShell from '@/components/layout/ResultsShell'

export const Route = createFileRoute('/_authenticated/instellingen')({
  component: InstellingenPage,
})

function InstellingenPage() {
  return (
    <ResultsShell>
      <div className="flex h-full items-center justify-center">
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center backdrop-blur-xl">
          <h1 className="text-2xl font-semibold text-white">Instellingen</h1>
          <p className="mt-2 text-white/70">Binnenkort beschikbaar</p>
        </div>
      </div>
    </ResultsShell>
  )
}
