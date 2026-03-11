import { useEffect, useRef, useState } from 'react'
import { useSpring } from 'framer-motion'

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

/** Etched ticks inside the track — every 10 years */
function etchedTicks(): number[] {
  const ticks: number[] = []
  for (let y = SCALE_START; y <= SCALE_END; y += 10) {
    ticks.push(pct(y))
  }
  return ticks
}

const TICKS = etchedTicks()

/* ── Active Track ──────────────────────────────────────────── */

function ActiveTrack({ bouwjaar }: { bouwjaar: number }) {
  const age = CURRENT_YEAR - bouwjaar
  const startPct = pct(bouwjaar)
  const endPct = pct(CURRENT_YEAR)

  // Animated fill
  const fillSpring = useSpring(0, { stiffness: 100, damping: 24 })
  const [fillW, setFillW] = useState(0)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      const t = setTimeout(() => fillSpring.set(endPct - startPct), 150)
      return () => clearTimeout(t)
    }
    fillSpring.set(endPct - startPct)
    return undefined
  }, [startPct, endPct, fillSpring])

  useEffect(() => {
    const unsub = fillSpring.on('change', (v) => setFillW(v))
    return unsub
  }, [fillSpring])

  return (
    <div className="w-full py-4">
      {/* Compact header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-black text-slate-400 uppercase"
          style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Bouwjaar
        </span>
        <span
          className="bg-black text-white text-[10px] px-2.5 py-1 rounded-full font-black tabular-nums"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {age} jaar
        </span>
      </div>

      {/* The etched track */}
      <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        {/* Etched ticks — subtle white rhythm inside the track */}
        {TICKS.map((p, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{
              left: `${p}%`,
              width: '1px',
              background: 'rgba(255,255,255,0.7)',
              zIndex: 2,
            }}
          />
        ))}

        {/* Amber inlay — the life-span fill */}
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            left: `${startPct}%`,
            width: `${fillW}%`,
            background: '#F9A826',
            boxShadow: '0 0 8px rgba(249,168,38,0.3)',
            zIndex: 1,
          }}
        >
          {/* White marker — start edge */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2px] h-3 bg-white rounded-full" />
          {/* White marker — end edge */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-[2px] h-3 bg-white rounded-full" />
        </div>
      </div>

      {/* Year labels under markers */}
      <div className="relative w-full mt-1.5 h-3">
        <span
          className="absolute -translate-x-1/2 text-[10px] font-bold tabular-nums text-slate-400"
          style={{ left: `${startPct}%`, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {bouwjaar}
        </span>
        <span
          className="absolute -translate-x-1/2 text-[10px] font-bold tabular-nums text-slate-400"
          style={{ left: `${endPct}%`, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {CURRENT_YEAR}
        </span>
      </div>
    </div>
  )
}

/* ── Empty state ───────────────────────────────────────────── */

function EmptyTrack() {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-black text-slate-400 uppercase"
          style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Bouwjaar
        </span>
        <span
          className="bg-slate-100 text-slate-400 text-[10px] px-2.5 py-1 rounded-full font-black"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Onbekend
        </span>
      </div>
      <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        {TICKS.map((p, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{ left: `${p}%`, width: '1px', background: 'rgba(255,255,255,0.5)' }}
          />
        ))}
      </div>
    </div>
  )
}

/* ── Export ─────────────────────────────────────────────────── */

export function BouwjaarTimeline({ bouwjaar }: BouwjaarTimelineProps) {
  if (bouwjaar === null) return <EmptyTrack />
  return <ActiveTrack bouwjaar={bouwjaar} />
}
