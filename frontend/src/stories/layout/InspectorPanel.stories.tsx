import type { Meta, StoryObj } from '@storybook/react-vite'
import { InspectorPanel } from '@/components/layout/InspectorPanel'
import type { ScanResultItem } from '@/lib/types/scan'

/**
 * InspectorPanel is the responsive parcel details panel.
 *
 * - Mobile (< md): fixed bottom sheet, slides up from bottom, max 65vh
 * - Desktop (md+): absolute right-edge slide-over, w-80
 *
 * No router or auth dependencies — accepts parcel data via props.
 */
const meta: Meta<typeof InspectorPanel> = {
  title: 'Layout/InspectorPanel',
  component: InspectorPanel,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    isOpen: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof InspectorPanel>

// ---------------------------------------------------------------------------
// Mock parcel data
// ---------------------------------------------------------------------------

const mockParcel: ScanResultItem = {
  parcel_id: 'abc123de-f456-7890-abcd-ef1234567890',
  parcel_code: 'AMS-A-12345-G-0001',
  address: 'Herengracht 420, Amsterdam',
  gemeente_code: '0363',
  area_m2: 850,
  has_pand: true,
  bouwjaar: 1890,
  pand_status: 'Pand in gebruik',
  bestemmingen: [{ type: 'Gemengd', naam: 'Centrum' }],
  score: 78,
  score_category: 'High',
  score_breakdown: { unbebouwd_bonus: 0, age_factor: 30, area_factor: 48 },
  vacancy_signal: 'in_gebruik',
  vacancy_confidence: 0.42,
  vacancy_reasons: [
    'HARD: Pandstatus staat op in gebruik',
    'PROXY: Hoge FAR geeft extra planruimte',
    'PROXY: Groot perceel ondersteunt herontwikkeling',
  ],
  vacancy_model_version: 'vacancy-confidence-v1',
  market_signals: {
    listing_duration_days: 132,
    price_change_count: 2,
    listing_snapshots_count: 7,
    days_since_last_seen: 1,
  },
  opportunity_signals: ['Pand momenteel in gebruik', 'Bestemming ondersteunt wonen/gemengd'],
  building_metrics: { max_bebouwingspercentage: 75, max_floor_area_ratio: null },
  has_report: true,
}

// ---------------------------------------------------------------------------
// Wrapper to simulate map context for absolute positioning
// ---------------------------------------------------------------------------

const MapWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-full h-screen bg-grey-800 overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-grey-500 text-sm">Kaartcanvas (klik om perceel te selecteren)</span>
    </div>
    {children}
  </div>
)

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Closed: Panel is hidden (off-screen via translate-y-full / translate-x-full) */
export const Closed: Story = {
  render: () => (
    <MapWrapper>
      <InspectorPanel
        isOpen={false}
        onClose={() => {}}
        parcel={null}
      />
    </MapWrapper>
  ),
}

/** Open with no parcel: Empty state — "Selecteer een perceel op de kaart" */
export const OpenEmpty: Story = {
  render: () => (
    <MapWrapper>
      <InspectorPanel
        isOpen={true}
        onClose={() => {}}
        parcel={null}
      />
    </MapWrapper>
  ),
}

/** Open with parcel: Shows full parcel detail view */
export const OpenWithParcel: Story = {
  render: () => (
    <MapWrapper>
      <InspectorPanel
        isOpen={true}
        onClose={() => {}}
        parcel={mockParcel}
      />
    </MapWrapper>
  ),
}

/** OpenMinimalParcel: Parcel with only required fields (no optional fields) */
export const OpenMinimalParcel: Story = {
  render: () => (
    <MapWrapper>
      <InspectorPanel
        isOpen={true}
        onClose={() => {}}
        parcel={{
          parcel_id: 'min-123',
          parcel_code: 'AMS-B-00001-G-0001',
          address: null,
          gemeente_code: null,
          area_m2: null,
          has_pand: false,
          bouwjaar: null,
          pand_status: null,
          bestemmingen: null,
          score: null,
          score_category: null,
          score_breakdown: null,
          vacancy_signal: null,
          vacancy_confidence: null,
          vacancy_reasons: null,
          vacancy_model_version: null,
          market_signals: null,
          opportunity_signals: null,
          building_metrics: null,
          has_report: false,
        }}
      />
    </MapWrapper>
  ),
}
