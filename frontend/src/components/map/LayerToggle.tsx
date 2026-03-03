import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type maplibregl from 'maplibre-gl'
import {
  addParcelBoundariesLayer,
  setParcelBoundariesVisibility,
} from './ParcelBoundariesLayer'
import {
  MAP_LAYER_CATALOG,
  readPersistedMapLayerState,
  writePersistedMapLayerState,
} from '@/lib/map/layers'
import { PARCEL_INTERACTION_MIN_ZOOM } from '@/lib/map/constants'

type LayerType = 'aerial' | 'kaart'

interface LayerToggleProps {
  mapRef: React.RefObject<maplibregl.Map | null>
  mapReady?: boolean
  onParcelsToggle?: (visible: boolean) => void
  onGemeentenToggle?: (visible: boolean) => void
  onBestemmingsplanToggle?: (visible: boolean) => void
  onBAGPandenToggle?: (visible: boolean) => void
  onWijkenToggle?: (visible: boolean) => void
  showWijkenToggle?: boolean
  onScoreToggle?: (visible: boolean) => void
  showScoreToggle?: boolean
  onBuiltStatusToggle?: (visible: boolean) => void
  showBuiltStatusToggle?: boolean
  onReportStatusToggle?: (visible: boolean) => void
  showReportStatusToggle?: boolean
  onVacancySignalToggle?: (visible: boolean) => void
  showVacancySignalToggle?: boolean
  onBuildCapacityToggle?: (visible: boolean) => void
  showBuildCapacityToggle?: boolean
  onScannedScopeToggle?: (visible: boolean) => void
  showScannedScopeToggle?: boolean
  showBAGPandenToggle?: boolean
  autoEnableParcelsKey?: string | null
  hasScoreData?: boolean
}

