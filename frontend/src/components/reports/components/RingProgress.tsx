/**
 * RingProgress — SVG circle progress ring for score display.
 *
 * Renders a circular progress arc (amber-300 stroke on a slate-100 track)
 * with the numeric score centered inside. Arc starts at 12 o'clock.
 */

export interface RingProgressProps {
  /** Score value (0–max). */
  value: number
  /** Maximum value (default 100). */
  max?: number
  /** Label shown beneath the ring. */
  label: string
  /** Ring diameter preset. */
  size?: 'sm' | 'md'
}

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const sizeConfig = {
  sm: { wh: 64, fontSize: 'text-sm' },
  md: { wh: 96, fontSize: 'text-lg' },
} as const

export function RingProgress({
  value,
  max = 100,
  label,
  size = 'md',
}: RingProgressProps) {
  const clamped = Math.max(0, Math.min(value, max))
  const ratio = max > 0 ? clamped / max : 0
  const offset = CIRCUMFERENCE * (1 - ratio)
  const cfg = sizeConfig[size]

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={cfg.wh}
        height={cfg.wh}
        viewBox="0 0 100 100"
        className="block"
      >
        {/* Background track */}
        <circle
          cx={50}
          cy={50}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          className="text-slate-100"
          strokeWidth={8}
        />
        {/* Progress arc */}
        <circle
          cx={50}
          cy={50}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          className="text-amber-300"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        {/* Center score */}
        <text
          x={50}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-800 font-bold"
          fontSize={size === 'sm' ? 20 : 24}
        >
          {Math.round(clamped)}
        </text>
      </svg>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}
