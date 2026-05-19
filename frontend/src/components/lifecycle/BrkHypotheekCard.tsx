/**
 * BrkHypotheekCard — Hypotheek Y/N aggregate from BRK records.
 *
 * Aggregation rule (eng-plan AD6):
 *   - ANY record.heeft_hypotheek === true → "Hypotheek aanwezig" (amber badge)
 *   - all records.heeft_hypotheek === false → "Volledig eigendom" (sage-mint badge)
 *
 * Lender summary (heeft_hypotheek detail rows) komt in S04 — voor nu Y/N only.
 *
 * Aura tokens per DESIGN.md: Pure Glass card, Warm Amber + Sage Mint badges.
 */
import { CircleDollarSign } from 'lucide-react'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

export interface BrkHypotheekCardProps {
  records: BRKOwnershipRecordRead[]
}

export function BrkHypotheekCard({ records }: BrkHypotheekCardProps) {
  if (records.length === 0) return null
  const hasMortgage = records.some((r) => r.heeft_hypotheek === true)

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4">
      <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-2">
        Financiering
      </h3>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
          <CircleDollarSign size={18} strokeWidth={1.5} className="text-slate-500" />
        </div>
        <div className="flex-1">
          {hasMortgage ? (
            <>
              <span className="inline-flex items-center px-2.5 py-1 rounded-2xl bg-amber-50 text-amber-700 text-[11px] font-semibold uppercase tracking-wide">
                Hypotheek aanwezig
              </span>
              <p className="text-[13px] text-slate-600 mt-2">
                Eén of meer eigenaars hebben een lopende hypotheek.
              </p>
            </>
          ) : (
            <>
              <span className="inline-flex items-center px-2.5 py-1 rounded-2xl bg-emerald-50 text-emerald-700 text-[11px] font-semibold uppercase tracking-wide">
                Volledig eigendom
              </span>
              <p className="text-[13px] text-slate-600 mt-2">
                Geen hypotheekregistratie gevonden.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
