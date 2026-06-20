/**
 * ParcelDetailPanel single-scroll redesign (Optie B) — visual story.
 *
 * Composes the REAL pieces (ParcelScoreHero + buildFactorList + FactorCard rows
 * + PLANNED_FACTORS) inside a 620px panel frame so the end layout can be
 * eyeballed without backend / auth / MapContext. buildFactorList is pure, so
 * the rows shown are the genuine weight-sorted output; only the live drill-down
 * popups are inert here.
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { FolderOpen, ChevronRight } from 'lucide-react'
import { ParcelScoreHero } from '@/components/map/panels/parcel/ParcelScoreHero'
import { FactorCard } from '@/components/map/panels/parcel/FactorCard'
import { buildFactorList, PLANNED_FACTORS } from '@/components/map/panels/parcel/lib/factor-list'
import type { ScanResultItem, ScoreFactorV3 } from '@/lib/types/scan'

const f = (
  categorie: 'potentie' | 'risico',
  waarde: unknown,
  bijdrage: number,
  missing = false,
): ScoreFactorV3 => ({
  waarde,
  genormaliseerde_score: 0.6,
  gewicht: Math.round(Math.abs(bijdrage) + 4),
  bijdrage,
  categorie,
  toelichting_kort: '',
  toelichting_lang: '',
  data_bronnen: [],
  missing,
})

const PARCEL: ScanResultItem = {
  parcel_id: '00000000-0000-4000-8000-000000000abc',
  parcel_code: 'NL.IMKAD.KadastraalObject.456',
  address: 'Parade 21, 5911 CB Venlo',
  gemeente_code: 'GM0983',
  area_m2: 1180,
  has_pand: true,
  bouwjaar: 1968,
  pand_status: 'Pand in gebruik',
  bestemmingen: [{ type: 'wonen', naam: 'Centrum' }],
  primary_bestemming_type: 'wonen',
  score: 71,
  score_category: 'Medium',
  potentie_score: 78,
  risico_score: 34,
  use_case_scores: null,
  vacancy_signal: 'leegstaand_pand',
  vacancy_confidence: 0.72,
  vacancy_reasons: null,
  vacancy_model_version: null,
  market_signals: {
    listing_duration_days: 210,
    price_change_count: 1,
    listing_snapshots_count: 4,
    days_since_last_seen: 3,
  },
  opportunity_signals: null,
  building_metrics: {
    pand_oppervlakte_m2: 420,
    actual_bouwlagen: 2,
    actual_bouwhoogte: 7,
    max_bouwlagen: 5,
    max_bouwhoogte: 16,
  },
  has_report: false,
  score_breakdown: {
    // potentie
    woonvisie_match: f('potentie', { matched_policy: { prioriteit: 'groei', wijk_naam: 'Centrum' }, matched_wijk: 'Centrum' }, 12.4),
    vrije_grond: f('potentie', 0.64, 9.1),
    bestemming: f('potentie', null, 6.2),
    grondwaarde_fit: f('potentie', { verdict: 'passend', prijs_per_m2_min: 480, prijs_per_m2_max: 720, functiecategorie: 'vrij' }, 5.0),
    leegstand: f('potentie', null, 4.4),
    beleidsalignement: f('potentie', { matched_gebied: 'Binnenstad', verdict: 'kansrijk' }, 3.1),
    perceelgrootte: f('potentie', null, 2.0),
    demografie: f('potentie', null, 0, true),
    // risico
    splitsingsrisico: f('risico', { verdict: 'mogelijk_van_toepassing', buurt_naam: 'Q4' }, -8.7),
    parkeerdruk: f('risico', { verdict: 'verhoogd', gebied: 'centrum' }, -6.3),
    asbest: f('risico', { bouwjaar: 1968 }, -4.9),
    funderingsrisico: f('risico', { fgr: 'klei' }, -3.4),
    criminaliteit: f('risico', { per_1000_inwoners: 62 }, -2.6),
    monument: f('risico', false, -1.2),
    bodemverontreiniging: f('risico', null, 0, true),
  },
}

function PanelFrame() {
  const items = buildFactorList(PARCEL, undefined)
  return (
    <div className="w-[620px] h-full max-h-[860px] flex flex-col overflow-hidden rounded-[40px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
      {/* Sticky hero */}
      <div className="shrink-0">
        <ParcelScoreHero parcel={PARCEL} missingCount={2} />
      </div>

      {/* Scroll zone */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-4 pb-4 flex flex-col gap-2">
          {items.map((item) => (
            <FactorCard
              key={item.factor_key}
              layout="row"
              tone={item.tone}
              card={{ label: item.label, value: item.value, sub: item.sub, pts: item.pts }}
              isMissing={!!item.missing}
              onCardClick={
                ['woonvisie_match', 'beleidsalignement', 'grondwaarde_fit', 'splitsingsrisico', 'parkeerdruk'].includes(
                  item.factor_key,
                )
                  ? () => {}
                  : undefined
              }
            />
          ))}

          <button
            type="button"
            className="group mt-1 flex items-center gap-3 bg-white border border-slate-100 rounded-[18px] px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F6F3] shrink-0">
              <FolderOpen className="size-[18px] text-aura-ink" strokeWidth={1.5} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-bold text-slate-900 leading-tight">Dossiers &amp; bronnen</span>
              <span className="block text-[11px] font-semibold text-slate-400 leading-tight">
                Documenten, vergunningen, checklist
              </span>
            </span>
            <ChevronRight className="size-4 text-slate-300 shrink-0" strokeWidth={2} />
          </button>

          <div className="mt-4 mb-1 flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Binnenkort</span>
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
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 px-8 pb-8 pt-4">
        <button
          type="button"
          className="w-full h-[60px] rounded-full text-[15px] font-bold tracking-tight bg-[#0E1111] text-white hover:bg-slate-800 transition-all active:scale-[0.98]"
        >
          Bewaar perceel
        </button>
      </div>
    </div>
  )
}

const meta: Meta<typeof PanelFrame> = {
  title: 'Parcel/ParcelDetailPanel Redesign',
  component: PanelFrame,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-screen w-screen bg-[#F2F6F3] flex items-center justify-center p-6 overflow-hidden">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PanelFrame>

export const SingleScroll: Story = {}
