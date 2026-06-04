/**
 * EigenaarCard — fase-2 "Eigendom & eigenaar" card.
 *
 * Faithful rebuild of Contact.html §1 (ownerhero + 4-tile bidgrid + brknote2).
 * Renders REAL BRK data (rechtspersoon/overheid record after AVG-strip):
 *   - ownerhero: avatar + eigenaar-naam + type-badge + sub-line (recht + aandeel)
 *   - 4 tiles: Eigendomsvorm · Hypotheek · Laatste koopsom · WOZ-waarde
 *   - privacy-note (BRK-persoonsgegevens worden niet bewaard)
 *
 * Missing fields degrade gracefully to "—" / "Onbekend". WOZ is not part of the
 * BRK-record shape, so it shows "—" until a WOZ-source is wired.
 *
 * CSS-mapping (frame-v3.css → Tailwind/Aura):
 *   .ownerhero  → rounded-[18px] bg-white/60 border-white/70 p-[20px_24px]
 *   .bidtile    → rounded-[14px] bg-white/45 border-white/50
 *   .brknote2   → text-[12px] text-slate-400
 */
import { Building2, Landmark, Shield } from 'lucide-react'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

export interface EigenaarCardProps {
  record: BRKOwnershipRecordRead
}

/** Format a koopsom (number | string | null) to "€ 298.000" or "—". */
function formatKoopsom(koopsom: number | string | null): string {
  if (koopsom === null || koopsom === '') return '—'
  const n = typeof koopsom === 'string' ? Number(koopsom) : koopsom
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `€ ${Math.round(n).toLocaleString('nl-NL')}`
}

/** Friendly type-badge label per eigenaar_type. */
function typeLabel(t: BRKOwnershipRecordRead['eigenaar_type']): string {
  if (t === 'rechtspersoon') return 'Rechtspersoon'
  if (t === 'overheid') return 'Overheid'
  return 'Eigenaar'
}

export function EigenaarCard({ record }: EigenaarCardProps) {
  const isOverheid = record.eigenaar_type === 'overheid'
  const AvatarIcon = isOverheid ? Landmark : Building2

  const naam = record.eigenaar_naam ?? 'Onbekende eigenaar'
  const recht = record.zakelijk_recht_type ?? 'Vol eigendom'
  const aandeel = record.aandeel
  const koopjaar = record.koopjaar

  // ownerhero sub-line: "Rechtspersoon · eigenaar sinds 2009 · aandeel 1/1"
  const subParts = [typeLabel(record.eigenaar_type)]
  if (koopjaar) subParts.push(`eigenaar sinds ${koopjaar}`)
  if (aandeel) subParts.push(`aandeel ${aandeel}`)

  const hypotheekLabel = record.heeft_hypotheek ? 'Ingeschreven' : 'Geen'

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/50 rounded-[24px] px-[26px] py-6 mb-4 shadow-[0_1px_2px_rgba(14,17,17,0.03),0_8px_24px_rgba(14,17,17,0.04)]">
      {/* cardtop */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold text-aura-ink">Eigendom &amp; eigenaar</h2>
        <span className="text-[13px] font-bold text-aura-ink">Bron: Kadaster (BRK-bevragen)</span>
      </div>

      {/* ownerhero */}
      <div className="mt-[18px] flex items-center gap-[18px] rounded-[18px] bg-white/60 border border-white/70 px-6 py-5">
        <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-[#EEF1F1]">
          <AvatarIcon size={27} strokeWidth={1.6} className="text-slate-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Eigenaar
          </div>
          <div className="mt-0.5 text-[22px] font-extrabold tracking-[-0.02em] text-aura-ink">
            {naam}
          </div>
          <div className="mt-1 text-[13px] text-slate-500">{subParts.join(' · ')}</div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-[7px] rounded-full border border-black/[0.08] bg-white/70 px-[15px] py-[9px] text-[13px] font-semibold text-slate-600">
          <span className="h-[7px] w-[7px] rounded-full bg-slate-400" />
          {typeLabel(record.eigenaar_type)}
        </span>
      </div>

      {/* bidgrid — 4 tiles */}
      <div className="mt-[18px] grid grid-cols-4 gap-3">
        <Tile label="Eigendomsvorm" value={recht} valueSize={17} meta="BRK · zakelijk recht" />
        <Tile
          label="Hypotheek"
          value={hypotheekLabel}
          valueSize={17}
          meta={record.heeft_hypotheek ? 'BRK · ingeschreven' : 'BRK · geen inschrijving'}
        />
        <Tile
          label="Laatste koopsom"
          value={formatKoopsom(record.koopsom)}
          meta={koopjaar ? `BRK · ${koopjaar}` : 'BRK'}
        />
        <Tile label="WOZ-waarde" value="—" meta="WOZ · gemeente" />
      </div>

      {/* brknote2 — privacy note */}
      <div className="mt-[14px] flex items-center gap-[7px] text-[12px] leading-[1.5] text-slate-400">
        <Shield size={14} strokeWidth={1.6} className="shrink-0 text-aura-amber fill-aura-amber" />
        BRK-persoonsgegevens worden niet bewaard (privacy) · getoond voor je afweging, vastgelegd in
        Realworks bij overdracht.
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  meta,
  valueSize = 20,
}: {
  label: string
  value: string
  meta: string
  valueSize?: number
}) {
  return (
    <div className="rounded-[14px] border border-white/50 bg-white/45 px-4 py-[14px]">
      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </div>
      <div
        className="mt-[5px] font-bold tracking-[-0.01em] text-aura-ink"
        style={{ fontSize: `${valueSize}px` }}
      >
        {value}
      </div>
      <div className="mt-[3px] text-[11px] text-slate-400">{meta}</div>
    </div>
  )
}
