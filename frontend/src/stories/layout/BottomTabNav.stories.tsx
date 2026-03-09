import type { Meta, StoryObj } from '@storybook/react-vite'
import { createRouter, RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import BottomTabNav from '@/components/layout/BottomTabNav'

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
        user: null,
      },
    },
  })

// ---------------------------------------------------------------------------
// Decorator factory — wraps with router and mobile viewport shell
// ---------------------------------------------------------------------------

const withRouter =
  (path: string) =>
  (Story: React.ComponentType) => {
    const router = makeRouter(path)
    return (
      <RouterProvider router={router} defaultComponent={() => (
        <div className="relative h-screen bg-aura-canvas flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <span className="text-neutral-600 text-sm">Paginainhoud</span>
          </div>
          <Story />
        </div>
      )} />
    )
  }

// ---------------------------------------------------------------------------
// Meta
// BottomTabNav has no required props — it reads route via useMatchRoute()
// ---------------------------------------------------------------------------

const meta: Meta<typeof BottomTabNav> = {
  title: 'Layout/BottomTabNav',
  component: BottomTabNav,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BottomTabNav>

// ---------------------------------------------------------------------------
// Stories — active state per primary route
// ---------------------------------------------------------------------------

export const MapActive: Story = {
  decorators: [withRouter('/map')],
}

export const ResultatenActive: Story = {
  decorators: [withRouter('/resultaten')],
}

export const ProjectenActive: Story = {
  decorators: [withRouter('/projecten')],
}
