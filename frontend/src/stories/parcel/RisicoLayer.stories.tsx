/**
 * RisicoLayer stories — M048 Phase 7
 *
 * SC#4 + SC#7 + SC#8 mirror coverage on the risico tab.
 * Smoke-only (Potentie story battery is the comprehensive surface).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within, userEvent, waitFor } from 'storybook/test'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import { RisicoLayer } from '@/components/map/panels/parcel/layers/RisicoLayer'
import type { ScanResultItem } from '@/lib/types/scan'
import { makeFactorPin, makeQueryClientWithPins } from '@/test-utils/factorPinsMock'

const PARCEL_ID = '00000000-0000-4000-8000-000000000002'

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'story-user-id', email: 'dev@propdex.nl', full_name: 'Storybook User',
    organization_id: 'story-org-id', email_verified: true, auth_provider: 'email',
    is_superuser: false, created_at: '2026-01-01T00:00:00Z',
  },
  isLoading: false, isAuthenticated: true, accessToken: 'story-token',
  login: async () => {}, register: async () => {}, logout: async () => {},
  loginWithToken: async () => {}, loginAsDemo: () => {}, updateUser: () => {},
}

const mockRisicoParcel = {
  parcel_id: PARCEL_ID,
  area_m2: 800,
  bouwjaar: 1985,
  risico_score: 45,
  score_breakdown: {
    funderingsrisico: { waarde: { fgr: 'klei' }, genormaliseerde_score: 0.6, gewicht: 16, bijdrage: 9.6, categorie: 'risico', toelichting_kort: '', toelichting_lang: '', missing: false, percentage_of_category: 16 },
    asbest: { waarde: { bouwjaar: 1985 }, genormaliseerde_score: 0.4, gewicht: 7, bijdrage: 2.8, categorie: 'risico', toelichting_kort: '', toelichting_lang: '', missing: false, percentage_of_category: 7 },
  },
} as unknown as ScanResultItem

function pinDecorator(pins: ReturnType<typeof makeFactorPin>[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Story: () => any) => {
    const qc = makeQueryClientWithPins(PARCEL_ID, pins, 'risico')
    return (
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={mockAuthValue}>
          <Toaster />
          <div className="h-screen w-screen bg-[#F2F6F3] flex flex-col overflow-hidden">
            <Story />
          </div>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }
}

const meta: Meta<typeof RisicoLayer> = {
  title: 'Parcel/RisicoLayer',
  component: RisicoLayer,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof meta>

export const PinnedPageEmpty: Story = {
  name: 'Phase 7 — Risico pinned page (0 pins → TOP FACTOREN)',
  decorators: [pinDecorator([])],
  args: { parcel: mockRisicoParcel },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('TOP FACTOREN')).toBeInTheDocument()
    const grid = canvasElement.querySelector('.grid-cols-3') as HTMLElement
    await expect(grid.children.length).toBe(6)
  },
}

export const PinnedPageWithRisicoPins: Story = {
  name: 'Phase 7 — Risico pinned page (2 pins + 4 ghosts)',
  decorators: [pinDecorator([
    makeFactorPin('funderingsrisico', 0, 'risico'),
    makeFactorPin('asbest', 1, 'risico'),
  ])],
  args: { parcel: mockRisicoParcel },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('GEPIND')).toBeInTheDocument()
  },
}

export const Max6GuardRisico: Story = {
  name: 'Phase 7 — Risico 7th pin shows toast',
  decorators: [pinDecorator([
    makeFactorPin('funderingsrisico', 0, 'risico'),
    makeFactorPin('asbest', 1, 'risico'),
    makeFactorPin('bodemverontreiniging', 2, 'risico'),
    makeFactorPin('monument', 3, 'risico'),
    makeFactorPin('bestemmingswijziging', 4, 'risico'),
    makeFactorPin('constructieve_staat', 5, 'risico'),
  ])],
  args: { parcel: mockRisicoParcel },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const next = canvas.getByLabelText('Volgende pagina')
    // Walk to a group page with unpinned cards (FYSIEK or KLIMAAT)
    await userEvent.click(next)
    await userEvent.click(next)
    await userEvent.click(next)
    await waitFor(() => {
      const starButtons = canvasElement.querySelectorAll('[data-testid="pin-star-button"]:not([data-pinned="true"])')
      expect(starButtons.length).toBeGreaterThan(0)
    }, { timeout: 1500 })
    const starButtons = canvasElement.querySelectorAll('[data-testid="pin-star-button"]:not([data-pinned="true"])')
    await userEvent.click(starButtons[0] as HTMLElement)
    const body = within(document.body)
    await waitFor(() => expect(body.getByText(/Max 6 bereikt/i)).toBeInTheDocument(), { timeout: 1500 })
  },
}
