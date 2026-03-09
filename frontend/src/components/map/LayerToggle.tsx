import { useRef, useEffect, useCallback, useMemo } from 'react'
import type maplibregl from 'maplibre-gl'
import {
  addParcelBoundariesLayer,
  setParcelBoundariesVisibility,
} from './ParcelBoundariesLayer'
import {
  MAP_LAYER_CATALOG,
} from '@/lib/map/layers'
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

  // Score overlay handlers (still called internally via setParcelOverlayMode)
  onScoreToggle?: (visible: boolean) => void
  onBuiltStatusToggle?: (visible: boolean) => void
  onReportStatusToggle?: (visible: boolean) => void
  onVacancySignalToggle?: (visible: boolean) => void
  onBuildCapacityToggle?: (visible: boolean) => void
  onFoundationRiskToggle?: (visible: boolean) => void
  onBAGPandenToggle?: (visible: boolean) => void
  onScannedScopeToggle?: (visible: boolean) => void

  // Auto-enable parcels trigger (will be moved to map.tsx in Plan 02)
  autoEnableParcelsKey?: string | null

  // Score data availability (for legend)
  hasScoreData?: boolean
}

function LayerToggle({
  mapRef,
  mapReady = false,
  basemap,
  showParcels,
  showGemeenten,
  showBestemmingsplan,
  activeParcelOverlay = null,
  onBasemapChange,
  onParcelsToggle,
  onGemeentenToggle,
  onBestemmingsplanToggle,
  onScoreToggle,
  onBuiltStatusToggle,
  onReportStatusToggle,
  onVacancySignalToggle,
  onBuildCapacityToggle,
  onFoundationRiskToggle,
  onBAGPandenToggle,
  onScannedScopeToggle,
  autoEnableParcelsKey,
  hasScoreData,
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
        if (layer === 'aerial') {
          map.setPaintProperty('esri-satellite-layer', 'raster-opacity', 1)
          map.setPaintProperty('carto-light-layer', 'raster-opacity', 0)
        } else {
          map.setPaintProperty('esri-satellite-layer', 'raster-opacity', 0)
          map.setPaintProperty('carto-light-layer', 'raster-opacity', 1)
        }
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

  const setParcelOverlayMode = useCallback(
    (mode: 'score' | 'built' | 'report' | 'vacancy' | 'capacity' | 'foundation' | 'none') => {
      const isScore = mode === 'score'
      const isBuilt = mode === 'built'
      const isReport = mode === 'report'
      const isVacancy = mode === 'vacancy'
      const isCapacity = mode === 'capacity'
      const isFoundation = mode === 'foundation'
      onScoreToggle?.(isScore)
      onBuiltStatusToggle?.(isBuilt)
      onReportStatusToggle?.(isReport)
      onVacancySignalToggle?.(isVacancy)
      onBuildCapacityToggle?.(isCapacity)
      onFoundationRiskToggle?.(isFoundation)
      if (mode !== 'none') {
        ensureParcelInteractionZoom()
      }
    },
    [
      ensureParcelInteractionZoom,
      onBuildCapacityToggle,
      onBuiltStatusToggle,
      onFoundationRiskToggle,
      onReportStatusToggle,
      onScoreToggle,
      onVacancySignalToggle,
    ]
  )

  // Apply basemap when prop changes
  useEffect(() => {
    applyBaseLayer(basemap)
  }, [basemap, applyBaseLayer])

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
      queueMicrotask(() => setParcelOverlayMode('score'))
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
    queueMicrotask(() => setParcelOverlayMode('score'))
  }, [
    autoEnableParcelsKey,
    ensureParcelInteractionZoom,
    isStyleReady,
    mapRef,
    onParcelsToggle,
    setParcelOverlayMode,
    showParcels,
  ])

  // Ensure score overlay is active when parcels are on but no overlay is selected
  const showScore = activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[0].id
  const showBuiltStatus = activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[1].id
  const showReportStatus = activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[2].id
  const showVacancySignal = activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[3].id
  const showBuildCapacity = activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[4].id
  const showFoundationRisk = activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[5].id

  const hasActiveOverlay =
    showScore || showBuiltStatus || showReportStatus || showVacancySignal || showBuildCapacity || showFoundationRisk

  // Derived: ensures parcels always have an overlay when visible
  const needsDefaultOverlay = useMemo(
    () => showParcels && !hasActiveOverlay,
    [showParcels, hasActiveOverlay]
  )

  useEffect(() => {
    if (!needsDefaultOverlay || !isStyleReady()) return
    queueMicrotask(() => setParcelOverlayMode('score'))
  }, [needsDefaultOverlay, isStyleReady, setParcelOverlayMode])

  // Handlers — call parent toggle props (state lives in parent/hook)
  const handleLayerSwitch = (layerId: BaseMapLayerId) => {
    if (layerId === basemap) return
    onBasemapChange(layerId)
  }

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
      setParcelOverlayMode('score')
    }
    if (!nextShowParcels) {
      onScoreToggle?.(false)
      onBuiltStatusToggle?.(false)
      onReportStatusToggle?.(false)
      onVacancySignalToggle?.(false)
      onBuildCapacityToggle?.(false)
      onFoundationRiskToggle?.(false)
    }
  }

  const active = 'bg-aura-amber text-aura-obsidian shadow-sm'
  const inactive = 'bg-transparent text-neutral-600 hover:text-aura-ink hover:bg-neutral-200'
  const overlayActive = 'bg-aura-amber/25 text-aura-amber shadow-sm'
  const overlayInactive = 'bg-transparent text-neutral-600 hover:text-aura-ink hover:bg-neutral-200'

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[var(--z-map-controls)] flex items-center gap-2">
      <div className="bg-aura-glass-white/60 backdrop-blur-md rounded-full p-1 flex gap-0.5 border border-white/40 shadow-glass">
        <button
          onClick={() => handleLayerSwitch('kaart')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            basemap === 'kaart' ? active : inactive
          }`}
        >
          Kaart
        </button>
        <button
          onClick={() => handleLayerSwitch('aerial')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            basemap === 'aerial' ? active : inactive
          }`}
        >
          Satellite
        </button>

        <div className="border-l-2 border-neutral-300 h-6 self-center mx-0.5" />

        <button
          onClick={onGemeentenToggle}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            showGemeenten ? overlayActive : overlayInactive
          }`}
        >
          Gemeenten
        </button>

        <div className="border-l border-neutral-300 h-6 self-center mx-0.5" />

        <button
          onClick={handleParcelsToggle}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            showParcels ? overlayActive : overlayInactive
          }`}
        >
          Percelen
        </button>

        {showParcels && (
          <button
            onClick={onBestemmingsplanToggle}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
              showBestemmingsplan ? overlayActive : overlayInactive
            }`}
          >
            Bestemmingsplan
          </button>
        )}
      </div>
    </div>
  )
}

export default LayerToggle
