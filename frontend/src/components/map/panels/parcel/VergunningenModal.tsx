/**
 * VergunningenModal — Shows vergunningen/bekendmakingen for a parcel
 *
 * No credit cost — data comes from pre-cached scan enrichment.
 * Groups by type, sorted newest-first.
 */

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ExternalLink,
  FileText,
  Scale,
  Hammer,
  TreePine,
  Info,
} from 'lucide-react'
import type { BekendmakingRecord } from '@/lib/types/scan'

/* ── Type icon lookup ────────────────────────────────────────── */

const TYPE_META: Record<string, { icon: typeof FileText; color: string }> = {
  omgevingsvergunning: { icon: Hammer, color: '#F59E0B' },
  bestemmingsplan: { icon: Scale, color: '#6366F1' },
  milieu: { icon: TreePine, color: '#22C55E' },
  bouwvergunning: { icon: Hammer, color: '#F59E0B' },
}

function getTypeMeta(type: string) {
  const lower = type.toLowerCase()
  for (const [key, meta] of Object.entries(TYPE_META)) {
    if (lower.includes(key)) return meta
  }
  return { icon: FileText, color: '#94a3b8' }
}

/* ── Date formatting ─────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/* ── Props ────────────────────────────────────────────────────── */

interface VergunningenModalProps {
  records: BekendmakingRecord[]
  address: string | null
  onClose: () => void
}

/* ── Reduced motion ──────────────────────────────────────────── */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── Component ────────────────────────────────────────────────── */

export function VergunningenModal({ records, address, onClose }: VergunningenModalProps) {
  // Sort newest first
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="vergunningen-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[calc(100vh-80px)] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────── */}
          <div className="flex items-start justify-between px-8 pt-7 pb-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                  Vergunningen
                </h2>
                <div className="flex items-center gap-1.5 rounded-full bg-[#F2F6F3] px-2.5 py-1">
                  <span className="text-[10px] font-semibold text-[#6B7280]">
                    {sorted.length} gevonden
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[13px] text-[#6B7280]">
                {address ?? 'Bekendmakingen rondom dit perceel'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB] ml-4 mt-0.5"
              aria-label="Sluiten"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* ── Content (scrollable) ────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Info size={32} strokeWidth={1.5} className="text-[#cbd5e1]" />
                <p className="mt-4 text-[13px] text-[#6B7280]">
                  Geen vergunningen gevonden voor dit perceel.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.map((record) => (
                  <VergunningCard key={record.identifier ?? record.url} record={record} />
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────── */}
          <div className="shrink-0 px-8 pb-6 pt-3 border-t border-[#EAEFEF]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#94a3b8]">
                Bron: Officiële Bekendmakingen (SRU)
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* ── VergunningCard ───────────────────────────────────────────── */

function VergunningCard({ record }: { record: BekendmakingRecord }) {
  const meta = getTypeMeta(record.type)
  const Icon = meta.icon

  return (
    <div className="rounded-[16px] bg-[#F2F6F3] p-4 transition-colors hover:bg-[#ECF1ED]">
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5"
          style={{ background: `${meta.color}15` }}
        >
          <Icon size={15} strokeWidth={1.5} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#0E1111] leading-snug">
            {record.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: `${meta.color}15`,
                color: meta.color,
              }}
            >
              {record.type}
            </span>
            <span className="text-[11px] text-[#94a3b8]">
              {formatDate(record.date)}
            </span>
            {record.municipality && (
              <span className="text-[11px] text-[#94a3b8]">
                {record.municipality}
              </span>
            )}
          </div>
        </div>
        {record.url && (
          <button
            type="button"
            onClick={() => window.open(record.url, '_blank')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0E1111] transition-colors hover:bg-[#E8EDEB] mt-0.5"
            title="Bekijk op overheid.nl"
          >
            <ExternalLink size={13} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  )
}
