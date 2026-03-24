/**
 * Score detail modals for portfolio workspace.
 *
 * Reuses the PotentieLayer and RisicoLayer components from the map panel
 * inside a portal-based modal. Fetches scan data on demand via parcel_cache_id.
 */

import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { useParcelScanData } from '@/hooks/useScans'
import { PotentieLayer } from '@/components/map/panels/parcel/layers/PotentieLayer'
import { RisicoLayer } from '@/components/map/panels/parcel/layers/RisicoLayer'

/* ── Shared modal shell ───────────────────────────────────── */

interface ScoreModalShellProps {
  open: boolean
  onClose: () => void
  title: string
  accentColor: string
  children: React.ReactNode
}

function ScoreModalShell({ open, onClose, title, accentColor, children }: ScoreModalShellProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return undefined
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open, handleKeyDown])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-4 z-[9999] flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`size-3 rounded-full ${accentColor}`} />
                  <h2 className="text-[15px] font-bold text-[#0E1111] uppercase tracking-wide">
                    {title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  aria-label="Sluiten"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ── Loading state ────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="size-8 text-slate-300 animate-spin" />
      <p className="text-[13px] text-slate-400">Scan data ophalen…</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <p className="text-[13px] font-semibold text-red-500">Kan data niet laden</p>
      <p className="text-[12px] text-slate-400">{message}</p>
    </div>
  )
}

/* ── Potentie Modal ───────────────────────────────────────── */

interface PotentieModalProps {
  open: boolean
  onClose: () => void
  parcelCacheId: string | null
}

export function PotentieModal({ open, onClose, parcelCacheId }: PotentieModalProps) {
  const { data: scanData, isLoading, error } = useParcelScanData(open ? parcelCacheId : null)

  return (
    <ScoreModalShell
      open={open}
      onClose={onClose}
      title="Potentie analyse"
      accentColor="bg-emerald-500"
    >
      {isLoading && <LoadingState />}
      {error && <ErrorState message={error.message} />}
      {scanData && <PotentieLayer parcel={scanData} />}
    </ScoreModalShell>
  )
}

/* ── Risico Modal ─────────────────────────────────────────── */

interface RisicoModalProps {
  open: boolean
  onClose: () => void
  parcelCacheId: string | null
}

export function RisicoModal({ open, onClose, parcelCacheId }: RisicoModalProps) {
  const { data: scanData, isLoading, error } = useParcelScanData(open ? parcelCacheId : null)

  return (
    <ScoreModalShell
      open={open}
      onClose={onClose}
      title="Risico analyse"
      accentColor="bg-red-500"
    >
      {isLoading && <LoadingState />}
      {error && <ErrorState message={error.message} />}
      {scanData && <RisicoLayer parcel={scanData} />}
    </ScoreModalShell>
  )
}

/* ── Score Badge (reusable) ───────────────────────────────── */

interface ScoreBadgeProps {
  score: number
  type: 'potentie' | 'risico'
  onClick?: () => void
  size?: 'sm' | 'md'
}

export function ScoreBadge({ score, type, onClick, size = 'md' }: ScoreBadgeProps) {
  const isPotentie = type === 'potentie'
  const ringColor = isPotentie ? '#22c55e' : '#ef4444'
  const bgRingColor = isPotentie ? '#d1fae5' : '#fee2e2'
  const badgeClasses = isPotentie
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-red-200 bg-red-50 text-red-700'

  const r = size === 'sm' ? 4 : 5
  const circ = 2 * Math.PI * r
  const svgSize = size === 'sm' ? 10 : 12

  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={isPotentie ? `Potentie: ${Math.round(score)}` : `Risico: ${Math.round(score)}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 font-semibold tabular-nums ${badgeClasses} ${
        size === 'sm' ? 'min-h-[26px] text-[10px]' : 'min-h-[30px] text-[11px]'
      } ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
    >
      <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className={size === 'sm' ? 'size-2.5' : 'size-3'}>
        <circle cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke={bgRingColor} strokeWidth="2" />
        <circle
          cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke={ringColor} strokeWidth="2"
          strokeDasharray={`${(score / 100) * circ} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
        />
      </svg>
      {Math.round(score)}
    </Tag>
  )
}
