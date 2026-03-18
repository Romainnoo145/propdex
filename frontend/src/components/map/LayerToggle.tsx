import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type maplibregl from 'maplibre-gl'
import { ChevronUp } from 'lucide-react'
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

/** Map ParcelOverlayLayerId → internal setParcelOverlayMode key (null = handled separately) */
const OVERLAY_TO_MODE: Record<ParcelOverlayLayerId, 'score' | 'built' | 'report' | 'vacancy' | 'capacity' | 'foundation' | null> = {
  potential: 'score',
  built_status: 'built',
  report_coverage: 'report',
  vacancy_signal: 'vacancy',
  build_capacity: 'capacity',
  foundation_risk: 'foundation',
  bestemmingsplan: null, // handled via onBestemmingsplanToggle
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
  onScoreToggle,
  onBuiltStatusToggle,
  onReportStatusToggle,
  onVacancySignalToggle,
  onBuildCapacityToggle,
  onFoundationRiskToggle,
  onBAGPandenToggle,
  onScannedScopeToggle,
  autoEnableParcelsKey,
  hasScoreData: _hasScoreData,
}: LayerToggleProps) {
  const [overlayMenuOpen, setOverlayMenuOpen] = useState(false)
  const overlayMenuRef = useRef<HTMLDivElement>(null)

  // Close overlay menu on click outside
  useEffect(() => {
    if (!overlayMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (overlayMenuRef.current && !overlayMenuRef.current.contains(e.target as Node)) {
        setOverlayMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [overlayMenuOpen])

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
    queueMicrotask(() => setParcelOverlayMode('score'))
  }, [needsDefaultOverlay, isStyleReady, setParcelOverlayMode])

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
      // Turn off bestemmingsplan when parcels go off
      if (showBestemmingsplan) onBestemmingsplanToggle()
    }
  }

  /* ── Determine active view level for layoutId ── */
  const activeViewLevel = showParcels ? 'perceel' : showGemeenten ? 'gemeente' : null

  /* ── Active overlay label for the selector button ── */
  const activeOverlayEntry = useMemo(
    () => MAP_LAYER_CATALOG.parcelOverlays.find((o) => o.id === activeParcelOverlay),
    [activeParcelOverlay]
  )

  const handleOverlaySelect = useCallback(
    (overlayId: ParcelOverlayLayerId) => {
      if (overlayId === 'bestemmingsplan') {
        // Bestemmingsplan: turn off score overlays, turn on bestemmingsplan
        setParcelOverlayMode('none')
        if (!showBestemmingsplan) onBestemmingsplanToggle()
      } else {
        // Score overlay: turn off bestemmingsplan if active, switch to new mode
        if (showBestemmingsplan) onBestemmingsplanToggle()
        const mode = OVERLAY_TO_MODE[overlayId]
        if (mode) {
          setParcelOverlayMode(mode)
        }
      }
      setOverlayMenuOpen(false)
    },
    [setParcelOverlayMode, showBestemmingsplan, onBestemmingsplanToggle]
  )

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
          sectionId="parceel"
          onClick={handleParcelsToggle}
        >
          Perceel
        </ToggleButton>

        {/* Overlay mode selector — only when parcels active */}
        {showParcels && (
          <>
            <div className="h-5 w-px bg-white/30 shrink-0" />
            <div className="relative" ref={overlayMenuRef}>
              <button
                onClick={() => setOverlayMenuOpen((prev) => !prev)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
                  overlayMenuOpen
                    ? 'text-aura-amber'
                    : 'text-aura-ink/70 hover:text-aura-ink hover:scale-105'
                }`}
                aria-label="Kleurmodus kiezen"
              >
                <span className="whitespace-nowrap">{activeOverlayEntry?.label ?? 'Potentie'}</span>
                <ChevronUp
                  className={`h-4 w-4 transition-transform duration-200 ${overlayMenuOpen ? '' : 'rotate-180'}`}
                />
              </button>

              {/* Dropdown — opens upward */}
              <AnimatePresence>
                {overlayMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-2 min-w-[180px] bg-white/90 backdrop-blur-xl border border-white/40 rounded-xl shadow-lg overflow-hidden"
                  >
                    {MAP_LAYER_CATALOG.parcelOverlays.map((overlay) => {
                      const isActive = activeParcelOverlay === overlay.id
                      return (
                        <button
                          key={overlay.id}
                          onClick={() => handleOverlaySelect(overlay.id)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-aura-amber/15 text-aura-amber font-medium'
                              : 'text-aura-ink/80 hover:bg-white/50'
                          }`}
                        >
                          <div className="font-medium text-[13px]">{overlay.label}</div>
                          <div className="text-[11px] text-neutral-500 leading-tight">{overlay.description}</div>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LayerToggle
