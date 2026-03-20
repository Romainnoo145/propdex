import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { fadeUp } from './animations'

interface StatRingCardProps {
  /** Lucide icon element */
  icon: ReactNode
  /** Uppercase label above the value */
  label: string
  /** Numeric value to display (0–100 for ring, any number for plain) */
  value: number | null
  /** Optional formatted string override (e.g. "€142.000", "Sterk") — when set, the spring number is skipped */
  displayValue?: string
  /** Unit suffix shown below the number (e.g. "%", "per 1k") */
  unit?: string
  /** Ring color — used for SVG stroke and value text */
  color: string
  /** Whether to show an SVG ring around the number */
  showRing?: boolean
  /** Max value for ring calculation (default: 100) */
  ringMax?: number
  /** "So what?" subtitle below the value */
  subtitle?: string
  /** Click handler — when set, card shows chevron and is interactive */
  onClick?: () => void
}

/**
 * Animated stat card for gemeente/wijk panels.
 * Two modes:
 * - Ring mode (showRing=true): SVG score ring with spring-animated center number
 * - Value mode (default): Large spring-animated number
 *
 * Matches parcel panel's ScoreCircleCard pattern with identical spring physics.
 */
export function StatRingCard({
  icon,
  label,
  value,
  displayValue,
  unit,
  color,
  showRing = false,
  ringMax = 100,
  subtitle,
  onClick,
}: StatRingCardProps) {
  const interactive = !!onClick
  const isEmpty = value == null

  // Spring-animated number
  const spring = useSpring(0, { stiffness: 60, damping: 20 })
  const display = useTransform(spring, (v) => Math.round(v))
  const [animatedValue, setAnimatedValue] = useState(0)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (value == null) return undefined
    if (!hasMounted.current) {
      hasMounted.current = true
      const t = setTimeout(() => spring.set(value), 300)
      return () => clearTimeout(t)
    }
    spring.set(value)
    return undefined
  }, [value, spring])

  useEffect(() => {
    const unsub = display.on('change', (v) => setAnimatedValue(v))
    return unsub
  }, [display])

  // Ring math
  const r = 38
  const circumference = 2 * Math.PI * r
  const normalised = value != null ? Math.min(ringMax, Math.max(0, value)) / ringMax : 0

  return (
    <motion.div
      variants={fadeUp}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      className={`flex flex-col justify-between rounded-[24px] bg-white border border-[#EAEFEF] p-5 transition-all duration-200 hover:shadow-sm${interactive ? ' cursor-pointer' : ''}`}
      whileHover={interactive ? { scale: 1.02 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Top: icon + label + chevron */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span
            className="text-[11px] font-extrabold uppercase"
            style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
          >
            {label}
          </span>
        </div>
        {interactive && (
          <ChevronRight size={14} strokeWidth={2} className="text-slate-200" />
        )}
      </div>

      {/* Middle: ring or plain value */}
      {showRing ? (
        <div className="relative flex items-center justify-center my-3">
          <svg
            viewBox="0 0 96 96"
            className="h-[100px] w-[100px]"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Track */}
            <circle
              cx="48"
              cy="48"
              r={r}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="8"
            />
            {/* Indicator */}
            {value != null && (
              <motion.circle
                cx="48"
                cy="48"
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - normalised * circumference }}
                transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
              />
            )}
          </svg>
          <span
            className="absolute font-black tracking-tighter tabular-nums leading-none text-center px-1"
            style={{
              color: isEmpty ? '#cbd5e1' : color,
              fontSize: displayValue && displayValue.length > 4 ? '14px' : '28px',
            }}
          >
            {displayValue ?? (isEmpty ? '—' : animatedValue)}
          </span>
        </div>
      ) : (
        <div className="mt-3">
          <span
            className="text-[32px] font-black tracking-tighter tabular-nums leading-none"
            style={{ color: isEmpty ? '#cbd5e1' : color }}
          >
            {displayValue ?? (isEmpty ? '—' : animatedValue)}
          </span>
          {unit && !isEmpty && (
            <span
              className="text-[13px] font-bold ml-0.5"
              style={{ color: `${color}99` }}
            >
              {unit}
            </span>
          )}
        </div>
      )}

      {/* Bottom: subtitle */}
      {subtitle && (
        <span className="text-[11px] mt-1.5 leading-tight" style={{ color: '#94a3b8' }}>
          {subtitle}
        </span>
      )}
    </motion.div>
  )
}
