/**
 * DataSourceRow stories — M049/S03 (TEST-04)
 *
 * 4 status variants × play functions assert:
 *   1. Status icon renders with correct aria-label + parent data-status
 *   2. Action buttons render with correct aria-label + data-enabled state
 *   3. Type A "missing" hides the refresh button (only Upload is meaningful)
 *
 * Status pill text dropped — icon + aria-label carry semantic.
 * Action buttons are icon-only — query via getByLabelText / aria-label.
 *
 * Storybook 10: imports come from `storybook/test` (not `@storybook/test`).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
  args: { gemeenteCode: 'GM0983', row: mockLiveRow, onUpload: fn(), onViewVersions: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const icon = canvas.getByLabelText('Live')
    const rowContainer = icon.closest('[data-status]') as HTMLElement | null
    expect(rowContainer?.getAttribute('data-status')).toBe('live')

    const versionBtn = canvas.getByLabelText('Bekijk versies') as HTMLElement
    const refreshBtn = canvas.getByLabelText('Vernieuw status') as HTMLElement
    expect(versionBtn.getAttribute('data-enabled')).toBe('true')
    expect(refreshBtn.getAttribute('data-enabled')).toBe('true')

    // Bekijk versies button is now a <button> not a <Link> — fires onViewVersions callback
    await userEvent.click(versionBtn)
    expect(args.onViewVersions).toHaveBeenCalled()
  },
}

export const BrokenWithError: Story = {
  name: '2. Broken — error message + tooltip',
  args: { gemeenteCode: 'GM0983', row: mockBrokenRow, onUpload: fn(), onViewVersions: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const icon = canvas.getByLabelText('Foutmelding')
    const rowContainer = icon.closest('[data-status]') as HTMLElement | null
    expect(rowContainer?.getAttribute('data-status')).toBe('broken')

    const uploadBtn = canvas.getByLabelText('Upload') as HTMLElement
    const refreshBtn = canvas.getByLabelText('Vernieuw status') as HTMLElement
    expect(uploadBtn.getAttribute('data-action')).toBe('upload')
    expect(refreshBtn.getAttribute('data-action')).toBe('refresh')
    expect(canvas.queryByLabelText('Bekijk versies')).toBeNull()
  },
}

export const MissingPlaceholder: Story = {
  name: '3. Missing — Type A hides refresh, alleen Upload',
  args: { gemeenteCode: 'GM0983', row: mockMissingRow, onUpload: fn(), onViewVersions: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const icon = canvas.getByLabelText('Ontbreekt')
    const rowContainer = icon.closest('[data-status]') as HTMLElement | null
    expect(rowContainer?.getAttribute('data-status')).toBe('missing')

    const uploadBtn = canvas.getByLabelText('Upload') as HTMLElement
    expect(uploadBtn.getAttribute('data-enabled')).toBe('true')
    // Upload button is now a <button> (no longer a <Link>)
    expect(uploadBtn.tagName).toBe('BUTTON')
    expect(uploadBtn.getAttribute('data-action')).toBe('upload')
    // Type A + missing → refresh deliberately hidden
    expect(canvas.queryByLabelText('Vernieuw status')).toBeNull()

    // Upload button fires onUpload callback (not Link navigation)
    await userEvent.click(uploadBtn)
    expect(args.onUpload).toHaveBeenCalled()
  },
}

export const NotApplicable: Story = {
  name: '4. N.v.t. — alle actions disabled met tooltip-reason',
  args: { gemeenteCode: 'GM0983', row: mockNotApplicableRow, onUpload: fn(), onViewVersions: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const icon = canvas.getByLabelText('Niet van toepassing')
    const rowContainer = icon.closest('[data-status]') as HTMLElement | null
    expect(rowContainer?.getAttribute('data-status')).toBe('not_applicable')

    const credBtn = canvas.getByLabelText('Configureer credential') as HTMLElement
    const refreshBtn = canvas.getByLabelText('Vernieuw status') as HTMLElement
    expect(credBtn.getAttribute('data-enabled')).toBe('false')
    expect(refreshBtn.getAttribute('data-enabled')).toBe('false')
  },
}

// ── M049/S06 — view_action_item button (TEST-05) ────────────────────────────
export const WithActionItem: Story = {
  name: '5. WithActionItem — view_action_item knop opent ActionItem-modal',
  args: {
    gemeenteCode: 'GM0983',
    row: {
      source_key: 'welstandsnota',
      label_nl: 'Welstandsnota',
      source_type: 'A',
      status: 'live',
      last_checked: new Date('2026-05-15T12:00:00Z').toISOString(),
      error_message: null,
      configuratie: null,
      available_actions: [
        { action: 'view_versions', enabled: true, label_nl: 'Bekijk versies', reason_disabled: null },
        { action: 'upload', enabled: true, label_nl: 'Upload', reason_disabled: null },
        { action: 'refresh', enabled: true, label_nl: 'Vernieuw status', reason_disabled: null },
        { action: 'view_action_item', enabled: true, label_nl: 'Bekijk action item', reason_disabled: null },
      ],
    },
    onUpload: fn(),
    onViewVersions: fn(),
    onConfigureCredential: fn(),
    onViewActionItem: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const actionItemButton = canvas.getByLabelText('Bekijk action item') as HTMLElement
    expect(actionItemButton).toBeInTheDocument()
    expect(actionItemButton.getAttribute('data-action')).toBe('view_action_item')
    expect(actionItemButton.getAttribute('data-enabled')).toBe('true')

    await userEvent.click(actionItemButton)
    expect(args.onViewActionItem).toHaveBeenCalledTimes(1)
    expect(args.onViewActionItem).toHaveBeenCalledWith('welstandsnota')
  },
}
