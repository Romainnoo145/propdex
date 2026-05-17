import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { createRouter, RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from '@/routeTree.gen'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import LifecycleSideRailNav from '@/components/layout/LifecycleSideRailNav'

// ---------------------------------------------------------------------------
// Shared mock values
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const makeRouter = (initialPath: string) =>
  createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: {
      auth: {
        isAuthenticated: true,
        user: mockAuthValue.user,
      },
    },
  })

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

// ---------------------------------------------------------------------------
// Decorator factory
// ---------------------------------------------------------------------------

const withProviders =
  (path: string) =>
  (Story: React.ComponentType) => {
    const router = makeRouter(path)
    const queryClient = makeQueryClient()
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthValue}>
          <RouterProvider
            router={router}
            defaultComponent={() => (
              <div className="flex h-screen bg-aura-canvas">
                <Story />
                <div className="flex-1 bg-aura-glass-white/60 flex items-center justify-center">
                  <span className="text-neutral-600 text-sm">Cockpit-inhoud</span>
                </div>
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

const meta: Meta<typeof LifecycleSideRailNav> = {
  title: 'Layout/LifecycleSideRailNav',
  component: LifecycleSideRailNav,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof LifecycleSideRailNav>

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** No active phase — all icons rendered, none highlighted. */
export const Default: Story = {
  args: {},
  decorators: [withProviders('/opgeslagen')],
}

/** Phase 1 (Onderzoek) is active — amber pill should be visible on the Onderzoek icon. */
export const ActiveOnderzoek: Story = {
  args: {
    activePhaseKey: '1-onderzoek',
  },
  decorators: [withProviders('/opgeslagen')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Enabled phase renders as a Link — query by role 'link'
    const onderzoekLink = await canvas.findByRole('link', { name: '1. Onderzoek' })
    await expect(onderzoekLink).toBeInTheDocument()
  },
}

/** Phases 2-6 are disabled — each should carry aria-disabled="true". */
export const DisabledPhasesAreUnclickable: Story = {
  args: {},
  decorators: [withProviders('/opgeslagen')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Disabled phases render as <button disabled aria-disabled="true">
    const eersteContactBtn = await canvas.findByRole('button', { name: '2. Eerste contact' })
    await expect(eersteContactBtn).toHaveAttribute('aria-disabled', 'true')
  },
}
