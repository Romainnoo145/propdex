import { useEffect, type ReactNode } from 'react'
import { OBSIDIAN } from '@/lib/tokens'
import { motion, useSpring, useTransform } from 'framer-motion'

interface VerdictHeroProps {
  /** Big score number (0–100 or null) */
  score: number | null
  /** Verdict label, e.g. "ONTWIKKELKANSRIJK", "LAAG RISICO" */
  label: string
  /** One-liner insight below the verdict */
  subtitle: string
  /** Color for verdict label + bar + icon badge */
  color: string
  /** Icon rendered inside the colored badge */
  icon: ReactNode
  /** Optional bar max value (default 100) */
  barMax?: number
}

/**
 * Verdict hero block — matches PotentieLayer/RisicoLayer pattern exactly.
 * text-7xl score · verdict label + subtitle · colored icon badge · animated progress bar.
 */
export function VerdictHero({ score, label, subtitle, color, icon, barMax = 100 }: VerdictHeroProps) {
  const springVal = useSpring(0, { stiffness: 60, damping: 20 })
  const barWidth = useTransform(springVal, (v) => `${Math.min(100, (v / barMax) * 100)}%`)

  useEffect(() => {
    const timer = setTimeout(() => springVal.set(score ?? 0), 300)
    return () => clearTimeout(timer)
  }, [score, springVal])

  return (
    <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-5 rounded-[20px]">
      <div className="flex items-center justify-between">
        {/* Left: huge score */}
        <span
          className="text-7xl font-black tracking-tighter tabular-nums leading-none"
          style={{ color: score != null ? OBSIDIAN : '#cbd5e1' }}
        >
          {score != null ? Math.round(score) : '—'}
        </span>

        {/* Center: verdict + subtitle */}
        <div className="flex-1 px-6 min-w-0">
          <p
            className="text-xl font-bold uppercase tracking-wide"
            style={{ color }}
          >
            {label}
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5 truncate">
            {subtitle}
          </p>
        </div>

        {/* Right: icon badge */}
        <div
          className="size-12 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
      </div>

      {/* Animated progress bar */}
      <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ width: barWidth, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
