import type { ParcelOverlayLayerId } from '@/lib/map/layers'

/**
 * Per-mode legend for parcel overlay color modes.
 * Renders a compact color key matching the paint expressions in ParcelScoreLayer.tsx.
 */

interface OverlayLegendProps {
  activeOverlay: ParcelOverlayLayerId | null
  visible: boolean
}

/* ── Color swatch + label ── */
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-neutral-600 whitespace-nowrap">{label}</span>
    </div>
  )
}

function PotentialLegend() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-600">40</span>
      <div
        className="h-3 w-24 rounded-full"
        style={{ background: 'linear-gradient(to right, #f59e0b, #84cc16, #16a34a)' }}
      />
      <span className="text-xs text-neutral-600">100</span>
    </div>
  )
}

function BuiltStatusLegend() {
  return (
    <div className="flex items-center gap-3">
      <Swatch color="#ef4444" label="Bebouwd" />
      <Swatch color="#22c55e" label="Onbebouwd" />
    </div>
  )
}

function ReportCoverageLegend() {
  return (
    <div className="flex items-center gap-3">
      <Swatch color="#f59e0b" label="Rapport" />
      <Swatch color="#64748b" label="Geen rapport" />
    </div>
  )
}

function VacancySignalLegend() {
  return (
    <div className="flex items-center gap-3">
      <Swatch color="#22c55e" label="Leeg perceel" />
      <Swatch color="#f59e0b" label="Leegstaand" />
      <Swatch color="#ef4444" label="In gebruik" />
      <Swatch color="#64748b" label="Onbekend" />
    </div>
  )
}

function BuildCapacityLegend() {
  return (
    <div className="flex items-center gap-3">
      <Swatch color="#16a34a" label="Hoog FAR" />
      <Swatch color="#65a30d" label="Gemiddeld" />
      <Swatch color="#eab308" label="Bebouwings%" />
      <Swatch color="#64748b" label="Laag" />
    </div>
  )
}

function FoundationRiskLegend() {
  return (
    <div className="flex items-center gap-3">
      <Swatch color="#f59e0b" label="Hoog (pre-1970)" />
      <Swatch color="#fbbf24" label="Middel (1970-1990)" />
      <Swatch color="#64748b" label="Laag (post-1990)" />
    </div>
  )
}

function BestemmingsplanLegendEntry() {
  return (
    <div className="flex items-center gap-3">
      <Swatch color="#6366F1" label="Bestemming" />
      <Swatch color="#818CF8" label="Functie" />
    </div>
  )
}

const LEGEND_MAP: Record<ParcelOverlayLayerId, () => React.JSX.Element> = {
  potential: PotentialLegend,
  built_status: BuiltStatusLegend,
  report_coverage: ReportCoverageLegend,
  vacancy_signal: VacancySignalLegend,
  build_capacity: BuildCapacityLegend,
  foundation_risk: FoundationRiskLegend,
  bestemmingsplan: BestemmingsplanLegendEntry,
}

export default function OverlayLegend({ activeOverlay, visible }: OverlayLegendProps) {
  if (!visible || !activeOverlay) return null
  // Bestemmingsplan has its own dedicated BestemmingsplanLegend component
  if (activeOverlay === 'bestemmingsplan') return null

  const LegendComponent = LEGEND_MAP[activeOverlay]
  if (!LegendComponent) return null

  return (
    <div className="absolute bottom-20 left-8 z-[var(--z-map-controls)] bg-aura-glass-white/60 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-2 border border-white/40 shadow-glass">
      <LegendComponent />
    </div>
  )
}