function LayerToggle({
  mapRef,
  mapReady = false,
  onParcelsToggle,
  onGemeentenToggle,
  onBestemmingsplanToggle,
  onBAGPandenToggle,
  onWijkenToggle: _onWijkenToggle,
  onScoreToggle,
  onBuiltStatusToggle,
  onReportStatusToggle,
  onVacancySignalToggle,
  onBuildCapacityToggle,
  onScannedScopeToggle,
  autoEnableParcelsKey,
  hasScoreData,
}: LayerToggleProps) {
  const persisted = useMemo(() => readPersistedMapLayerState(), [])

  const [activeLayer, setActiveLayer] = useState<LayerType>(persisted.basemap)
  const [showParcels, setShowParcels] = useState(persisted.showParcels)
  const [showGemeenten] = useState(persisted.showGemeenten)
  const [showBestemmingsplan, setShowBestemmingsplan] = useState(
    persisted.showBestemmingsplan
  )
  const [showBAGPanden] = useState(persisted.showBAGPanden)
  const [showWijken] = useState(persisted.showWijken)
  const [showScannedScope] = useState(persisted.showScannedScope)
  const [showScore, setShowScore] = useState(
    persisted.activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[0].id
  )
  const [showBuiltStatus, setShowBuiltStatus] = useState(
    persisted.activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[1].id
  )
  const [showReportStatus, setShowReportStatus] = useState(
    persisted.activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[2].id
  )
  const [showVacancySignal, setShowVacancySignal] = useState(
    persisted.activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[3].id
  )
  const [showBuildCapacity, setShowBuildCapacity] = useState(
    persisted.activeParcelOverlay === MAP_LAYER_CATALOG.parcelOverlays[4].id
  )

  const isStyleReady = useCallback(() => {
    const map = mapRef.current
    return Boolean(map && mapReady && map.isStyleLoaded())
  }, [mapReady, mapRef])

  const applyBaseLayer = useCallback(
    (layer: LayerType) => {
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
    if (!isStyleReady()) return
    const map = mapRef.current
    if (!map) return
    const currentZoom = map.getZoom()
    if (currentZoom >= PARCEL_INTERACTION_MIN_ZOOM) return
    map.easeTo({ zoom: PARCEL_INTERACTION_MIN_ZOOM, duration: 550 })
  }, [isStyleReady, mapRef])

  const setParcelOverlayMode = useCallback(
    (mode: 'score' | 'built' | 'report' | 'vacancy' | 'capacity' | 'none') => {
      const isScore = mode === 'score'
      const isBuilt = mode === 'built'
      const isReport = mode === 'report'
      const isVacancy = mode === 'vacancy'
      const isCapacity = mode === 'capacity'
      setShowScore(isScore)
      setShowBuiltStatus(isBuilt)
      setShowReportStatus(isReport)
      setShowVacancySignal(isVacancy)
      setShowBuildCapacity(isCapacity)
      onScoreToggle?.(isScore)
      onBuiltStatusToggle?.(isBuilt)
      onReportStatusToggle?.(isReport)
      onVacancySignalToggle?.(isVacancy)
      onBuildCapacityToggle?.(isCapacity)
      if (mode !== 'none') {
        ensureParcelInteractionZoom()
      }
    },
    [
      ensureParcelInteractionZoom,
      onBuildCapacityToggle,
      onBuiltStatusToggle,
      onReportStatusToggle,
      onScoreToggle,
      onVacancySignalToggle,
    ]
  )

  useEffect(() => {
    applyBaseLayer(activeLayer)
  }, [activeLayer, applyBaseLayer])

  const didInitSyncRef = useRef(false)
  useEffect(() => {
    if (!isStyleReady()) return
    if (didInitSyncRef.current) return
    didInitSyncRef.current = true
    const map = mapRef.current
    if (map) {
      if (!map.getSource('pdok-parcels')) {
        addParcelBoundariesLayer(map)
      }
      setParcelBoundariesVisibility(map, showParcels)
    }
    onParcelsToggle?.(showParcels)
    onGemeentenToggle?.(false)
    onBestemmingsplanToggle?.(showBestemmingsplan)
    onBAGPandenToggle?.(false)
    onScannedScopeToggle?.(false)
    if (showParcels) {
      queueMicrotask(() => setParcelOverlayMode('score'))
    }
  }, [
    isStyleReady,
    mapRef,
    setParcelOverlayMode,
    onParcelsToggle,
    onGemeentenToggle,
    onBestemmingsplanToggle,
    onBAGPandenToggle,
    onScannedScopeToggle,
    onScoreToggle,
    onBuiltStatusToggle,
    onReportStatusToggle,
    onVacancySignalToggle,
    onBuildCapacityToggle,
    showParcels,
    showGemeenten,
    showBestemmingsplan,
    showBAGPanden,
    showScannedScope,
    showScore,
    showBuiltStatus,
    showReportStatus,
    showVacancySignal,
    showBuildCapacity,
  ])

  useEffect(() => {
    const activeParcelOverlay = showScore
      ? MAP_LAYER_CATALOG.parcelOverlays[0].id
      : showBuiltStatus
        ? MAP_LAYER_CATALOG.parcelOverlays[1].id
        : showReportStatus
          ? MAP_LAYER_CATALOG.parcelOverlays[2].id
          : showVacancySignal
            ? MAP_LAYER_CATALOG.parcelOverlays[3].id
            : showBuildCapacity
              ? MAP_LAYER_CATALOG.parcelOverlays[4].id
          : null
    writePersistedMapLayerState({
      basemap: activeLayer,
      showParcels,
      showGemeenten,
      showBestemmingsplan,
      showBAGPanden,
      showWijken,
      showScannedScope,
      activeParcelOverlay,
    })
  }, [
    activeLayer,
    showParcels,
    showGemeenten,
    showBestemmingsplan,
    showBAGPanden,
    showWijken,
    showScannedScope,
    showScore,
    showBuiltStatus,
    showReportStatus,
    showVacancySignal,
    showBuildCapacity,
  ])

  const handleLayerChange = (layer: LayerType) => {
    if (layer === activeLayer) return
    setActiveLayer(layer)
  }

  const handleParcelsToggle = () => {
    if (!mapRef.current || !isStyleReady()) return
    const map = mapRef.current
    const nextShowParcels = !showParcels
    if (!map.getSource('pdok-parcels')) {
      addParcelBoundariesLayer(map)
    }
    setParcelBoundariesVisibility(map, nextShowParcels)
    setShowParcels(nextShowParcels)
    onParcelsToggle?.(nextShowParcels)
    if (nextShowParcels) {
      ensureParcelInteractionZoom()
      // Default parcel mode: always show the standard potential colors.
      setParcelOverlayMode('score')
    }
    if (!nextShowParcels) {
      // Hide active overlays while preserving selected mode in UI/localStorage.
      onScoreToggle?.(false)
      onBuiltStatusToggle?.(false)
      onReportStatusToggle?.(false)
      onVacancySignalToggle?.(false)
      onBuildCapacityToggle?.(false)
    }
  }

  const handleBestemmingsplanToggle = () => {
    const next = !showBestemmingsplan
    setShowBestemmingsplan(next)
    onBestemmingsplanToggle?.(next)
  }

  // Removed toggle handlers for BAG Panden, Wijken, Scangebied, Score overlays —
  // these buttons are no longer in the toggle bar. Underlying layer callbacks
  // (onScoreToggle, etc.) are still called via setParcelOverlayMode.

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
    queueMicrotask(() => setShowParcels(true))
    onParcelsToggle?.(true)
    ensureParcelInteractionZoom()
    // Keep auto-enabled parcel mode consistent with default UX.
    queueMicrotask(() => setParcelOverlayMode('score'))
  }, [
    autoEnableParcelsKey,
    ensureParcelInteractionZoom,
    isStyleReady,
    mapRef,
    onParcelsToggle,
    setParcelOverlayMode,
  ])

  useEffect(() => {
    if (!showParcels || !isStyleReady()) return
    if (showScore) return
    if (showBuiltStatus || showReportStatus || showVacancySignal || showBuildCapacity) return
    // Persisted "none" state should not disable clickability in parcel mode.
    queueMicrotask(() => setParcelOverlayMode('score'))
  }, [
    isStyleReady,
    setParcelOverlayMode,
    showBuildCapacity,
    showBuiltStatus,
    showParcels,
    showReportStatus,
    showScore,
    showVacancySignal,
  ])

  const active = 'bg-amber-accent text-on-accent shadow-sm'
  const inactive = 'bg-transparent text-grey-400 hover:text-grey-100 hover:bg-grey-800'
  const overlayActive = 'bg-amber-accent/25 text-amber-accent shadow-sm'
  const overlayInactive = 'bg-transparent text-grey-400 hover:text-grey-100 hover:bg-grey-800'

  const showGradientLegend = showScore && showParcels && hasScoreData

  return (
    <>
      {showGradientLegend && (
        <div className="absolute bottom-4 right-4 z-[var(--z-map-controls)] bg-grey-900/90 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-2 border border-grey-800 shadow-lg">
          <span className="text-xs text-grey-400">40</span>
          <div
            className="h-3 w-24 rounded-full"
            style={{ background: 'linear-gradient(to right, #f59e0b, #84cc16, #16a34a)' }}
          />
          <span className="text-xs text-grey-400">100</span>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-[var(--z-map-controls)] bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md rounded-full p-1 flex gap-0.5 border border-grey-800 shadow-lg">
        <button
          onClick={() => handleLayerChange('kaart')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            activeLayer === 'kaart' ? active : inactive
          }`}
        >
          Kaart
        </button>
        <button
          onClick={() => handleLayerChange('aerial')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            activeLayer === 'aerial' ? active : inactive
          }`}
        >
          Satellite
        </button>

        <div className="border-l-2 border-grey-600 h-6 self-center mx-0.5" />

        <button
          onClick={handleParcelsToggle}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            showParcels ? overlayActive : overlayInactive
          }`}
        >
          Percelen
        </button>

        <div className="border-l border-grey-700 h-6 self-center mx-0.5" />

        <button
          onClick={handleBestemmingsplanToggle}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
            showBestemmingsplan ? overlayActive : overlayInactive
          }`}
        >
          Bestemmingsplan
        </button>
      </div>
    </>
  )
}

export default LayerToggle
