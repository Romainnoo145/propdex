/**
 * ParcelDetailPanel redesign — scroll-within-tab (corrected scope).
 *
 * The bento overview + the CategoryTabs (Potentie | Risico | Dossiers) stay as
 * they were. This story renders the changed part: a tab whose body is now a
 * sticky verdict-hero + ONE continuous weight-sorted FactorCard scroll (no more
 * 4-per-page PageTitleToggle), with per-tab "binnenkort" placeholders at the
 * bottom. Toggle the tabs to compare Potentie vs Risico. Realistic panel
 * HEIGHT so ~6 rows are visible at once (w-[620px] is the panel WIDTH).
 */

import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import { CategoryTabs } from '@/components/map/panels/parcel/CategoryTabs'
import type { CategoryKey } from '@/components/map/panels/parcel/ParcelBentoOverview'
import { PotentieLayer } from '@/components/map/panels/parcel/layers/PotentieLayer'
import { RisicoLayer } from '@/components/map/panels/parcel/layers/RisicoLayer'
import type { ScanResultItem, ScoreFactorV3 } from '@/lib/types/scan'

const PARCEL_ID = '00000000-0000-4000-8000-000000000abc'

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'story-user-id',
    email: 'dev@propdex.nl',
    full_name: 'Storybook User',
    organization_id: 'story-org-id',
    email_verified: true,
    auth_provider: 'email',
    is_superuser: false,
    created_at: '2026-01-01T00:00:00Z',
    hauzer_demo: false,
  },
  isLoading: false,
  isAuthenticated: true,
  accessToken: 'story-token',
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  loginWithToken: async () => {},
  loginAsDemo: () => {},
  updateUser: () => {},
}

const fac = (
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
  parcel_id: PARCEL_ID,
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
    woonvisie_match: fac('potentie', { matched_policy: { prioriteit: 'groei', wijk_naam: 'Centrum' }, matched_wijk: 'Centrum' }, 12.4),
    vrije_grond: fac('potentie', 0.64, 9.1),
    bestemming: fac('potentie', null, 6.2),
    grondwaarde_fit: fac('potentie', { verdict: 'passend', prijs_per_m2_min: 480, prijs_per_m2_max: 720, functiecategorie: 'vrij' }, 5.0),
    leegstand: fac('potentie', null, 4.4),
    beleidsalignement: fac('potentie', { matched_gebied: 'Binnenstad', verdict: 'kansrijk' }, 3.1),
    perceelgrootte: fac('potentie', null, 2.0),
    demografie: fac('potentie', null, 0, true),
    splitsingsrisico: fac('risico', { verdict: 'mogelijk_van_toepassing', buurt_naam: 'Q4' }, -8.7),
    parkeerdruk: fac('risico', { verdict: 'verhoogd', gebied: 'centrum' }, -6.3),
    asbest: fac('risico', { bouwjaar: 1968 }, -4.9),
    funderingsrisico: fac('risico', { fgr: 'klei' }, -3.4),
    criminaliteit: fac('risico', { per_1000_inwoners: 62 }, -2.6),
    monument: fac('risico', false, -1.2),
    bodemverontreiniging: fac('risico', null, 0, true),
  },
}

function makeQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(['parcel-project-type', PARCEL_ID], {
    parcel_id: PARCEL_ID,
    project_type: 'nieuwbouw_wonen',
    set_at: '2026-04-25T00:00:00Z',
    set_by_user_id: null,
  })
  return queryClient
}

function PanelDemo() {
  const [tab, setTab] = useState<CategoryKey>('potentie')
  return (
    <div className="w-[620px] h-[840px] flex flex-col overflow-hidden rounded-[40px] bg-white/70 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
      {/* Address + tabs (unchanged structure) */}
      <div className="px-8 pt-8 shrink-0">
        <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight">Parade 21, 5911 CB Venlo</h2>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">NL.IMKAD.KadastraalObject.456</p>
        <div className="mt-4">
          <CategoryTabs activeCategory={tab} onSelect={setTab} />
        </div>
      </div>

      {/* Tab body — scroll-within-tab */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === 'potentie' && <PotentieLayer parcel={PARCEL} gemeenteNaam="Venlo" />}
        {tab === 'risico' && <RisicoLayer parcel={PARCEL} />}
        {tab === 'dossiers' && (
          <div className="px-8 py-8 text-[13px] text-slate-400 italic">
            Dossiers-tab: BronnenLayer (ongewijzigd) — niet in deze story gemockt.
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 px-8 pb-8 pt-4">
        <button
          type="button"
          className="w-full h-[60px] rounded-full text-[15px] font-bold tracking-tight bg-aura-obsidian text-white hover:bg-slate-800 transition-all active:scale-[0.98]"
        >
          Bewaar perceel
        </button>
      </div>
    </div>
  )
}

const meta: Meta<typeof PanelDemo> = {
  title: 'Parcel/ParcelDetailPanel Redesign',
  component: PanelDemo,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <AuthContext.Provider value={mockAuthValue}>
          <div className="h-screen w-screen bg-aura-canvas flex items-center justify-center p-6 overflow-hidden">
            <Story />
          </div>
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PanelDemo>

export const ScrollWithinTab: Story = {}
