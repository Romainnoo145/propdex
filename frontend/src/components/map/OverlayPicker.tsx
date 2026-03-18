import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { MAP_LAYER_CATALOG } from '@/lib/map/layers'
import type { ParcelOverlayLayerId } from '@/lib/map/layers'

interface OverlayPickerProps {
  activeOverlay: ParcelOverlayLayerId | null
  onSelect: (id: ParcelOverlayLayerId) => void
}

/**
 * Floating layer-picker button (bottom-right of map).
 * Click opens a compact card with radio-style overlay options.
 * Selecting an option switches the map overlay and closes the card.
 */
export default function OverlayPicker({ activeOverlay, onSelect }: OverlayPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback(
    (id: ParcelOverlayLayerId) => {
      onSelect(id)
      setOpen(false)
    },
    [onSelect]
  )

  const activeLabel = MAP_LAYER_CATALOG.parcelOverlays.find((o) => o.id === activeOverlay)?.label ?? 'Potentie'

  return (
    <div ref={ref} className="absolute bottom-4 right-4 z-[var(--z-map-controls)]">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 h-10 px-3.5 rounded-xl transition-colors duration-200 shadow-lg ${
          open
            ? 'bg-aura-amber text-white'
            : 'bg-white/70 backdrop-blur-xl border border-white/40 text-aura-ink/80 hover:bg-white/90'
        }`}
        aria-label="Kleurmodus kiezen"
      >
        <Layers className="h-4 w-4" />
        <span className="text-[13px] font-medium">{activeLabel}</span>
      </button>

      {/* Popover card — opens upward */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-56 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-lg overflow-hidden py-1.5"
          >
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Kleurmodus
            </div>
            {MAP_LAYER_CATALOG.parcelOverlays.map((overlay) => {
              const isActive = activeOverlay === overlay.id
              return (
                <button
                  key={overlay.id}
                  onClick={() => handleSelect(overlay.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                    isActive
                      ? 'bg-aura-amber/10'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <div
                    className={`h-3 w-3 rounded-full border-2 flex-shrink-0 ${
                      isActive
                        ? 'border-aura-amber bg-aura-amber'
                        : 'border-neutral-300 bg-transparent'
                    }`}
                  />
                  <div>
                    <div className={`text-[13px] leading-tight ${isActive ? 'font-medium text-aura-amber' : 'text-aura-ink/80'}`}>
                      {overlay.label}
                    </div>
                    <div className="text-[10px] text-neutral-400 leading-tight">
                      {overlay.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
