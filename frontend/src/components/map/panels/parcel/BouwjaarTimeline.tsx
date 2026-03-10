interface BouwjaarTimelineProps {
  bouwjaar: number | null
}

const CURRENT_YEAR = 2026
const SCALE_START = 1850
const SCALE_END = 2030
const SCALE_RANGE = SCALE_END - SCALE_START

/** Total number of minor ticks across the ruler */
const TICK_COUNT = 36 // ~5 year intervals across 180 year range
const MAJOR_INTERVAL = 4 // every 4th tick is major (~20 years)

function pct(year: number): number {
  return ((year - SCALE_START) / SCALE_RANGE) * 100
}

/** Generate ruler ticks with major/minor distinction */
function getRulerTicks(): { pct: number; major: boolean }[] {
  const ticks: { pct: number; major: boolean }[] = []
  for (let i = 0; i <= TICK_COUNT; i++) {
    ticks.push({
      pct: (i / TICK_COUNT) * 100,
      major: i % MAJOR_INTERVAL === 0,
    })
  }
  return ticks
}

const RULER_TICKS = getRulerTicks()
const LABEL_YEARS = [1850, 1900, 1950, 2000, CURRENT_YEAR]

export function BouwjaarTimeline({ bouwjaar }: BouwjaarTimelineProps) {
  if (bouwjaar === null) {
    return (
      <div className="relative h-16 w-full flex items-center">
        <div className="h-[2px] w-full rounded-full bg-slate-200" />
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
      {/* Ruler container */}
      <div className="relative w-full h-[24px]">
        {/* Tick marks — the ruler rhythm */}
        {RULER_TICKS.map((tick, i) => (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: `${tick.pct}%`,
              width: tick.major ? '1.5px' : '1px',
              height: tick.major ? 16 : 8,
              background: tick.major ? '#cbd5e1' : '#e2e8f0',
            }}
          />
        ))}

        {/* Baseline — thin ruler edge */}
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-slate-200" />

        {/* Amber life-cycle bar */}
        <div
          className="absolute bottom-[-2px] h-[6px] rounded-full"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            background: '#F9A826',
            boxShadow: '0 0 12px rgba(249,168,38,0.4)',
          }}
        />

        {/* Left black pill — bouwjaar */}
        <div
          className="absolute -top-2 -translate-x-1/2"
          style={{ left: `${startPct}%` }}
        >
          <div className="relative bg-black text-white px-2.5 py-1 rounded-md whitespace-nowrap">
            <span
              className="text-[10px] font-black tracking-wider"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {bouwjaar}
            </span>
            <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] bg-black rotate-45 rounded-[1px]" />
          </div>
        </div>

        {/* Right black pill — age */}
        <div
          className="absolute -top-2 translate-x-[-50%]"
          style={{ left: `${endPct}%` }}
        >
          <div className="relative bg-black text-white px-2.5 py-1 rounded-md whitespace-nowrap">
            <span
              className="text-[10px] font-black tracking-wider"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {age} jaar
            </span>
            <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] bg-black rotate-45 rounded-[1px]" />
          </div>
        </div>
      </div>

      {/* Year labels beneath ruler */}
      <div className="relative w-full mt-3">
        {LABEL_YEARS.map((year) => (
          <span
            key={year}
            className="absolute -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest text-slate-300 tabular-nums"
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
