import type { FacetItem, ExplorerRuling } from '@/hooks/useExplorer'

interface BenchmarkBarProps {
  uitkomstFacets: FacetItem[]
  totalCount: number
  results: ExplorerRuling[]
}

/**
 * Donut chart showing outcome distribution — sits right-aligned in the hero.
 * Three segments: emerald (toegewezen), red-500 (afgewezen), amber (gedeeltelijk).
 * Center shows total decided count.
 */
export default function BenchmarkBar({ uitkomstFacets }: BenchmarkBarProps) {
  const toegewezen = uitkomstFacets.find((f) => f.value === 'toegewezen')?.count ?? 0
  const afgewezen = uitkomstFacets.find((f) => f.value === 'afgewezen')?.count ?? 0
  const gedeeltelijk = uitkomstFacets.find((f) => f.value === 'gedeeltelijk')?.count ?? 0

  const decided = toegewezen + afgewezen + gedeeltelijk
  if (decided === 0) return null

  // SVG donut math
  const r = 38
  const circumference = 2 * Math.PI * r

  const segments = [
    { count: toegewezen, color: '#22c55e', label: 'toegewezen' },  // emerald-500
    { count: gedeeltelijk, color: '#F9A826', label: 'gedeeltelijk' },
    { count: afgewezen, color: '#ef4444', label: 'afgewezen' },    // red-500
  ].filter(s => s.count > 0)

  // Calculate offsets for each segment
  let accumulated = 0
  const arcs = segments.map(s => {
    const frac = s.count / decided
    const dashLen = frac * circumference
    const offset = circumference - accumulated * circumference
    accumulated += frac
    return { ...s, dashLen, offset, frac }
  })

  return (
    <div className="flex items-center gap-4">
      {/* Donut */}
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 96 96" className="h-[88px] w-[88px]" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          {/* Segments */}
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="48"
              cy="48"
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth="8"
              strokeDasharray={`${arc.dashLen} ${circumference - arc.dashLen}`}
              strokeDashoffset={arc.offset}
            />
          ))}
        </svg>
        <span className="absolute text-[20px] font-black tabular-nums leading-none text-[#0E1111]">
          {decided}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="tabular-nums font-semibold text-[#0E1111]">{s.count}</span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
