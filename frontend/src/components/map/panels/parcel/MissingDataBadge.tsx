/**
 * MissingDataBadge — Amber warning pill voor parcels met >2 ontbrekende factoren.
 *
 * Rendert alleen als count > 2 (roadmap-drempel M046/S06). Copy letterlijk uit
 * M046 roadmap: "Beperkte data — score-betrouwbaarheid laag".
 */

import { AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

interface MissingDataBadgeProps {
  count: number
}

export function MissingDataBadge({ count }: MissingDataBadgeProps) {
  if (count <= 2) return null

  return (
    <motion.span
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="inline-flex items-center gap-1 rounded-full bg-[#FEF3E0] border border-[#F9A826]/40 px-2 py-px align-middle"
      title={`${count} factoren konden niet gemeten worden`}
    >
      <AlertTriangle size={10} strokeWidth={2} className="text-[#F9A826]" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B8771B]">
        Beperkte data — score-betrouwbaarheid laag
      </span>
    </motion.span>
  )
}
