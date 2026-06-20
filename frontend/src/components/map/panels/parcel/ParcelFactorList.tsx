/**
 * ParcelFactorList — the single-scroll body of the redesigned ParcelDetailPanel
 * (Optie B). One continuous, weight-sorted list of FactorCard rows (no category
 * tabs, no pagination), then a Dossiers entry, then dashed "binnenkort"
 * placeholders for roadmap cascades.
 *
 * Drill-downs stay reachable:
 *  - woonvisie_match / beleidsalignement → bubble up via props (parent renders
 *    the in-panel detail view).
 *  - grondwaarde_fit / splitsingsrisico / parkeerdruk → open their popups here.
 */

import { useState } from 'react'
import { FolderOpen, ChevronRight } from 'lucide-react'
import type { ScanResultItem, ScoreBreakdownV3 } from '@/lib/types/scan'
import { useParcelEnrichment } from '@/hooks/useScans'
import { FactorCard } from './FactorCard'
import { buildFactorList, PLANNED_FACTORS } from './lib/factor-list'
import { GrondprijsPopup } from './GrondprijsPopup'
import { HuisvestingsverordeningPopup } from './HuisvestingsverordeningPopup'
import { ParkeernormenPopup, type Correctie } from './ParkeernormenPopup'
import type { Randvoorwaarde } from './OmgevingsvisiePopup'

/* ── Drill-down waarde shapes (mirror the layer popups) ───────── */

interface GrondwaardeFitWaarde {
  verdict: string
  peiljaar?: number | null
  grondbeleidstype?: string | null
  grondproduct?: string | null
  functiecategorie?: string | null
  prijs_per_m2_min?: number | null
  prijs_per_m2_max?: number | null
  prijsgrondslag?: string | null
  erfpacht_mogelijk?: boolean | null
  randvoorwaarden?: Randvoorwaarde[]
}

interface SplitsingsrisicoWaarde {
  verdict: string
  buurt_naam?: string | null
  woz_grens_eur?: number | null
  duur_jaren?: number | null
  vergunningplichten?: string[]
  randvoorwaarden?: Randvoorwaarde[]
}

interface ParkeerdrukWaarde {
  verdict: string
  peiljaar?: number | null
  functie?: string | null
  functiecategorie?: string | null
  gebied?: string | null
  auto_norm_per_eenheid?: number | null
  eenheid?: string | null
  fiets_norm_per_eenheid?: number | null
  parkeerregulering_van_toepassing?: boolean | null
  openbare_ruimte_drempel_pct?: number | null
  centrum_uitgesloten?: boolean | null
  fietsnorm_harde_eis?: boolean | null
  nul_norm_sociale_huur_mogelijk?: boolean | null
  mobiliteitscorrecties?: Correctie[]
  randvoorwaarden?: Randvoorwaarde[]
}

const GRONDPRIJS_ACTIVE_VERDICTS = new Set(['passend', 'context'])
const SPLITS_ACTIVE_VERDICTS = new Set([
  'van_toepassing', 'mogelijk_van_toepassing', 'vergunningstelsel_voorraad',
  'boven_woz_grens', 'buiten_beschermd_gebied',
])
const PARKEER_ACTIVE_VERDICTS = new Set(['verhoogd', 'laag'])

interface ParcelFactorListProps {
  parcel: ScanResultItem
  gemeenteNaam: string
  onOpenWoonvisie: () => void
  onOpenOmgevingsvisie: () => void
  onOpenDossiers: () => void
}

