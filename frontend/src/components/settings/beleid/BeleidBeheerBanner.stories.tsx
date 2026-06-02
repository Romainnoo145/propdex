/**
 * BeleidBeheerBanner stories — M049/S07 (INT-03)
 *
 * Two stories cover the gemeente-aware Link in the migration banner from
 * `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx`:
 *
 *   1. WithGemeente   → firstGemeenteCode='0983' → href contains '/instellingen/data-bronnen/0983'
 *   2. WithoutGemeente → firstGemeenteCode=undefined → href ends with '/instellingen/data-bronnen'
 *
 * The presentational `BeleidBeheerBanner` component lives LOCALLY in this story
 * file — it is a verbatim copy of the banner JSX from the route file with the
 * resolved gemeente code lifted to a prop. The route file remains the source
 * of truth in production; this twin exists purely to enable play-function
 * coverage of both link branches.
 *
 * Storybook 10 import path: `storybook/test` (NOT `@storybook/test`).
 * Per .storybook/main.ts globs (`src/stories/**`) this file is not in the
 * vitest-storybook run — verification is type-check + structural parity with
 * DataSourceRow.stories.tsx (precedent: M049/S06 Plan 06-03 decision).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  Link,
  RouterProvider,
} from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { AuthContext } from '@/lib/auth/AuthContext'
import type { AuthContextValue } from '@/lib/auth/types'

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

/**
 * Local presentational twin of the banner block inside
 * `instellingen.beleid-beheer.tsx`. JSX must stay byte-for-byte aligned with
 * the route file's banner copy + classes.
 */
function BeleidBeheerBanner({
  firstGemeenteCode,
}: {
  firstGemeenteCode: string | undefined
}) {
  return (
    <div className="bg-[#F9A826]/15 border border-[#F9A826]/30 rounded-2xl p-4 mb-6">
      <p className="text-[13px] text-[#0E1111]">
        <strong>Gemeente-documenten beheer je nu vanuit Data-bronnen.</strong>
        {' '}Landelijk/Provincie blijft hier tot M050.{' '}
        {firstGemeenteCode ? (
          <Link
            to="/instellingen/data-bronnen/$gemeenteCode"
            params={{ gemeenteCode: firstGemeenteCode }}
            className="font-semibold underline"
          >
            Ga naar Data-bronnen →
          </Link>
        ) : (
          <Link to="/instellingen/data-bronnen" className="font-semibold underline">
            Ga naar Data-bronnen →
          </Link>
        )}
      </p>
    </div>
  )
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

const meta: Meta<typeof BeleidBeheerBanner> = {
  title: 'M049/BeleidBeheerBanner',
  component: BeleidBeheerBanner,
  parameters: { layout: 'padded' },
  decorators: [(Story) => withProviders(Story)],
}
export default meta
type Story = StoryObj<typeof BeleidBeheerBanner>

export const WithGemeente: Story = {
  name: '1. WithGemeente — deeplink naar /instellingen/data-bronnen/0983',
  args: { firstGemeenteCode: '0983' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = await canvas.findByText('Ga naar Data-bronnen →')
    const href = link.getAttribute('href') ?? ''
    await expect(href).toContain('/instellingen/data-bronnen/0983')
  },
}

export const WithoutGemeente: Story = {
  name: '2. WithoutGemeente — fallback naar /instellingen/data-bronnen index',
  args: { firstGemeenteCode: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = await canvas.findByText('Ga naar Data-bronnen →')
    const href = link.getAttribute('href') ?? ''
    await expect(href).toMatch(/\/instellingen\/data-bronnen$/)
  },
}
