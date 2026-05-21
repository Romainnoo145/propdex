/**
 * Storybook stories for SavedParcelCard
 *
 * Three states:
 * - Loaded    — pre-seeded aerial thumbnail in QueryClient cache
 * - Loading   — thumbnail query pending (not pre-seeded)
 * - NoThumbnail — pre-seeded null (proxy returned no data)
 *
 * Uses TanStack Query QueryClientProvider + AuthContext + RouterProvider
 * to satisfy hook requirements.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import { routeTree } from '@/routeTree.gen'
import { SavedParcelCard } from '@/components/projects/SavedParcelCard'
import type { FavoriteResponse } from '@/lib/types/portfolio'

// ---------------------------------------------------------------------------
// Shared mock values
// ---------------------------------------------------------------------------

const MOCK_PARCEL_ID = 'HTT02-A-1234'
const MOCK_CACHE_ID = 'abc123-uuid-cache'

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'story-user-id',
    email: 'dev@propdex.nl',
    full_name: 'Storybook User',
    organization_id: 'story-org-id',
    email_verified: true,
    auth_provider: 'email',
    created_at: '2026-01-01T00:00:00Z',
    is_superuser: false,
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

const mockFavorite: FavoriteResponse = {
  id: 'fav-uuid-1',
  parcel_id: MOCK_PARCEL_ID,
  parcel_cache_id: MOCK_CACHE_ID,
  user_id: 'story-user-id',
  gemeente_code: 'GM0983',
  gemeente_naam: 'Venlo',
  wijk_naam: 'Blerick',
  address: 'Kaldenkerkerweg 18, Venlo',
  pipeline_stage: 'Onderzoek',
  afgerond_reden: null,
  notitie: null,
  potentie_score: 72,
  risico_score: 38,
  has_report: false,
  report_id: null,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-17T09:00:00Z',
}

// ---------------------------------------------------------------------------
// QueryClient factories
// ---------------------------------------------------------------------------

/** QueryClient with aerial thumbnail pre-seeded as a data-URL */
const makeLoadedClient = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  // Pre-seed the aerial-crop cache — SavedParcelCard uses ['aerial-crop', parcel_cache_id ?? parcel_id]
  qc.setQueryData(['aerial-crop', MOCK_CACHE_ID], 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
  return qc
}

/** QueryClient with query left pending (no pre-seed — shows skeleton) */
const makeLoadingClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } })

/** QueryClient with aerial thumbnail pre-seeded as null (no data returned) */
const makeNoThumbnailClient = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  qc.setQueryData(['aerial-crop', MOCK_CACHE_ID], null)
  return qc
}

// ---------------------------------------------------------------------------
// Router (needed because SavedParcelCard uses useNavigate)
// ---------------------------------------------------------------------------

const makeRouter = () =>
  createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/opgeslagen'] }),
    context: { auth: { isAuthenticated: true, user: null } },
  })

// ---------------------------------------------------------------------------
// Decorator factory
// ---------------------------------------------------------------------------

const withProviders =
  (queryClient: QueryClient) =>
  (Story: React.ComponentType) => {
    const router = makeRouter()
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthValue}>
          <RouterProvider
            router={router}
            defaultComponent={() => (
              <div className="p-8 bg-aura-canvas min-h-screen">
                <Story />
              </div>
            )}
          />
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SavedParcelCard> = {
  title: 'Projects/SavedParcelCard',
  component: SavedParcelCard,
  parameters: { layout: 'fullscreen' },
  args: {
    parcel: mockFavorite,
    onOpenMap: () => {},
    onPotentieClick: () => {},
    onRisicoClick: () => {},
  },
}

export default meta
type Story = StoryObj<typeof SavedParcelCard>

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Loaded: Story = {
  decorators: [withProviders(makeLoadedClient())],
  play: async ({ canvasElement }) => {
    const canvas = within(document.body)
    // Address visible
    await canvas.findByText('Kaldenkerkerweg 18, Venlo')
    // Municipality visible
    await canvas.findByText('Blerick · Venlo')
    // Score badges rendered (potentie + risico)
    const potentieBadge = await canvas.findByTitle('Potentie: 72')
    expect(potentieBadge).toBeTruthy()
    const risicoBadge = await canvas.findByTitle('Risico: 38')
    expect(risicoBadge).toBeTruthy()
  },
}

export const Loading: Story = {
  decorators: [withProviders(makeLoadingClient())],
  play: async ({ canvasElement: _canvasElement }) => {
    const canvas = within(document.body)
    // Address should still be visible while thumbnail loads
    await canvas.findByText('Kaldenkerkerweg 18, Venlo')
  },
}

export const NoThumbnail: Story = {
  decorators: [withProviders(makeNoThumbnailClient())],
  play: async ({ canvasElement: _canvasElement }) => {
    const canvas = within(document.body)
    // Address visible
    await canvas.findByText('Kaldenkerkerweg 18, Venlo')
    // No thumbnail — fallback text shown
    const noPhoto = await canvas.findByText('geen foto')
    expect(noPhoto).toBeTruthy()
  },
}

// Emulates prefers-reduced-motion: reduce via CSS override (mirrors global rule in styles/index.css:223-252)
const reducedMotionStyle = '*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }'
export const ReducedMotionDegrades: Story = {
  decorators: [(Story) => <><style>{reducedMotionStyle}</style><Story /></>, withProviders(makeLoadedClient())],
  play: async () => {
    // Content still visible when motion is degraded
    await within(document.body).findByText('Kaldenkerkerweg 18, Venlo')
  },
}