export function ParcelFactorList({
  parcel,
  gemeenteNaam,
  onOpenWoonvisie,
  onOpenOmgevingsvisie,
  onOpenDossiers,
}: ParcelFactorListProps) {
  const enrichmentQuery = useParcelEnrichment(parcel.parcel_id)
  const [grondprijsOpen, setGrondprijsOpen] = useState(false)
  const [splitsOpen, setSplitsOpen] = useState(false)
  const [parkeerOpen, setParkeerOpen] = useState(false)

  const breakdown = parcel.score_breakdown as ScoreBreakdownV3 | null

  // Drill-down data + availability flags.
  const woonvisieWaarde = breakdown?.['woonvisie_match']?.waarde
  const hasWoonvisieData = woonvisieWaarde !== null && woonvisieWaarde !== undefined

  const omgevingsvisieWaarde = breakdown?.['beleidsalignement']?.waarde
  const hasOmgevingsvisieData = omgevingsvisieWaarde !== null && omgevingsvisieWaarde !== undefined

  const grondprijsWaarde = breakdown?.['grondwaarde_fit']?.waarde as GrondwaardeFitWaarde | null
  const hasGrondprijsData =
    grondprijsWaarde != null && GRONDPRIJS_ACTIVE_VERDICTS.has(grondprijsWaarde.verdict)

  const splitsWaarde = breakdown?.['splitsingsrisico']?.waarde as SplitsingsrisicoWaarde | null
  const hasSplitsData = splitsWaarde != null && SPLITS_ACTIVE_VERDICTS.has(splitsWaarde.verdict)

  const parkeerWaarde = breakdown?.['parkeerdruk']?.waarde as ParkeerdrukWaarde | null
  const hasParkeerData = parkeerWaarde != null && PARKEER_ACTIVE_VERDICTS.has(parkeerWaarde.verdict)

  const items = buildFactorList(parcel, enrichmentQuery.data)

  function clickHandler(factorKey: string): (() => void) | undefined {
    switch (factorKey) {
      case 'woonvisie_match':
        return hasWoonvisieData ? onOpenWoonvisie : undefined
      case 'beleidsalignement':
        return hasOmgevingsvisieData ? onOpenOmgevingsvisie : undefined
      case 'grondwaarde_fit':
        return hasGrondprijsData ? () => setGrondprijsOpen(true) : undefined
      case 'splitsingsrisico':
        return hasSplitsData ? () => setSplitsOpen(true) : undefined
      case 'parkeerdruk':
        return hasParkeerData ? () => setParkeerOpen(true) : undefined
      default:
        return undefined
    }
  }

  return (
    <div className="px-6 pt-4 pb-4 flex flex-col gap-2">
      {/* Weighted factors — global weight sort, heaviest first */}
      {items.map((item) => (
        <FactorCard
          key={item.factor_key}
          layout="row"
          tone={item.tone}
          card={{ label: item.label, value: item.value, sub: item.sub, pts: item.pts }}
          isMissing={!!item.missing}
          onCardClick={clickHandler(item.factor_key)}
        />
      ))}

      {/* Dossiers & bronnen — non-weighted, reachable after the factors */}
      <button
        type="button"
        onClick={onOpenDossiers}
        className="group mt-1 flex items-center gap-3 bg-white border border-slate-100 rounded-[18px] px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow text-left"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F6F3] shrink-0">
          <FolderOpen className="size-[18px] text-aura-ink" strokeWidth={1.5} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-bold text-slate-900 leading-tight">
            Dossiers &amp; bronnen
          </span>
          <span className="block text-[11px] font-semibold text-slate-400 leading-tight">
            Documenten, vergunningen, checklist
          </span>
        </span>
        <ChevronRight className="size-4 text-slate-300 shrink-0" strokeWidth={2} />
      </button>

      {/* Binnenkort — roadmap cascades not yet scored */}
      <div className="mt-4 mb-1 flex items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
          Binnenkort
        </span>
        <span className="h-px flex-1 bg-slate-100" />
      </div>
      {PLANNED_FACTORS.map((planned) => (
        <FactorCard
          key={planned.key}
          layout="row"
          comingSoon
          tone={planned.tone}
          card={{ label: planned.label, value: '—', sub: planned.source, pts: 0 }}
        />
      ))}

      {/* ── Drill-down popups ───────────────────────────────── */}
      {hasGrondprijsData && (
        <GrondprijsPopup
          isOpen={grondprijsOpen}
          onClose={() => setGrondprijsOpen(false)}
          gemeente={gemeenteNaam}
          verdict={grondprijsWaarde!.verdict}
          grondproduct={grondprijsWaarde!.grondproduct}
          functiecategorie={grondprijsWaarde!.functiecategorie}
          prijs_per_m2_min={grondprijsWaarde!.prijs_per_m2_min}
          prijs_per_m2_max={grondprijsWaarde!.prijs_per_m2_max}
          prijsgrondslag={grondprijsWaarde!.prijsgrondslag}
          peiljaar={grondprijsWaarde!.peiljaar}
          grondbeleidstype={grondprijsWaarde!.grondbeleidstype}
          erfpacht_mogelijk={grondprijsWaarde!.erfpacht_mogelijk}
          randvoorwaarden={grondprijsWaarde!.randvoorwaarden}
        />
      )}

      {hasSplitsData && (
        <HuisvestingsverordeningPopup
          isOpen={splitsOpen}
          onClose={() => setSplitsOpen(false)}
          verdict={splitsWaarde!.verdict}
          buurt_naam={splitsWaarde!.buurt_naam}
          woz_grens_eur={splitsWaarde!.woz_grens_eur}
          duur_jaren={splitsWaarde!.duur_jaren}
          vergunningplichten={splitsWaarde!.vergunningplichten}
          randvoorwaarden={splitsWaarde!.randvoorwaarden}
        />
      )}

      {hasParkeerData && (
        <ParkeernormenPopup
          isOpen={parkeerOpen}
          onClose={() => setParkeerOpen(false)}
          verdict={parkeerWaarde!.verdict}
          peiljaar={parkeerWaarde!.peiljaar}
          functie={parkeerWaarde!.functie}
          functiecategorie={parkeerWaarde!.functiecategorie}
          gebied={parkeerWaarde!.gebied}
          auto_norm_per_eenheid={parkeerWaarde!.auto_norm_per_eenheid}
          eenheid={parkeerWaarde!.eenheid}
          fiets_norm_per_eenheid={parkeerWaarde!.fiets_norm_per_eenheid}
          parkeerregulering_van_toepassing={parkeerWaarde!.parkeerregulering_van_toepassing}
          openbare_ruimte_drempel_pct={parkeerWaarde!.openbare_ruimte_drempel_pct}
          centrum_uitgesloten={parkeerWaarde!.centrum_uitgesloten}
          fietsnorm_harde_eis={parkeerWaarde!.fietsnorm_harde_eis}
          nul_norm_sociale_huur_mogelijk={parkeerWaarde!.nul_norm_sociale_huur_mogelijk}
          mobiliteitscorrecties={parkeerWaarde!.mobiliteitscorrecties}
          randvoorwaarden={parkeerWaarde!.randvoorwaarden}
        />
      )}
    </div>
  )
}
