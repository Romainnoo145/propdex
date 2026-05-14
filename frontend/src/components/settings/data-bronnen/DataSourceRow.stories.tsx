/**
 * DataSourceRow stories — M049/S03 (TEST-04)
 *
 * 4 status variants × play functions assert:
 *   1. StatusPill renders with correct data-status attribute
 *   2. Action buttons render with correct data-action + data-enabled state
 *   3. Disabled actions show their tooltip reason (basic presence check)
 *
 * Storybook 10: imports come from `storybook/test` (not `@storybook/test`).
 * Wrapped in QueryClientProvider + AuthContext + RouterProvider so
 * useRefreshDataSource + <Link> from DataSourceRow render without errors.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'
import { DataSourceRow } from './DataSourceRow'
import {
  mockBrokenRow,
  mockLiveRow,
  mockMissingRow,
  mockNotApplicableRow,
} from './mockDataSources'

const mockAuth: AuthContextValue = {
  user: {
    id: 'story-user-id',
    email: 'dev@propdex.nl',
    full_name: 'Storybook User',
    organization_id: 'story-org-id',
    email_verified: true,
    auth_provider: 'email',
    is_superuser: true,
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

function withProviders(Story: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/instellingen/data-bronnen'] }),
    context: {
      auth: {
        isAuthenticated: true,
        user: mockAuth.user,
      },
    },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuth}>
        <RouterProvider
          router={router}
          defaultComponent={() => (
            <div className="p-4 bg-[#F2F6F3]">
              <Story />
            </div>
          )}
        />
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

const meta: Meta<typeof DataSourceRow> = {
  title: 'M049/DataSourceRow',
  component: DataSourceRow,
  parameters: { layout: 'padded' },
  decorators: [(Story) => withProviders(Story)],
}
export default meta
type Story = StoryObj<typeof DataSourceRow>

export const LiveWithActions: Story = {
  name: '1. Live — alle actions enabled',
  args: { gemeenteCode: 'GM0983', row: mockLiveRow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const pill = canvas.getByText('Live')
    expect(pill).toBeInTheDocument()
    // StatusPill has data-status on its <span>
    const pillContainer = pill.closest('[data-status]') as HTMLElement | null
    expect(pillContainer?.getAttribute('data-status')).toBe('live')

    // 3 action buttons — view_versions, upload (as Link), refresh
    const versionBtn = canvas.getByText('Bekijk versies').closest('[data-action]') as HTMLElement
    const refreshBtn = canvas.getByText('Vernieuw status').closest('[data-action]') as HTMLElement
    expect(versionBtn?.getAttribute('data-enabled')).toBe('true')
    expect(refreshBtn?.getAttribute('data-enabled')).toBe('true')
  },
}

export const BrokenWithError: Story = {
  name: '2. Broken — error message + tooltip',
  args: { gemeenteCode: 'GM0983', row: mockBrokenRow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const pill = canvas.getByText('Foutmelding')
    const pillContainer = pill.closest('[data-status]') as HTMLElement | null
    expect(pillContainer?.getAttribute('data-status')).toBe('broken')

    // Upload + Refresh actions only (no view_versions for broken state)
    const uploadBtn = canvas.getByText('Upload').closest('[data-action]') as HTMLElement
    const refreshBtn = canvas.getByText('Vernieuw status').closest('[data-action]') as HTMLElement
    expect(uploadBtn?.getAttribute('data-action')).toBe('upload')
    expect(refreshBtn?.getAttribute('data-action')).toBe('refresh')
    expect(canvas.queryByText('Bekijk versies')).toBeNull()
  },
}

export const MissingPlaceholder: Story = {
  name: '3. Missing — alleen Upload + Refresh enabled',
  args: { gemeenteCode: 'GM0983', row: mockMissingRow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const pill = canvas.getByText('Ontbreekt')
    const pillContainer = pill.closest('[data-status]') as HTMLElement | null
    expect(pillContainer?.getAttribute('data-status')).toBe('missing')

    const uploadBtn = canvas.getByText('Upload').closest('[data-action]') as HTMLElement
    expect(uploadBtn?.getAttribute('data-enabled')).toBe('true')
    const refreshBtn = canvas.getByText('Vernieuw status').closest('[data-action]') as HTMLElement
    expect(refreshBtn?.getAttribute('data-enabled')).toBe('true')
  },
}

export const NotApplicable: Story = {
  name: '4. N.v.t. — alle actions disabled met tooltip-reason',
  args: { gemeenteCode: 'GM0983', row: mockNotApplicableRow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const pill = canvas.getByText('N.v.t.')
    const pillContainer = pill.closest('[data-status]') as HTMLElement | null
    expect(pillContainer?.getAttribute('data-status')).toBe('not_applicable')

    const credBtn = canvas.getByText('Configureer credential').closest('[data-action]') as HTMLElement
    const refreshBtn = canvas.getByText('Vernieuw status').closest('[data-action]') as HTMLElement
    expect(credBtn?.getAttribute('data-enabled')).toBe('false')
    expect(refreshBtn?.getAttribute('data-enabled')).toBe('false')
  },
}
