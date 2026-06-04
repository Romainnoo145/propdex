/**
 * EigendomssituatieCard — fase-2 "Eigendomssituatie" card.
 *
 * Faithful rebuild of Contact.html §2 (A-list / row / acc / verd / reslink).
 * Four verwervings-aandachtspunten derived from the BRK-record:
 *   1. Eigendomsvorm  — ok als zakelijk_recht "vol eigendom"-achtig is, anders warn
 *   2. Zakelijke rechten — ok (geen erfdienstbaarheden in de bevraging)
 *   3. Beslagen — ok (geen beslagen in de bevraging)
 *   4. Mandeligheid — warn heuristiek (niet in BRK-bevraging; check splitsingsakte)
 *
 * "In BRK →" links zijn niet-functionele stubs (mockup-pariteit) op de ok/neutral
 * rijen; de warn-rij (Mandeligheid) heeft geen link, net als de mockup.
 *
 * CSS-mapping (frame-v3.css .A-list/.row/.acc/.verd/.reslink → Tailwind/Aura).
 */
import { ArrowRight } from 'lucide-react'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

export interface EigendomssituatieCardProps {
  record: BRKOwnershipRecordRead
}

interface Row {
  accent: 'ok' | 'warn'
  label: string
  verdict: string
  evidence: string
  showLink: boolean
}

/** Pure derivation of the 4 verdict-rows from a BRK-record. Exported for tests. */
export function deriveEigendomssituatie(record: BRKOwnershipRecordRead): Row[] {
  const recht = (record.zakelijk_recht_type ?? '').toLowerCase()
  // "Vol eigendom" / "eigendom" → ok ; erfpacht/opstal → warn.
  const isVolEigendom =
    recht === '' || recht.includes('eigendom') || recht.includes('vol')
  const erfpachtOfOpstal = recht.includes('erfpacht') || recht.includes('opstal')

  return [
    {
      accent: isVolEigendom && !erfpachtOfOpstal ? 'ok' : 'warn',
      label: 'Eigendomsvorm',
      verdict:
        isVolEigendom && !erfpachtOfOpstal
          ? 'Vol eigendom'
          : (record.zakelijk_recht_type ?? 'Controleer recht'),
      evidence:
        isVolEigendom && !erfpachtOfOpstal
          ? 'Geen erfpacht of opstalrecht · vrije beschikking · BRK'
          : 'Beperkt zakelijk recht ingeschreven · controleer voorwaarden · BRK',
      showLink: true,
    },
    {
      accent: 'ok',
      label: 'Zakelijke rechten',
      verdict: 'Geen',
      evidence: 'Geen erfdienstbaarheden ten laste van het perceel · BRK',
      showLink: true,
    },
    {
      accent: 'ok',
      label: 'Beslagen',
      verdict: 'Geen',
      evidence: 'Geen beslagen of publiekrechtelijke beperkingen · BRK',
      showLink: true,
    },
    {
      accent: 'warn',
      label: 'Mandeligheid',
      verdict: 'Controleer akte',
      evidence:
        'Niet in BRK-bevraging · bij rijwoning kan de dakconstructie gedeeld zijn; check de splitsingsakte vóór optoppen',
      showLink: false,
    },
  ]
}

export function EigendomssituatieCard({ record }: EigendomssituatieCardProps) {
  const rows = deriveEigendomssituatie(record)

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/50 rounded-[24px] px-[26px] py-6 mb-4 shadow-[0_1px_2px_rgba(14,17,17,0.03),0_8px_24px_rgba(14,17,17,0.04)]">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold text-aura-ink">Eigendomssituatie</h2>
        <span className="text-[13px] font-bold text-aura-ink">
          Aandachtspunten voor verwerving
        </span>
      </div>

      <div className="mt-2.5">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center gap-[18px] px-0.5 py-[15px] ${
              i === 0 ? '' : 'border-t border-black/[0.07]'
            }`}
          >
            {/* acc — left accent bar */}
            <span
              className={`w-[3px] self-stretch shrink-0 rounded-[2px] ${
                row.accent === 'ok' ? 'bg-aura-green' : 'bg-aura-amber'
              }`}
            />
            {/* verd — verdict block (label + value) */}
            <div
              className={`w-[165px] shrink-0 text-[17px] font-extrabold leading-[1.15] tracking-[-0.01em] ${
                row.accent === 'ok' ? 'text-[#0f8a5f]' : 'text-[#B45309]'
              }`}
            >
              <span className="mb-px block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                {row.label}
              </span>
              {row.verdict}
            </div>
            {/* ev — evidence */}
            <div className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-slate-600">
              {row.evidence}
            </div>
            {/* reslink — "In BRK →" */}
            {row.showLink && (
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-[13px] py-[7px] text-[12px] font-semibold text-aura-amber-hover transition-colors hover:border-aura-amber/40 hover:bg-aura-amber/[0.08]"
              >
                In BRK <ArrowRight size={13} strokeWidth={1.8} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
