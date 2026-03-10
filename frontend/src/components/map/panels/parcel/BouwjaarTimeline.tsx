interface BouwjaarTimelineProps {
  bouwjaar: number | null
}

const RANGE_START = 1850
const RANGE_END = 2030
const RANGE = RANGE_END - RANGE_START

/** Decades to show tick marks for */
const DECADES = [1900, 1950, 1970, 2000, 2025]

function pct(year: number): number {
  return ((year - RANGE_START) / RANGE) * 100
}

export function BouwjaarTimeline({ bouwjaar }: BouwjaarTimelineProps) {
  if (bouwjaar === null) {
    return (
      <div className="relative h-12 w-full">
        <div className="absolute top-4 h-[2px] w-full rounded-full bg-slate-200" />
        <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-400">
          Onbekend
        </span>
      </div>
    )
  }

  const startPct = pct(bouwjaar)
  const endPct = pct(2026)

  return (
    <div className="relative h-14 w-full">
      {/* Base track */}
      <div className="absolute top-5 h-[2px] w-full rounded-full bg-slate-200" />

      {/* Decade ticks */}
      {DECADES.map((d) => (
        <div key={d} className="absolute top-3" style={{ left: `${pct(d)}%` }}>
          <div className="h-3 w-px bg-slate-200" />
          <span className="absolute top-3.5 -translate-x-1/2 text-[9px] text-slate-300">
            {d}
          </span>
        </div>
      ))}

      {/* Amber range bar */}
      <div
        className="absolute top-[17px] h-[6px] rounded-full bg-[#F9A826]"
        style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
      />

      {/* Start pill */}
      <div
        className="absolute top-0 -translate-x-1/2"
        style={{ left: `${startPct}%` }}
      >
        <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-medium text-white">
          {bouwjaar}
        </span>
      </div>

      {/* End pill */}
      <div
        className="absolute top-0 -translate-x-1/2"
        style={{ left: `${endPct}%` }}
      >
        <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-medium text-white">
          2026
        </span>
      </div>
    </div>
  )
}
