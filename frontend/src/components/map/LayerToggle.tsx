import { useRef, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import type maplibregl from 'maplibre-gl'
import {
  addParcelBoundariesLayer,
  setParcelBoundariesVisibility,
} from './ParcelBoundariesLayer'
import type { BaseMapLayerId, ParcelOverlayLayerId } from '@/lib/map/layers'
import { PARCEL_INTERACTION_MIN_ZOOM } from '@/lib/map/constants'

interface LayerToggleProps {
  // Map readiness
  mapRef: React.RefObject<maplibregl.Map | null>
  mapReady?: boolean

  // State from useMapLayerState (or map.tsx until Plan 02 wires the hook)
  basemap: BaseMapLayerId
  showParcels: boolean
  showGemeenten: boolean
  showBestemmingsplan: boolean
  activeParcelOverlay?: ParcelOverlayLayerId | null

  // Handlers
  onBasemapChange: (v: BaseMapLayerId) => void
  onParcelsToggle: () => void
  onGemeentenToggle: () => void
  onBestemmingsplanToggle: () => void

  // Unified overlay select — delegates to handleOverlaySelect in map.tsx
  onOverlaySelect: (id: ParcelOverlayLayerId) => void
  onBAGPandenToggle?: (visible: boolean) => void
  onScannedScopeToggle?: (visible: boolean) => void

  // Auto-enable parcels trigger (will be moved to map.tsx in Plan 02)
  autoEnableParcelsKey?: string | null

  // Score data availability (for legend)
  hasScoreData?: boolean
}

/* ── Spring config for layoutId sliding indicator ── */
const springTransition = { type: 'spring' as const, stiffness: 500, damping: 30 }

/* ── ToggleButton with layoutId active indicator ── */
interface ToggleButtonProps {
  active: boolean
  /** layoutId section scope — indicator only slides within its section */
  sectionId: string
  onClick: () => void
  glow?: boolean
  children: React.ReactNode
}

function ToggleButton({ active, sectionId, onClick, glow = false, children }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
        active
          ? 'text-white'
          : 'text-aura-ink/70 hover:text-aura-ink hover:scale-105'
      } ${glow && active ? 'shadow-[0_0_12px_rgba(249,168,38,0.3)]' : ''}`}
    >
      {active && (
        <motion.div
          layoutId={`toggle-indicator-${sectionId}`}
          className="absolute inset-0 bg-aura-amber rounded-full"
          transition={springTransition}
          style={{ zIndex: -1 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

function LayerToggle({
  mapRef,
  mapReady = false,
  basemap,
  showParcels,
  showGemeenten,
  showBestemmingsplan,
  activeParcelOverlay = null,
  onBasemapChange: _onBasemapChange,
  onParcelsToggle,
  onGemeentenToggle,
  onBestemmingsplanToggle,
  onOverlaySelect,
  onBAGPandenToggle,
  onScannedScopeToggle,
  autoEnableParcelsKey,
  hasScoreData: _hasScoreData,
}: LayerToggleProps) {
  const isStyleReady = useCallback(() => {
    const map = mapRef.current
    return Boolean(map && mapReady && map.isStyleLoaded())
  }, [mapReady, mapRef])

  const applyBaseLayer = useCallback(
    (layer: BaseMapLayerId) => {
      if (!isStyleReady()) return
      if (!mapRef.current) return
      const map = mapRef.current
      try {
        // Vector basemap is always present — just toggle satellite raster overlay
        map.setPaintProperty('esri-satellite-layer', 'raster-opacity', layer === 'aerial' ? 1 : 0)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes('Style is not done loading')) {
          throw error
        }
      }
    },
    [isStyleReady, mapRef]
  )

  const ensureParcelInteractionZoom = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const currentZoom = map.getZoom()
    if (currentZoom >= PARCEL_INTERACTION_MIN_ZOOM) return
    // If style is mid-transition (e.g. gemeente layers being removed),
    // defer the zoom until the style settles — avoids needing a second click.
    if (!map.isStyleLoaded()) {
      map.once('idle', () => {
        if (map.getZoom() < PARCEL_INTERACTION_MIN_ZOOM) {
          map.easeTo({ zoom: PARCEL_INTERACTION_MIN_ZOOM, duration: 550 })
        }
      })
      return
    }
    map.easeTo({ zoom: PARCEL_INTERACTION_MIN_ZOOM, duration: 550 })
  }, [mapRef])

  // Apply basemap whenever prop changes OR map becomes ready.
  useEffect(() => {
    if (!isStyleReady()) return
    applyBaseLayer(basemap)
  }, [basemap, applyBaseLayer, mapReady, isStyleReady])

  // One-time init: add parcel source + set initial layer visibility when map is ready
  const didInitSyncRef = useRef(false)
  useEffect(() => {
    if (!mapReady) return
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return
    if (didInitSyncRef.current) return
    didInitSyncRef.current = true
    const map = mapRef.current
    if (!map.getSource('pdok-parcels')) {
      addParcelBoundariesLayer(map)
    }
    setParcelBoundariesVisibility(map, showParcels)
    onBAGPandenToggle?.(false)
    onScannedScopeToggle?.(false)
    if (showParcels) {
      queueMicrotask(() => onOverlaySelect('potential'))
    }
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps
  // ^ Intentionally only [mapReady] — this is a one-time init effect guarded by didInitSyncRef

  // Auto-enable parcels trigger (external, e.g. address search activating parcel mode)
  const lastAutoEnableRef = useRef<string | null>(null)
  useEffect(() => {
    if (!autoEnableParcelsKey || !mapRef.current || !isStyleReady()) return
    if (lastAutoEnableRef.current === autoEnableParcelsKey) return
    lastAutoEnableRef.current = autoEnableParcelsKey

    const map = mapRef.current
    if (!map.getSource('pdok-parcels')) {
      addParcelBoundariesLayer(map)
    }
    setParcelBoundariesVisibility(map, true)
    // Notify parent to set showParcels: true
    if (!showParcels) {
      onParcelsToggle()
    }
    ensureParcelInteractionZoom()
    queueMicrotask(() => onOverlaySelect('potential'))
  }, [
    autoEnableParcelsKey,
    ensureParcelInteractionZoom,
    isStyleReady,
    mapRef,
    onParcelsToggle,
    onOverlaySelect,
    showParcels,
  ])

  // Ensure score overlay is active when parcels are on but no overlay is selected
  const showScore = activeParcelOverlay === 'potential'
  const showBuiltStatus = activeParcelOverlay === 'built_status'
  const showReportStatus = activeParcelOverlay === 'report_coverage'
  const showVacancySignal = activeParcelOverlay === 'vacancy_signal'
  const showBuildCapacity = activeParcelOverlay === 'build_capacity'
  const showFoundationRisk = activeParcelOverlay === 'foundation_risk'
  const isBestemmingsplanActive = activeParcelOverlay === 'bestemmingsplan'

  const hasActiveOverlay =
    showScore || showBuiltStatus || showReportStatus || showVacancySignal || showBuildCapacity || showFoundationRisk || isBestemmingsplanActive

  // Derived: ensures parcels always have an overlay when visible
  const needsDefaultOverlay = useMemo(
    () => showParcels && !hasActiveOverlay,
    [showParcels, hasActiveOverlay]
  )

  useEffect(() => {
    if (!needsDefaultOverlay || !isStyleReady()) return
    queueMicrotask(() => onOverlaySelect('potential'))
  }, [needsDefaultOverlay, isStyleReady, onOverlaySelect])

  const handleParcelsToggle = () => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const nextShowParcels = !showParcels
    if (!map.getSource('pdok-parcels')) {
      addParcelBoundariesLayer(map)
    }
    setParcelBoundariesVisibility(map, nextShowParcels)
    onParcelsToggle()
    if (nextShowParcels) {
      ensureParcelInteractionZoom()
      onOverlaySelect('potential')
    }
    if (!nextShowParcels) {
      // Overlay cleanup is handled by handleParcelsLayerToggle in map.tsx
      // Turn off bestemmingsplan when parcels go off
      if (showBestemmingsplan) onBestemmingsplanToggle()
    }
  }

  /* ── Determine active view level for layoutId ── */
  const activeViewLevel = showParcels ? 'perceel' : showGemeenten ? 'gemeente' : null

  return (
    <div className="flex items-center gap-1">
      {/* View level */}
      <div className="flex items-center gap-0.5 px-1">
        <ToggleButton
          active={activeViewLevel === 'gemeente'}
          sectionId="view"
          onClick={onGemeentenToggle}
        >
          Gemeente
        </ToggleButton>
      </div>

      <div className="h-5 w-px bg-white/30 shrink-0" />

      <div className="flex items-center gap-0.5 px-1">
        <ToggleButton
          active={activeViewLevel === 'perceel'}
          sectionId="perceel"
          onClick={handleParcelsToggle}
        >
          Perceel
        </ToggleButton>
      </div>
    </div>
  )
}

export default LayerToggle
