import type { Meta, StoryObj } from '@storybook/react-vite'
import { createRouter, RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from '@/routeTree.gen'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import SideRailNav from '@/components/layout/SideRailNav'

// ---------------------------------------------------------------------------
// Shared mock values
// ---------------------------------------------------------------------------

/** Minimal mock AuthContextValue — enough for SideRailNav (logout + user info) */
const mockAuthValue: AuthContextValue = {
  user: {
    id: 'story-user-id',
    email: 'dev@propdex.nl',
    full_name: 'Storybook User',
    organization_id: 'story-org-id',
    email_verified: true,
    auth_provider: 'email',
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
        // Prevent background fetches in Storybook
        retry: false,
        staleTime: Infinity,
      },
    },
  })

// ---------------------------------------------------------------------------
// Decorator factory — wraps the story with router + auth + query providers
// plus a dark shell that mirrors production layout
// ---------------------------------------------------------------------------

const withProviders =
  (path: string) =>
  (Story: React.ComponentType) => {
    const router = makeRouter(path)
    const queryClient = makeQueryClient()
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthValue}>
          <RouterProvider router={router} defaultComponent={() => (
            <div className="flex h-screen bg-grey-950">
              <Story />
              <div className="flex-1 bg-grey-900 flex items-center justify-center">
                <span className="text-grey-400 text-sm">Kaartinhoud</span>
              </div>
            </div>
          )} />
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SideRailNav> = {
  title: 'Layout/SideRailNav',
  component: SideRailNav,
  parameters: { layout: 'fullscreen' },
  args: {
    sidebarOpen: false,
    onToggleSidebar: () => {},
  },
}
export default meta
type Story = StoryObj<typeof SideRailNav>

// ---------------------------------------------------------------------------
// Stories — active state per primary route
// ---------------------------------------------------------------------------

export const MapActive: Story = {
  decorators: [withProviders('/map')],
}

export const ResultatenActive: Story = {
  decorators: [withProviders('/resultaten')],
}

export const ProjectenActive: Story = {
  decorators: [withProviders('/projecten')],
}

export const InstellingenActive: Story = {
  decorators: [withProviders('/instellingen')],
}

export const RapportenOpen: Story = {
  args: {
    sidebarOpen: true,
    onToggleSidebar: () => {},
  },
  decorators: [withProviders('/map')],
}
