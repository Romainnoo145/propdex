import type { FacetItem, ExplorerRuling } from '@/hooks/useExplorer'

interface BenchmarkBarProps {
  uitkomstFacets: FacetItem[]
  totalCount: number
  results: ExplorerRuling[]
}

export default function BenchmarkBar({ uitkomstFacets, totalCount, results }: BenchmarkBarProps) {
  const toegewezen = uitkomstFacets.find((f) => f.value === 'toegewezen')?.count ?? 0
  const afgewezen = uitkomstFacets.find((f) => f.value === 'afgewezen')?.count ?? 0
  const gedeeltelijk = uitkomstFacets.find((f) => f.value === 'gedeeltelijk')?.count ?? 0

  const decided = toegewezen + afgewezen + gedeeltelijk
  const winPct = decided > 0 ? Math.round((toegewezen / decided) * 100) : 0
  const lossPct = decided > 0 ? Math.round((afgewezen / decided) * 100) : 0
  const partialPct = decided > 0 ? Math.round((gedeeltelijk / decided) * 100) : 0

  // Average doorlooptijd from loaded results
  const doorlooptijdValues = results
    .map((r) => r.doorlooptijd_dagen)
    .filter((d): d is number => d != null)
  const avgDoorlooptijd =
    doorlooptijdValues.length > 0
      ? Math.round(doorlooptijdValues.reduce((a, b) => a + b, 0) / doorlooptijdValues.length)
      : null

  if (totalCount === 0) return null

  return (
    <div className="mb-4 rounded-lg border border-neutral-200 bg-aura-glass-white/60 p-4">
      <div className="flex flex-wrap items-center gap-6">
        <Stat value={totalCount} label="uitspraken" />

        <Divider />

        <Stat value={`${winPct}%`} label="toegewezen" className="text-emerald-400" />
        <Stat value={`${lossPct}%`} label="afgewezen" className="text-red-400" />
        {partialPct > 0 && (
          <Stat value={`${partialPct}%`} label="gedeeltelijk" className="text-amber-400" />
        )}

        {avgDoorlooptijd != null && (
          <>
            <Divider />
            <Stat value={avgDoorlooptijd} label="gem. dagen" />
          </>
        )}

        {/* Distribution bar */}
        {decided > 0 && (
          <div className="ml-auto hidden w-48 sm:block">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${winPct}%` }}
              />
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${partialPct}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${lossPct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
              <span>{toegewezen} gewonnen</span>
              <span>{afgewezen} verloren</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({
  value,
  label,
  className = 'text-aura-ink',
}: {
  value: number | string
  label: string
  className?: string
}) {
  return (
    <div>
      <p className={`text-xl font-bold tabular-nums ${className}`}>{value}</p>
      <p className="text-[11px] text-neutral-500">{label}</p>
    </div>
  )
}

function Divider() {
  return <div className="h-8 w-px bg-neutral-200" />
}
