/**
 * PotentieLayer stories — M048 Phase 3
 *
 * WOON-01: Click on kaart 10 (WOONVISIE) opens the WoonvisiePopup.
 *
 * Uses QueryClientProvider + AuthContext to satisfy useParcelProjectType hook.
 * Cache is pre-seeded with project_type='nieuwbouw_wonen' to avoid network calls.
 */

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within, userEvent, waitFor } from 'storybook/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import { PotentieLayer } from '@/components/map/panels/parcel/layers/PotentieLayer'
import type { WijkPolicy } from '@/components/map/panels/parcel/WoonvisiePopup'
import type { ScanResultItem } from '@/lib/types/scan'

/* ── Mock Auth (satisfies useAuth requirement of useParcelProjectType) ── */

const PARCEL_ID = '00000000-0000-4000-8000-000000000001'

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

/* ── Mock fixtures ───────────────────────────────────────────────── */

const BLERICK: WijkPolicy = {
  wijk_naam: 'Blerick',
  prioriteit: 'groei',
  gewenste_segmenten: ['sociaal', 'midden'],
  citaat:
    'Blerick blijft een van de drie groeikernen van Venlo. Tot 2030 voorzien wij in minimaal 400 extra woningen.',
  pagina: 24,
}

const mockParcelWithBlerick: ScanResultItem = {
  parcel_id: PARCEL_ID,
  parcel_code: 'NL.IMKAD.KadastraalObject.123',
  address: 'Antoniuslaan 12',
  gemeente_code: 'GM0983',
  area_m2: 850,
  has_pand: true,
  bouwjaar: 1972,
  pand_status: 'Pand in gebruik',
  bestemmingen: [{ type: 'wonen', naam: 'Wonen' }],
  primary_bestemming_type: 'wonen',
  score: 72,
  score_category: 'Medium',
  potentie_score: 72,
  risico_score: 35,
  use_case_scores: null,
  vacancy_signal: 'in_gebruik',
  vacancy_confidence: 0.6,
  vacancy_reasons: null,
  vacancy_model_version: null,
  market_signals: null,
  opportunity_signals: null,
  building_metrics: {
    pand_oppervlakte_m2: 320,
    actual_bouwlagen: 2,
    actual_bouwhoogte: 6,
    max_bouwlagen: 4,
    max_bouwhoogte: 12,
  },
  has_report: false,
  score_breakdown: {
    woonvisie_match: {
      categorie: 'potentie',
      waarde: {
        matched_wijk: 'Blerick',
        matched_policy: BLERICK,
        prioritized_segment: 'sociaal',
        algemeen_citaat: 'Gemeente Venlo voorziet 2.800 nieuwe woningen tot 2030.',
      },
      genormaliseerde_score: 0.85,
      gewicht: 10,
      bijdrage: 8.5,
      percentage_of_category: 0.1,
      missing: false,
      data_bronnen: ['woonvisie_pdf'],
      toelichting_kort: 'Groei + segmentmatch',
      toelichting_lang: null,
    },
  },
}

/* ── Decorator ───────────────────────────────────────────────────── */

/** Create a fresh QueryClient per story and pre-seed project-type cache. */
function makeQueryClient(parcelId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
  // Pre-seed cache so useParcelProjectType never fires a real network request
  queryClient.setQueryData(['parcel-project-type', parcelId], {
    parcel_id: parcelId,
    project_type: 'nieuwbouw_wonen',
    set_at: '2026-04-25T00:00:00Z',
    set_by_user_id: null,
  })
  return queryClient
}

const meta: Meta<typeof PotentieLayer> = {
  title: 'M048/PotentieLayer',
  component: PotentieLayer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      const queryClient = makeQueryClient(PARCEL_ID)
      return (
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={mockAuthValue}>
            <div className="h-screen w-screen bg-[#F2F6F3] flex flex-col overflow-hidden">
              <Story />
            </div>
          </AuthContext.Provider>
        </QueryClientProvider>
      )
    },
  ],
}
export default meta
type Story = StoryObj<typeof PotentieLayer>

/* ── Stories ─────────────────────────────────────────────────────── */

export const Default: Story = {
  name: '1. Potentie grid with woonvisie data',
  args: {
    parcel: mockParcelWithBlerick,
    gemeenteNaam: 'Venlo',
  },
}

export const ClickOpensPopup: Story = {
  name: '2. Click kaart 10 opens popup (WOON-01)',
  args: {
    parcel: mockParcelWithBlerick,
    gemeenteNaam: 'Venlo',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Before click, popup wijk title is not visible
    const bodyBefore = within(document.body)
    await expect(bodyBefore.queryByText('Blerick')).not.toBeInTheDocument()

    // PotentieLayer has 10 cards, CARDS_PER_PAGE=9, so woonvisie_match is on page 2.
    // Navigate to the next page first.
    const nextBtn = canvas.getByRole('button', { name: /volgende pagina/i })
    await userEvent.click(nextBtn)

    // Wait for page transition (AnimatePresence 200ms) then find the WOONVISIE button.
    // The button contains "WOONVISIE" as text (via TruncatedText <p>) inside it.
    let woonvisieButton: HTMLElement | null = null
    await waitFor(() => {
      const allButtons = Array.from(canvasElement.querySelectorAll('button'))
      woonvisieButton = allButtons.find((btn) => btn.textContent?.includes('WOONVISIE')) ?? null
      if (!woonvisieButton) throw new Error('WOONVISIE button not found yet')
    }, { timeout: 2000 })
    await expect(woonvisieButton).not.toBeNull()

    // Click the WOONVISIE button
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await userEvent.click(woonvisieButton!)

    // After click, popup is mounted and shows wijk_naam as h2
    const bodyAfter = within(document.body)
    await expect(bodyAfter.getByText('Blerick')).toBeInTheDocument()
    // Prioriteit label from the shipped minimal popup
    await expect(bodyAfter.getByText('Groeigebied')).toBeInTheDocument()
  },
}
