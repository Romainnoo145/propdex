import type { Meta, StoryObj } from '@storybook/react-vite'
import ResultsShell from '@/components/layout/ResultsShell'

/**
 * ResultsShell is the scrollable content shell for non-map authenticated routes.
 *
 * Uses solid bg-grey-950 background (NOT glassmorphism) per DS-04.
 * pb-14 md:pb-0 clears the fixed bottom tab bar on mobile.
 *
 * Routes using this: /projecten, /instellingen, /rapport/:id, /resultaten (fullWidth)
 */
const meta: Meta<typeof ResultsShell> = {
  title: 'Layout/ResultsShell',
  component: ResultsShell,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    fullWidth: {
      control: 'boolean',
      description: 'Bypass inner max-w-5xl container for full-width data views (e.g. /resultaten)',
    },
  },
}
export default meta
type Story = StoryObj<typeof ResultsShell>

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default: Centered content area (used on /projecten, /instellingen) */
export const Default: Story = {
  args: {
    children: (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-grey-100">Pagina inhoud</h1>
        <p className="text-grey-400">
          Gesimuleerde inhoud in het gecentreerde content-gebied (max-w-5xl, px-6 py-8).
          Dit patroon wordt gebruikt op /projecten en /instellingen.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-grey-900 border border-grey-800 flex items-center justify-center">
              <span className="text-grey-600 text-sm">Kaart {i}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
}

/** FullWidth: Full-width data view (used on /resultaten for the results table) */
export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: (
      <div className="flex flex-col h-full">
        {/* Simulated full-width results table header */}
        <div className="px-6 py-4 border-b border-grey-800 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-grey-100">Scanresultaten</h1>
          <span className="text-sm text-grey-400">128 percelen gevonden</span>
        </div>

        {/* Simulated full-width table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-grey-800 bg-grey-900">
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-400 uppercase tracking-wider">Adres</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-400 uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-400 uppercase tracking-wider">Oppervlak</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-grey-400 uppercase tracking-wider">Bestemming</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-grey-800 hover:bg-grey-900/50">
                  <td className="px-4 py-3 text-sm text-grey-100">Voorbeeldstraat {i * 10}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-amber-accent">{60 + i * 5}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-grey-400">{500 + i * 100} m²</td>
                  <td className="px-4 py-3 text-sm text-grey-400">Wonen</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
}

/** WithScrollContent: Verifies overflow-y-auto behavior with long content */
export const WithScrollContent: Story = {
  args: {
    children: (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-grey-100">Scroll-test</h1>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-grey-900 border border-grey-800 flex items-center px-4">
            <span className="text-grey-400 text-sm">Inhoudsblok {i + 1}</span>
          </div>
        ))}
      </div>
    ),
  },
}
