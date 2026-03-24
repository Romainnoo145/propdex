import { motion } from 'framer-motion'
import { AMBER, GREEN, RED, OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import { fadeUp } from './animations'

interface CompactWijkCardProps {
  name: string
  code: string
  isScanned: boolean
  parcelCount?: number
  onSelect: () => void
}

const r = 6
const circumference = 2 * Math.PI * r

/**
 * Compact wijk card with scan-progress ring, hover scale, and fadeUp entrance.
 * Replaces the old green-dot indicator with a mini animated ring.
 */
export function CompactWijkCard({ name, isScanned, parcelCount, onSelect }: CompactWijkCardProps) {
  return (
    <motion.button
      variants={fadeUp}
      type="button"
      onClick={onSelect}
      className="group w-full flex items-center justify-between rounded-[16px] bg-white border border-[#EAEFEF] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50/50 hover:border-slate-200"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <span className="text-[13px] font-medium text-slate-700 truncate mr-2">
        {name}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {isScanned && parcelCount != null && (
          <span className="text-[10px] text-slate-400 tabular-nums font-semibold">
            {parcelCount}
          </span>
        )}
        {/* Mini scan status ring */}
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
          <circle cx="8" cy="8" r={r} fill="none" stroke="#f1f5f9" strokeWidth="2" />
          {isScanned && (
            <motion.circle
              cx="8"
              cy="8"
              r={r}
              fill="none"
              stroke="#F9A826"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          )}
        </svg>
      </div>
    </motion.button>
  )
}
