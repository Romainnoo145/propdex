/**
 * ScopeDetailPanel — standalone left slide-in panel for the data-bronnen hub
 * (M053/S05). Replaces the centered ScopeDetailModal with the app's signature
 * Dynamic Split-Canvas: a 620px glass card slides in on the LEFT while the hub
 * content shifts/shrinks to the right (the parent lays it out as a flex sibling).
 *
 * Visuals mirror the map's LeftPanelShell / ParcelPanelShell EXACTLY
 * (w-[620px] h-full rounded-[40px] bg-white/60 backdrop-blur-[24px]
 * border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)], close button
 * top-right, ESC-to-close) — but WITHOUT MapContext: no portal, no map-shrink.
 * Renders inline so AnimatePresence in the parent drives mount/unmount.
 *
 * Slide direction is horizontal (x: -24 → 0) instead of the shells' scale, so it
 * reads as a panel arriving from the left edge. Honors prefers-reduced-motion.
 */
import { useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

import type { EntityType } from '@/lib/types/data-sources-admin'
import { ScopeDataSourcesView } from '@/components/settings/data-bronnen/ScopeDataSourcesView'

interface Props {
  open: boolean
  onClose: () => void
  entityType: EntityType | null
  entityCode: string | null
  entityNaam?: string
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ScopeDetailPanel({
  open,
  onClose,
  entityType,
  entityCode,
  entityNaam,
}: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Parent gates mount via AnimatePresence; guard content render defensively.
  if (!open) return null

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="relative w-[620px] h-full shrink-0 flex flex-col overflow-hidden rounded-[40px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)]"
      style={{ fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui' }}
      data-component="scope-detail-panel"
    >
      {/* Close button — top-right, mirrors the map panel shells. */}
      <div className="absolute top-8 right-8 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="flex h-8 w-8 items-center justify-center text-aura-obsidian transition-colors hover:text-aura-obsidian/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <header className="mb-6 pr-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#F9A826]">
            Data-bronnen
          </p>
          <h2 className="mt-1 text-[20px] font-bold leading-snug text-[#0E1111]">
            {entityNaam ?? entityCode}
          </h2>
        </header>

        {entityType !== null && entityCode !== null && (
          <ScopeDataSourcesView entityType={entityType} entityCode={entityCode} />
        )}
      </div>
    </motion.div>
  )
}
