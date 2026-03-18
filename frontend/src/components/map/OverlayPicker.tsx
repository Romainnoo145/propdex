import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Layers, TrendingUp, Building2, FileText, DoorOpen, Ruler, ShieldAlert, Map } from 'lucide-react'
import { MAP_LAYER_CATALOG } from '@/lib/map/layers'
import type { ParcelOverlayLayerId } from '@/lib/map/layers'

interface OverlayPickerProps {
  activeOverlay: ParcelOverlayLayerId | null
  onSelect: (id: ParcelOverlayLayerId) => void
}

const OVERLAY_ICONS: Record<ParcelOverlayLayerId, React.ComponentType<{ className?: string }>> = {
  potential: TrendingUp,
  built_status: Building2,
  report_coverage: FileText,
  vacancy_signal: DoorOpen,
  build_capacity: Ruler,
  foundation_risk: ShieldAlert,
  bestemmingsplan: Map,
}

/* ── Inline legend per overlay mode ── */

function Dot({ color }: { color: string }) {
  return <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
}

function InlineLegend({ overlay }: { overlay: ParcelOverlayLayerId | null }) {
  switch (overlay) {
    case 'potential':
      return (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-500">40</span>
          <div className="h-2 w-12 rounded-full" style={{ background: 'linear-gradient(to right, #f59e0b, #84cc16, #16a34a)' }} />
          <span className="text-[10px] text-neutral-500">100</span>
        </div>
      )
    case 'built_status':
      return (
        <div className="flex items-center gap-1.5">
          <Dot color="#ef4444" /><span className="text-[10px] text-neutral-500">Bebouwd</span>
          <Dot color="#22c55e" /><span className="text-[10px] text-neutral-500">Leeg</span>
        </div>
      )
    case 'report_coverage':
      return (
        <div className="flex items-center gap-1.5">
          <Dot color="#f59e0b" /><span className="text-[10px] text-neutral-500">Rapport</span>
          <Dot color="#64748b" /><span className="text-[10px] text-neutral-500">Geen</span>
        </div>
      )
    case 'vacancy_signal':
      return (
        <div className="flex items-center gap-1.5">
          <Dot color="#22c55e" /><span className="text-[10px] text-neutral-500">Leeg</span>
          <Dot color="#f59e0b" /><span className="text-[10px] text-neutral-500">Leegstaand</span>
          <Dot color="#ef4444" /><span className="text-[10px] text-neutral-500">In gebruik</span>
        </div>
      )
    case 'build_capacity':
      return (
        <div className="flex items-center gap-1.5">
          <Dot color="#16a34a" /><span className="text-[10px] text-neutral-500">Hoog</span>
          <Dot color="#eab308" /><span className="text-[10px] text-neutral-500">Middel</span>
          <Dot color="#64748b" /><span className="text-[10px] text-neutral-500">Laag</span>
        </div>
      )
    case 'foundation_risk':
      return (
        <div className="flex items-center gap-1.5">
          <Dot color="#f59e0b" /><span className="text-[10px] text-neutral-500">Hoog</span>
          <Dot color="#fbbf24" /><span className="text-[10px] text-neutral-500">Middel</span>
          <Dot color="#64748b" /><span className="text-[10px] text-neutral-500">Laag</span>
        </div>
      )
    case 'bestemmingsplan':
      return null
    default:
      return null
  }
}

/**
 * Floating layer-picker (bottom-right).
 * Button: Layers icon + active label + inline legend.
 * Popover: just names, solid background, no info icons.
 */
export default function OverlayPicker({ activeOverlay, onSelect }: OverlayPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 h-10 px-3.5 rounded-xl shadow-lg bg-white border border-neutral-200 text-aura-ink hover:bg-neutral-50 transition-colors duration-200"
        aria-label="Kleurmodus kiezen"
      >
        <Layers className="h-4 w-4 shrink-0" />
        <span className="text-[13px] font-medium">{activeLabel}</span>
        <InlineLegend overlay={activeOverlay} />
      </button>

      {/* Popover — solid white, no transparency, just names */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-[148px] bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden py-0.5"
          >
            {MAP_LAYER_CATALOG.parcelOverlays.map((overlay) => {
              const isActive = activeOverlay === overlay.id
              const Icon = OVERLAY_ICONS[overlay.id]
              return (
                <button
                  key={overlay.id}
                  onClick={() => handleSelect(overlay.id)}
                  className={`w-full text-left px-2.5 py-1 flex items-center gap-2 transition-colors ${
                    isActive ? 'bg-aura-amber/10' : 'hover:bg-neutral-50'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-aura-amber' : 'text-neutral-400'}`} />
                  <span className={`text-[11px] ${isActive ? 'font-medium text-aura-amber' : 'text-aura-ink/70'}`}>
                    {overlay.label}
                  </span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
