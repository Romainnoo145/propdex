import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import ReportSidebar from '@/components/layout/ReportSidebar'

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

/** QueryClient with no data — hooks return { data: undefined, isLoading: false } */
const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        // Prevent network requests in Storybook
        gcTime: 0,
      },
    },
  })

// ---------------------------------------------------------------------------
// Decorator: wrap with QueryClient + AuthContext providers
// ---------------------------------------------------------------------------

const withProviders = (Story: React.ComponentType) => (
  <QueryClientProvider client={makeQueryClient()}>
    <AuthContext.Provider value={mockAuthValue}>
      <Story />
    </AuthContext.Provider>
  </QueryClientProvider>
)

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof ReportSidebar> = {
  title: 'Layout/ReportSidebar',
  component: ReportSidebar,
  parameters: { layout: 'fullscreen' },
  decorators: [withProviders],
  args: {
    isOpen: true,
    onClose: () => {},
    onSelectReport: () => {},
    onSelectRecent: () => {},
  },
}
export default meta
type Story = StoryObj<typeof ReportSidebar>

// ---------------------------------------------------------------------------
// Wrapper to simulate the layout context (side-rail + content area)
// ---------------------------------------------------------------------------

const SidebarShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen bg-aura-canvas">
    {/* Simulated side-rail */}
    <div className="hidden md:flex w-16 shrink-0 bg-aura-glass-white/60 border-r border-neutral-200 items-center justify-center">
      <span className="text-neutral-500 text-xs">Nav</span>
    </div>
    {/* Sidebar slot */}
    {children}
    {/* Content area */}
    <div className="flex-1 bg-aura-glass-white/60 flex items-center justify-center">
      <span className="text-neutral-600 text-sm">Kaartinhoud</span>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Closed: Sidebar returns null when isOpen=false.
 * Shows the layout shell with sidebar collapsed.
 */
export const Closed: Story = {
  render: () => (
    <SidebarShell>
      <ReportSidebar
        isOpen={false}
        onClose={() => {}}
        onSelectReport={() => {}}
        onSelectRecent={() => {}}
      />
    </SidebarShell>
  ),
}

/**
 * Open: Sidebar visible with empty state (no reports in Storybook — no live API).
 * Shows header, structure, and "Geen opgeslagen rapporten" empty state.
 */
export const Open: Story = {
  render: () => (
    <SidebarShell>
      <ReportSidebar
        isOpen={true}
        onClose={() => {}}
        onSelectReport={() => {}}
        onSelectRecent={() => {}}
      />
    </SidebarShell>
  ),
}
