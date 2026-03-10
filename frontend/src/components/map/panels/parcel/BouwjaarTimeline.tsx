interface BouwjaarTimelineProps {
  bouwjaar: number | null
}

const CURRENT_YEAR = 2026
const SCALE_START = 1850
const SCALE_END = 2030
const SCALE_RANGE = SCALE_END - SCALE_START

function pct(year: number): number {
  return ((year - SCALE_START) / SCALE_RANGE) * 100
}

/** Generate ruler ticks — major every 10 years, minor every 2 years */
function buildTicks(): { pct: number; major: boolean }[] {
  const ticks: { pct: number; major: boolean }[] = []
  for (let y = SCALE_START; y <= SCALE_END; y += 2) {
    ticks.push({ pct: pct(y), major: y % 10 === 0 })
  }
  return ticks
}

const TICKS = buildTicks()
const LABEL_YEARS = [1850, 1900, 1950, 2000, CURRENT_YEAR]

export function BouwjaarTimeline({ bouwjaar }: BouwjaarTimelineProps) {
  if (bouwjaar === null) {
    return (
      <div className="relative h-16 w-full flex items-center">
        <div className="h-4 w-full rounded-sm bg-slate-50" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-400">
          Onbekend
        </span>
      </div>
    )
  }

  const age = CURRENT_YEAR - bouwjaar
  const startPct = pct(bouwjaar)
  const endPct = pct(CURRENT_YEAR)

  return (
    <div className="w-full pt-10 pb-6">
      <div className="relative w-full h-20 flex flex-col justify-end">
        {/* Left pill — bouwjaar */}
        <div
          className="absolute top-0 -translate-x-1/2 z-10"
          style={{ left: `${startPct}%` }}
        >
          <div className="relative bg-black text-white px-2.5 py-1 rounded-sm">
            <span
              className="text-[10px] font-black tracking-wider"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {bouwjaar}
            </span>
            <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] bg-black rotate-45" />
          </div>
        </div>

        {/* Right pill — age */}
        <div
          className="absolute top-0 -translate-x-1/2 z-10"
          style={{ left: `${endPct}%` }}
        >
          <div className="relative bg-black text-white px-2.5 py-1 rounded-sm">
            <span
              className="text-[10px] font-black tracking-wider"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {age} jaar
            </span>
            <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] bg-black rotate-45" />
          </div>
        </div>

        {/* Ruler body — the physical track */}
        <div className="relative w-full h-6 rounded-sm overflow-hidden">
          {/* Tick marks — the ruler rhythm */}
          <div className="absolute inset-0 flex items-end">
            {TICKS.map((tick, i) => (
              <div
                key={i}
                className="absolute bottom-0"
                style={{
                  left: `${tick.pct}%`,
                  width: tick.major ? '1.5px' : '1px',
                  height: tick.major ? '100%' : '50%',
                  background: tick.major ? '#cbd5e1' : '#e2e8f0',
                }}
              />
            ))}
          </div>

          {/* Amber overlay — the life-cycle fill */}
          <div
            className="absolute top-0 h-full"
            style={{
              left: `${startPct}%`,
              width: `${endPct - startPct}%`,
              background: 'rgba(249, 168, 38, 0.85)',
              boxShadow: '0 0 12px rgba(249,168,38,0.4)',
            }}
          />
        </div>
      </div>

      {/* Year labels beneath ruler */}
      <div className="relative w-full mt-2.5">
        {LABEL_YEARS.map((year) => (
          <span
            key={year}
            className="absolute -translate-x-1/2 text-[9px] font-black tracking-widest text-slate-300 tabular-nums"
            style={{
              left: `${pct(year)}%`,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {year}
          </span>
        ))}
      </div>
    </div>
  )
}
