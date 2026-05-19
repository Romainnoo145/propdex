/**
 * BrkOwnerCard — render persisted BRK ownership records (rechtspersoon + overheid).
 *
 * Two variants per record (eng-plan AD6):
 *   - rechtspersoon → eigenaar_naam (bold) + KvK badge + statutaire_zetel + zakelijk_recht + aandeel
 *   - overheid      → eigenaar_naam (bold, NO KvK) + zakelijk_recht_type
 *
 * Multi-owner: vertical list with subtle slate separators.
 * Natuurlijk persoon records NEVER reach this component (AVG strip at persist-time).
 *
 * Aura tokens per DESIGN.md: Pure Glass card, Plus Jakarta Sans inherited.
 */
import { Building2, Landmark } from 'lucide-react'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

export interface BrkOwnerCardProps {
  records: BRKOwnershipRecordRead[]
}

function renderOwner(rec: BRKOwnershipRecordRead) {
  // Explicit branch keys per eng-plan AD6 — drift-detection canaries pin both literals.
  const isRechtspersoon = rec.eigenaar_type === 'rechtspersoon'
  const isOverheid = rec.eigenaar_type === 'overheid'
  const Icon = isRechtspersoon ? Building2 : Landmark
  const typeLabel = isRechtspersoon ? 'Rechtspersoon' : isOverheid ? 'Overheid' : 'Eigenaar'

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
        <Icon size={18} strokeWidth={1.5} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-[15px] font-semibold text-aura-ink truncate">
            {rec.eigenaar_naam ?? 'Onbekende eigenaar'}
          </p>
          <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
            {typeLabel}
          </span>
        </div>

        {isRechtspersoon && rec.kvk_nummer && (
          <p className="text-[12px] text-slate-500 mt-0.5">
            KvK <span className="font-mono">{rec.kvk_nummer}</span>
            {rec.statutaire_zetel ? ` · ${rec.statutaire_zetel}` : ''}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5 text-[12px] text-slate-600">
          {rec.zakelijk_recht_type && (
            <span>{rec.zakelijk_recht_type}</span>
          )}
          {rec.aandeel && (
            <span className="text-slate-400">·</span>
          )}
          {rec.aandeel && (
            <span className="font-mono">{rec.aandeel}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export function BrkOwnerCard({ records }: BrkOwnerCardProps) {
  if (records.length === 0) return null
  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4">
      <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-2">
        Eigenaar{records.length > 1 ? 's' : ''}
      </h3>
      <div className="divide-y divide-slate-100">
        {records.map((rec) => (
          <div key={rec.id}>{renderOwner(rec)}</div>
        ))}
      </div>
    </div>
  )
}
