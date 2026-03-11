import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface ScoreGaugeProps {
  score: number | null
}

/** Score → color: red (0) → amber (50) → green (100) */
function scoreColor(score: number): string {
  if (score >= 70) return '#22C55E'   // vitality green
  if (score >= 40) return '#F9A826'   // warm amber
  return '#EF4444'                     // red
}

function scoreGlow(score: number): string {
  if (score >= 70) return 'rgba(34,197,94,0.4)'
  if (score >= 40) return 'rgba(249,168,38,0.4)'
  return 'rgba(239,68,68,0.3)'
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const normalised = score !== null ? Math.min(100, Math.max(0, Math.round(score))) : 0
  const r = 48
  const circumference = 2 * Math.PI * r
  const color = score !== null ? scoreColor(normalised) : '#F9A826'
  const glow = score !== null ? scoreGlow(normalised) : 'rgba(249,168,38,0.4)'

  // Animated number via spring
  const spring = useSpring(0, { stiffness: 60, damping: 20 })
  const display = useTransform(spring, (v) => Math.round(v))
  const [displayValue, setDisplayValue] = useState(0)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (score === null) return undefined
    // Small delay on first mount so the arc and number animate together
    if (!hasMounted.current) {
      hasMounted.current = true
      const t = setTimeout(() => spring.set(normalised), 300)
      return () => clearTimeout(t)
    }
    spring.set(normalised)
    return undefined
  }, [score, normalised, spring])

  useEffect(() => {
    const unsub = display.on('change', (v) => setDisplayValue(v))
    return unsub
  }, [display])

  return (
    <div className="relative flex items-center justify-center">
      <svg
        viewBox="0 0 120 120"
        className="h-[140px] w-[140px]"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="12"
        />
        {/* Indicator */}
        {score !== null && (
          <motion.circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - (normalised / 100) * circumference }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 16px ${glow})` }}
          />
        )}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-5xl font-black tracking-tighter tabular-nums leading-none"
          style={{ color: score !== null ? color : '#94a3b8' }}
        >
          {score !== null ? displayValue : '--'}
        </span>
        <span className="text-[10px] font-bold uppercase text-slate-400 mt-1" style={{ letterSpacing: '0.2em' }}>
          Score
        </span>
      </div>
    </div>
  )
}
