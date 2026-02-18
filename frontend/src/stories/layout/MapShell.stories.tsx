import type { Meta, StoryObj } from '@storybook/react-vite'
import MapShell from '@/components/layout/MapShell'

/**
 * MapShell is a layout wrapper providing absolute positioning context for
 * floating map UI elements (search bar, layer toggle, inspector panel, overlays).
 *
 * It has no router or auth dependencies — it is a pure CSS layout component.
 */
const meta: Meta<typeof MapShell> = {
  title: 'Layout/MapShell',
  component: MapShell,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof MapShell>

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default: MapShell wrapping a representative map canvas placeholder */
export const Default: Story = {
  args: {
    children: (
      <div className="absolute inset-0 bg-grey-800 flex items-center justify-center">
        <span className="text-grey-400 text-sm">Kaartcanvas</span>
      </div>
    ),
  },
}

/** WithFloatingControls: Shows how floating UI is layered above the map */
export const WithFloatingControls: Story = {
  args: {
    children: (
      <>
        {/* Simulated map background */}
        <div className="absolute inset-0 bg-grey-800" />

        {/* Simulated floating search bar (top-left) */}
        <div className="absolute top-4 left-4 w-72 rounded-lg bg-grey-900/90 backdrop-blur-md border border-grey-800 px-4 py-2.5">
          <span className="text-grey-400 text-sm">Zoek adres of gemeente...</span>
        </div>

        {/* Simulated layer toggle (top-right) */}
        <div className="absolute top-4 right-4 rounded-lg bg-grey-900/90 backdrop-blur-md border border-grey-800 px-3 py-2">
          <span className="text-grey-400 text-xs">Lagen</span>
        </div>

        {/* Simulated inspector panel (right edge) */}
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-grey-900 border-l border-grey-800 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-grey-800">
            <span className="text-sm font-semibold text-grey-100">Perceeldetails</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-grey-400">Selecteer een perceel op de kaart</p>
          </div>
        </div>
      </>
    ),
  },
}
