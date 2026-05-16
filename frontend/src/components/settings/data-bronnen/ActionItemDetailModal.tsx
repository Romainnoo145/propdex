/**
 * ActionItemDetailModal — M049/S06
 *
 * Aura-styled modal for ActionItem content surfaced on /instellingen/data-bronnen
 * rows. Derives content from ACTION_ITEMS_CATALOG (TS-twin of backend), keyed
 * by sourceKey.
 *
 * Visual pattern mirrors CredentialConfigModal (Plan 05-03):
 *  - AnimatePresence backdrop (bg-black/30 backdrop-blur-sm)
 *  - Glass panel (bg-white/60 backdrop-blur-[24px], rounded-[24px])
 *  - Plus Jakarta Sans inline style
 *  - Close on X button or backdrop click
 *
 * Replaces the legacy ActionDetailModal in components/documentation/ActionItems.tsx
 * (which is deleted in Plan 06-02 Task 4).
 */
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  ExternalLink,
  MapPin,
  Phone,
  Plug,
  X,
} from 'lucide-react'

import { ACTION_ITEMS_CATALOG } from '@/lib/constants/actionItemsCatalog'
import type {
  ActionItemCategory,
  ActionItemEntry,
} from '@/lib/types/action-items'

interface Props {
  open: boolean
  onClose: () => void
  sourceKey: string | null
}

const CATEGORY_CONFIG: Record<
  ActionItemCategory,
  { label: string; Icon: typeof Plug }
> = {
  'api-config': { label: 'API Configuratie', Icon: Plug },
  'extern-contact': { label: 'Extern Contact', Icon: Phone },
  roadmap: { label: 'Roadmap', Icon: MapPin },
  bugfix: { label: 'Fix Nodig', Icon: AlertTriangle },
}

export function ActionItemDetailModal({ open, onClose, sourceKey }: Props) {
  // Hooks-before-return guard — none needed here; pure derivation
  const entry: ActionItemEntry | null = sourceKey
    ? (ACTION_ITEMS_CATALOG[sourceKey] ?? null)
    : null

  return (
    <AnimatePresence>
      {open && entry !== null && (
        <motion.div
          key="action-item-modal-backdrop"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-lg mx-4 rounded-[24px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-xl p-7"
            style={{ fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui' }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Sluiten"
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full border border-white/60 text-slate-500 hover:text-[#0E1111] hover:border-[#0E1111] transition-colors"
            >
              <X size={14} />
            </button>

            <div className="flex items-center gap-2 mb-2">
              {(() => {
                const cat = CATEGORY_CONFIG[entry.category]
                const CatIcon = cat.Icon
                return (
                  <>
                    <CatIcon size={14} className="text-[#F9A826]" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#F9A826]">
                      {cat.label}
                    </p>
                  </>
                )
              })()}
              {entry.done ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#15803d]">
                  <Check size={10} strokeWidth={3} /> Done
                </span>
              ) : (
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                    entry.priority === 'hoog'
                      ? 'text-red-500'
                      : entry.priority === 'middel'
                        ? 'text-[#F9A826]'
                        : 'text-slate-400'
                  }`}
                >
                  · {entry.priority}
                </span>
              )}
            </div>

            <h3
              className="text-[18px] font-bold text-[#0E1111] leading-snug pr-10"
              style={{ textWrap: 'balance' }}
            >
              {entry.title}
            </h3>

            <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">
              {entry.description}
            </p>

            {entry.contact && (
              <div className="mt-4 rounded-xl bg-white/40 border border-white/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Contact
                </p>
                <p className="text-[13px] font-semibold text-[#0E1111]">
                  {entry.contact}
                </p>
              </div>
            )}

            {entry.url && (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0E1111] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Bekijk <ExternalLink size={14} />
              </a>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
