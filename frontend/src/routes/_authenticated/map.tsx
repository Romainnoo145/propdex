import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/primitives/Button'
import MapShell from '@/components/layout/MapShell'
import LayerToggle from '@/components/map/LayerToggle'
import OverlayLegend from '@/components/map/OverlayLegend'
import OverlayPicker from '@/components/map/OverlayPicker'
import { AddressSearch } from '@/components/search/AddressSearch'
import { PropertyQuickCard } from '@/components/property/PropertyQuickCard'
import { ParcelDetailPanel } from '@/components/map/panels/ParcelDetailPanel'
import { GemeenteContextPanel } from '@/components/map/panels/GemeenteContextPanel'
import { WijkMapPanel } from '@/components/map/panels/WijkMapPanel'
import { usePropertyLookup } from '@/hooks/usePropertyLookup'
import { useRecentViewed } from '@/hooks/useRecentViewed'
import { useReport } from '@/hooks/useReports'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { updatePropertyGeometry, clearPropertyGeometry } from '@/components/map/PropertyGeometryLayer'
import {
  addGemeenteBoundariesLayer,
  setGemeenteBoundariesVisibility,
  clearGemeenteSelection,
} from '@/components/map/GemeenteBoundariesLayer'
import {
  addWijkBoundariesLayer,
  removeWijkBoundariesLayer,
  setWijkBoundariesVisibility,
} from '@/components/map/WijkBoundariesLayer'
import {
  addBestemmingsplanLayer,
  setBestemmingsplanVisibility,
  setupBestemmingsplanClickHandler,
} from '@/components/map/BestemmingsplanLayer'
import {
  addScanAreaHighlight,
  removeScanAreaHighlight,
} from '@/components/map/ScanAreaHighlightLayer'
import {
  addBAGPandLayer,
  removeBAGPandLayer,
  setBAGPandVisibility,
} from '@/components/map/BAGPandLayer'
import {
  setParcelBoundariesVisibility,
} from '@/components/map/ParcelBoundariesLayer'
import {
  addParcelScoreLayer,
  updateParcelScoreSource,
  PARCEL_SCORE_FILL_LAYER_ID,
  PARCEL_BUILT_STATUS_FILL_LAYER_ID,
  PARCEL_REPORT_STATUS_FILL_LAYER_ID,
  PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID,
  PARCEL_BUILD_CAPACITY_FILL_LAYER_ID,
  PARCEL_FOUNDATION_RISK_FILL_LAYER_ID,
  setParcelBuiltStatusVisibility,
  setParcelBuildCapacityVisibility,
  setParcelFoundationRiskVisibility,
  setParcelVacancySignalVisibility,
  setParcelReportStatusVisibility,
  setParcelScoreVisibility,
  updateScoreThreshold,
} from '@/components/map/ParcelScoreLayer'
import {
  addMonitoredWijkOverlay,
  removeMonitoredWijkOverlay,
} from '@/components/map/MonitoredWijkOverlay'
import {
  addScannedWijkHighlight,
  removeScannedWijkHighlight,
} from '@/components/map/ScannedWijkHighlightLayer'
import {
  addFavoriteMarkersLayer,
  updateFavoriteMarkers,
} from '@/components/map/FavoriteMarkersLayer'
import { useFavoriteCentroids } from '@/hooks/useFavoriteCentroids'
import { useTriggerScan, useScanPolling, useScanHistory } from '@/hooks/useScans'
import { useOrgScoreWeights } from '@/hooks/useScoreWeights'
import { useMonitoredProjects } from '@/hooks/useProjects'
import { useAuth } from '@/lib/auth/useAuth'
// ScanProgressOverlay — replaced by inline progress in gemeente header bar
import { BestemmingsplanLegend } from '@/components/map/BestemmingsplanLegend'
import {
  lookupPdokAddress,
  getScanTileUrl,
  fetchWijken,
  fetchParcelCentroid,
  fetchParcelAtPoint,
  resolveParcelByAddress,
} from '@/lib/api'
import { NL_CENTER, NL_ZOOM } from '@/lib/pdok'
import { useMapContext } from '@/lib/MapContext'
import { useMapLayerState } from '@/lib/map/useMapLayerState'
import { PARCEL_INTERACTION_MIN_ZOOM } from '@/lib/map/constants'
import type { SuggestResult, PropertyReportResponse } from '@/lib/types/property'
import type { ZoneFeatureInfo } from '@/lib/types/bestemmingsplan'
import type { ScanResultItem, ScanListItem } from '@/lib/types/scan'
import { calculateBboxFromGeometry } from '@/lib/geo-utils'
import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'
import { useMapPanels, type ActivePanel } from '@/hooks/useMapPanels'

interface MapSearchParams {
  postcode?: string
  huisnummer?: number
  fallback_address?: string
  reportId?: string
  panel?: 'results'     // KEEP for now — unused but harmless
  scan_id?: string      // Restore scan context when returning from /resultaten
  parcel_id?: string    // Focus on specific parcel (from scan results "Bekijk op kaart")
  gemeente_code?: string // Navigate to gemeente boundary
  wijk_naam?: string     // Navigate to wijk boundary
  _t?: number            // Cache-bust for address navigation
}

export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
  validateSearch: (search: Record<string, unknown>): MapSearchParams => ({
    postcode: typeof search.postcode === 'string' ? search.postcode : undefined,
    huisnummer: typeof search.huisnummer === 'number' ? search.huisnummer
      : typeof search.huisnummer === 'string' ? parseInt(search.huisnummer, 10) || undefined
      : undefined,
    fallback_address:
      typeof search.fallback_address === 'string'
        ? search.fallback_address
        : undefined,
    reportId: typeof search.reportId === 'string' ? search.reportId : undefined,
    panel: search.panel === 'results' ? 'results' : undefined,
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
    parcel_id: typeof search.parcel_id === 'string' ? search.parcel_id : undefined,
    gemeente_code: typeof search.gemeente_code === 'string' ? search.gemeente_code : undefined,
    wijk_naam: typeof search.wijk_naam === 'string' ? search.wijk_naam : undefined,
    _t: typeof search._t === 'number' ? search._t : undefined,
  }),
})

type ViewTier = 'none' | 'quick'
const LAST_ACTIVE_SCAN_STORAGE_KEY = 'propdex.map.last-active-scan.v1'

function deriveVacancySignalFromPandStatus(
  pandStatus: string | null | undefined,
  hasPand: boolean
): ScanResultItem['vacancy_signal'] {
  if (!hasPand) return 'leeg_perceel'
  if (!pandStatus) return 'onbekend'

  const normalized = pandStatus.toLowerCase()
  if (
    normalized.includes('buiten gebruik') ||
    normalized.includes('gesloopt') ||
    normalized.includes('niet gerealiseerd')
  ) {
    return 'leegstaand_pand'
  }
  if (normalized.includes('in gebruik') || normalized.includes('verbouwing')) {
    return 'in_gebruik'
  }
  return 'onbekend'
}

function parseFeatureBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return false
}

function parseFeatureNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseFeatureInt(value: unknown): number | null {
  const parsed = parseFeatureNumber(value)
  if (parsed === null) return null
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null
}

function MapPage() {
  // MapView is now in the parent layout — get mapRef/mapReady from context
  const { mapRef, mapReady, panelOpen, leftPanelOpen } = useMapContext()
  const navigate = useNavigate()
  const {
    postcode,
    huisnummer,
    fallback_address: fallbackAddress,
    reportId,
    scan_id: urlScanId,
    parcel_id: urlParcelId,
    gemeente_code: urlGemeenteCode,
    wijk_naam: urlWijkNaam,
    _t: navTs,
  } = Route.useSearch()
  const { accessToken } = useAuth()
  // Single source of truth for all layer toggle state
  const { state: layerState, actions: layerActions } = useMapLayerState()

  const [tier, setTier] = useState<ViewTier>('none')
  // demo data removed — all property data comes from lookup API
  const [propertyLngLat, setPropertyLngLat] = useState<[number, number] | null>(null)
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  const navigatedRef = useRef(false)
  const [zoneInfo, setZoneInfo] = useState<{ info: ZoneFeatureInfo; lngLat: [number, number] } | null>(null)
  const [zoneLoading, setZoneLoading] = useState(false)
  // Track selected area for confirmation flow (used for state management, not rendering)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedArea, setSelectedArea] = useState<{
    bbox: [number, number, number, number]
    name: string
    source: 'gemeente' | 'bestemmingsplan'
  } | null>(null)

  const [activeGemeente, setActiveGemeente] = useState<{
    code: string;
    naam: string;
    bbox: [number, number, number, number];
  } | null>(null)

  // Score weights for threshold + tile cache busting after rescore
  const { data: scoreWeightsData } = useOrgScoreWeights()
  const scoreThreshold = scoreWeightsData?.weights.score_threshold ?? 40
  const tileCacheBusterRef = useRef<string>(Date.now().toString())

  const [wijkGeojson, setWijkGeojson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [autoEnableParcelsKey, setAutoEnableParcelsKey] = useState<string | null>(null)
  const parcelClickRequestSeqRef = useRef(0)

  // Refs for fresh layer visibility inside callbacks (avoids stale closure)
  const isParcelsVisibleRef = useRef(layerState.showParcels)
  isParcelsVisibleRef.current = layerState.showParcels
  const isGemeentenVisibleRef = useRef(layerState.showGemeenten)
  isGemeentenVisibleRef.current = layerState.showGemeenten
  const [showScannedWijkBoundaries, setShowScannedWijkBoundaries] = useState(false)
  const initialRequestedWijkNameRef = useRef<string | null>(
    typeof urlWijkNaam === 'string' && urlWijkNaam.trim()
      ? normalizeAreaName(urlWijkNaam)
      : null
  )
  const [parcelGeometryHighlight, setParcelGeometryHighlight] = useState<{
    lng: number
    lat: number
    parcelCode: string | null
    areaM2: number | null
    geometry: GeoJSON.Geometry
  } | null>(null)

  // Pending scan confirmation state
  const [pendingScan, setPendingScan] = useState<{
    wijkNaam: string
    gemeente_code: string
    gemeente_naam: string
    bbox_wgs84: [number, number, number, number]
  } | null>(null)

  const shouldLoadGemeenteGeojson =
    layerState.showGemeenten ||
    Boolean(urlGemeenteCode && !urlParcelId && !urlScanId && !reportId)
  const {
    data: gemeenteGeojson,
    error: gemeenteGeojsonError,
  } = useGemeenteGeoJSON(shouldLoadGemeenteGeojson)

  // Refs for fresh values in gemeente click handler (avoid stale closure)
  const activeGemeenteRef = useRef(activeGemeente)
  activeGemeenteRef.current = activeGemeente
  const activeScanIdRef = useRef(activeScanId)
  activeScanIdRef.current = activeScanId
  const wijkGeojsonRef = useRef(wijkGeojson)
  wijkGeojsonRef.current = wijkGeojson

  const lookup = usePropertyLookup()
  const { addRecentItem } = useRecentViewed()

  // Scan hooks
  const queryClient = useQueryClient()
  const triggerScan = useTriggerScan()
  const scanStatus = useScanPolling(activeScanId)
  const isScanRunning =
    triggerScan.isPending ||
    scanStatus.data?.status === 'running' ||
    scanStatus.data?.status === 'pending'
  // Only auto-toast/auto-navigate when the user started a fresh scan in this session.
  const shouldAutoFollowScanRef = useRef(false)

  // Reset navigatedRef when activeScanId changes (new scan = fresh navigation guard)
  useEffect(() => {
    navigatedRef.current = false
    if (!activeScanId) {
      shouldAutoFollowScanRef.current = false
    }
  }, [activeScanId])

  // Shared navigation handler for CTA button and completion useEffect
  const handleViewResults = useCallback(() => {
    if (navigatedRef.current || !activeScanId) return
    navigatedRef.current = true
    navigate({ to: '/resultaten', search: { scan_id: activeScanId } })
  }, [activeScanId, navigate])

  // Fetch saved report if reportId provided
  const savedReport = useReport(reportId || null)

  // Monitored projects for wijk overlay
  const { data: monitoredProjects } = useMonitoredProjects()

  // Favorite parcel centroids for map markers
  const { data: favoriteCentroids } = useFavoriteCentroids()

  // Scan history for scanned wijk highlight
  const { data: scanHistory } = useScanHistory({ limit: 100 })

  // Panel orchestration hook — manages ActivePanel state and navigation handlers
  const {
    activePanel,
    setActivePanel,
    inspectorParcel,
    handleGemeentePanelSelectWijk,
    handleWijkPanelBack,
    handleCloseGemeentePanel,
    handleCloseParcelPanel,
  } = useMapPanels({
    activeGemeenteRef,
    wijkGeojson,
    scanHistory,
    mapRef,
    setActiveGemeente,
    setWijkGeojson,
    setParcelGeometryHighlight,
    removeWijkBoundariesLayer,
    removeScanAreaHighlight,
    addScanAreaHighlight,
  })

  // Re-center map when parcel panel opens (shift left to keep parcel visible)
  useEffect(() => {
    const map = mapRef.current
    if (!inspectorParcel || !map || !mapReady) return
    // Use parcel geometry centroid or bounding box center
    const geom = (inspectorParcel as unknown as { geometry?: GeoJSON.Geometry }).geometry
    let lng: number | undefined
    let lat: number | undefined
    if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
      const bbox = calculateBboxFromGeometry(geom)
      if (bbox) {
        lng = (bbox[0] + bbox[2]) / 2
        lat = (bbox[1] + bbox[3]) / 2
      }
    }
    // Fallback: try latitude/longitude fields from tile feature
    if (lng == null || lat == null) {
      const p = inspectorParcel as unknown as { longitude?: number; latitude?: number }
      lng = p.longitude
      lat = p.latitude
    }
    if (lng == null || lat == null) return
    // Project to screen, shift right by half panel width (210px) since panel is on LEFT
    const point = map.project([lng, lat])
    point.x += 210
    const adjusted = map.unproject(point)
    map.easeTo({ center: adjusted, duration: 500 })
  }, [inspectorParcel, mapRef, mapReady])

  const scannedWijkNames = useMemo(() => {
    if (!activeGemeente || !scanHistory?.scans) return []
    return scanHistory.scans
      .filter(s =>
        s.gemeente_code === activeGemeente.code &&
        s.status === 'completed' &&
        s.wijk_naam !== null
      )
      .map(s => s.wijk_naam as string)
  }, [activeGemeente, scanHistory?.scans])

  const initialLastActiveScanId = useMemo(() => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(LAST_ACTIVE_SCAN_STORAGE_KEY)
    } catch {
      return null
    }
  }, [])
  const lastActiveScanIdRef = useRef<string | null>(initialLastActiveScanId)
  const currentCenteredWijkNameRef = useRef<string | null>(null)
  const currentMapCenterRef = useRef<[number, number] | null>(null)

  const readCenteredWijkName = useCallback((): string | null => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !map.getLayer('wijk-fill')) return null
    try {
      const point = map.project(map.getCenter())
      const [feature] = map.queryRenderedFeatures(point, { layers: ['wijk-fill'] })
      const wijkNaam = feature?.properties?.statnaam
      if (typeof wijkNaam !== 'string' || wijkNaam.trim().length === 0) return null
      return normalizeAreaName(wijkNaam)
    } catch {
      return null
    }
  }, [mapRef])

  useEffect(() => {
    if (!activeScanId || typeof window === 'undefined') return
    lastActiveScanIdRef.current = activeScanId
    try {
      window.localStorage.setItem(LAST_ACTIVE_SCAN_STORAGE_KEY, activeScanId)
    } catch {
      // ignore storage write failures
    }
  }, [activeScanId])

  const preferredCompletedScan = useMemo(() => {
    if (!scanHistory?.scans || scanHistory.scans.length === 0) return null
    const completed = scanHistory.scans.filter((scan) => scan.status === 'completed')
    if (completed.length === 0) return null

    const requestedWijk = initialRequestedWijkNameRef.current
    const gemeentePool = activeGemeente
      ? completed.filter((scan) => scan.gemeente_code === activeGemeente.code)
      : completed

    const wijkPool = requestedWijk
      ? gemeentePool.filter((scan) => (
          normalizeAreaName(scan.wijk_naam ?? '') === requestedWijk
        ))
      : []
    if (wijkPool.length > 0) {
      return [...wijkPool].sort(
        (a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
      )[0] ?? null
    }

    const centeredWijk = currentCenteredWijkNameRef.current
    if (centeredWijk) {
      const centeredWijkPool = gemeentePool.filter((scan) => (
        normalizeAreaName(scan.wijk_naam ?? '') === centeredWijk
      ))
      if (centeredWijkPool.length > 0) {
        return [...centeredWijkPool].sort(
          (a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
        )[0] ?? null
      }
    }

    const currentCenter = currentMapCenterRef.current
    if (currentCenter) {
      const [lng, lat] = currentCenter
      const centerPool = gemeentePool.filter((scan) => {
        const bbox = scan.bbox_wgs84
        if (!bbox || bbox.length !== 4) return false
        return (
          lng >= bbox[0] &&
          lng <= bbox[2] &&
          lat >= bbox[1] &&
          lat <= bbox[3]
        )
      })
      if (centerPool.length > 0) {
        return [...centerPool].sort(
          (a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
        )[0] ?? null
      }
    }

    const lastActiveScanId = lastActiveScanIdRef.current
    if (lastActiveScanId) {
      const lastScan = completed.find((scan) => scan.scan_id === lastActiveScanId) ?? null
      if (lastScan && (!activeGemeente || lastScan.gemeente_code === activeGemeente.code)) {
        return lastScan
      }
    }

    // When a gemeente is selected and only one scan exists, use it.
    if (activeGemeente && gemeentePool.length === 1) {
      return gemeentePool[0] ?? null
    }

    // When browsing without gemeente context, pick the most recent completed scan
    // so parcel score colors show automatically when zooming into scanned areas.
    if (!activeGemeente && completed.length > 0) {
      return [...completed].sort(
        (a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
      )[0] ?? null
    }

    return null
  }, [activeGemeente, scanHistory?.scans])

  const activatePreferredScan = useCallback(
    () => {
      if (!preferredCompletedScan) return false
      if (activeScanId === preferredCompletedScan.scan_id) return true
      setActiveScanId(preferredCompletedScan.scan_id)
      return true
    },
    [activeScanId, preferredCompletedScan]
  )

  // Exit gemeente mode: hide boundaries, clear gemeente/wijk state.
  // Uses refs so it can be called from any callback without stale closure issues.
  const exitGemeenteMode = useCallback(() => {
    layerActions.setGemeenten(false)
    const map = mapRef.current
    if (map) {
      // Force-hide gemeente boundaries (bypass isStyleLoaded guard)
      try {
        if (map.getLayer('gemeente-fill')) {
          map.setLayoutProperty('gemeente-fill', 'visibility', 'none')
        }
        if (map.getLayer('gemeente-line')) {
          map.setLayoutProperty('gemeente-line', 'visibility', 'none')
        }
      } catch { /* style not loaded — layers will be hidden on next idle */ }
      clearGemeenteSelection(map)
      // Remove wijk boundaries if source exists (don't rely on ref alone)
      if (wijkGeojsonRef.current || map.getSource('cbs-wijken')) {
        removeWijkBoundariesLayer(map)
        setWijkGeojson(null)
      }
      removeScanAreaHighlight(map)
    }
    setSelectedArea(null)
    setActiveGemeente(null)
    setActivePanel(null)
  }, [layerActions, mapRef, setActivePanel])

  const handleParcelsLayerToggle = useCallback((visible: boolean) => {
    layerActions.setParcels(visible)
    const map = mapRef.current
    currentMapCenterRef.current = map
      ? [map.getCenter().lng, map.getCenter().lat]
      : null
    if (visible) {
      currentCenteredWijkNameRef.current = readCenteredWijkName()

      // Percelen ON → turn off gemeenten (exclusive modes)
      exitGemeenteMode()
    } else {
      currentCenteredWijkNameRef.current = null
      layerActions.setActiveParcelOverlay(null)
    }

    if (!visible) return
    if (!activeScanId) {
      activatePreferredScan()
    }
  }, [activeScanId, activatePreferredScan, layerActions, exitGemeenteMode, readCenteredWijkName])

  // Auto-activate preferred scan on map load so parcel score colors
  // show immediately when zooming into scanned areas — no manual scan
  // selection needed.
  useEffect(() => {
    if (activeScanId) return
    activatePreferredScan()
  }, [activeScanId, activatePreferredScan])

  const gemeenteGeojsonErrorNotifiedRef = useRef(false)
  useEffect(() => {
    if (!gemeenteGeojsonError) {
      gemeenteGeojsonErrorNotifiedRef.current = false
      return
    }
    if (gemeenteGeojsonErrorNotifiedRef.current) return
    gemeenteGeojsonErrorNotifiedRef.current = true
    toast.error('Kon gemeentegrenzen niet laden')
  }, [gemeenteGeojsonError])

  // Fly to property whenever coordinates are set and map is ready
  useEffect(() => {
    if (!propertyLngLat || !mapReady || !mapRef.current) return
    mapRef.current.flyTo({ center: propertyLngLat, zoom: 17 })
  }, [propertyLngLat, mapReady])

  // Update geometry whenever data changes and map is ready.
  // Priority: explicit parcel highlight (parcel_id flow) over lookup geometry.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    if (parcelGeometryHighlight) {
      const parcelGeometryData = {
        map_data: {
          center_rd: null,
          center_wgs84: [parcelGeometryHighlight.lng, parcelGeometryHighlight.lat],
          property_geometry: null,
          parcel_geometries: [parcelGeometryHighlight.geometry],
          zoning_geometries: [],
        },
        cadastral_parcels: [
          {
            kadastrale_aanduiding: parcelGeometryHighlight.parcelCode,
            perceelnummer: null,
            sectie: null,
            oppervlakte: parcelGeometryHighlight.areaM2,
            geometry: parcelGeometryHighlight.geometry,
          },
        ],
      } as unknown as PropertyReportResponse
      updatePropertyGeometry(mapRef.current, parcelGeometryData)
      return
    }

    // Show lookup geometry while quick card is active
    if (lookup.data && tier === 'quick') {
      updatePropertyGeometry(mapRef.current, lookup.data)
      return
    }

    // Don't clear geometry while a parcel panel is open — the async fetch
    // that sets parcelGeometryHighlight may still be in-flight
    if (activePanel?.kind === 'parcel') return

    clearPropertyGeometry(mapRef.current)
  }, [lookup.data, mapReady, parcelGeometryHighlight, mapRef, tier, activePanel])

  // Track whether we've already handled the current search params
  const handledSearchRef = useRef<string | null>(null)
  const handledParcelRef = useRef<string | null>(null)
  const handledScanFocusRef = useRef<string | null>(null)
  const handledGemeenteWijkRef = useRef<string | null>(null)
  const handledReportRef = useRef<string | null>(null)
  const pendingLookupInspectorRef = useRef<{
    postcode: string
    huisnummer: number
  } | null>(null)
  const [isQuickOpeningDetails, setIsQuickOpeningDetails] = useState(false)

  const focusAddressWithLookup = useCallback(
    ({
      postcode,
      huisnummer,
      showToastOnError = false,
      openInspectorOnSuccess = false,
    }: {
      postcode: string
      huisnummer: number
      showToastOnError?: boolean
      openInspectorOnSuccess?: boolean
    }) => {
      setTier('quick')
      setParcelGeometryHighlight(null)
      pendingLookupInspectorRef.current = openInspectorOnSuccess
        ? { postcode, huisnummer }
        : null
      lookup.mutate(
        { postcode, huisnummer },
        {
          onSuccess: (data) => {
            const coords = data.map_data?.center_wgs84
            if (coords && coords.length === 2) {
              setPropertyLngLat([coords[0]!, coords[1]!])
            }
          },
          onError: () => {
            pendingLookupInspectorRef.current = null
            if (mapRef.current) {
              clearPropertyGeometry(mapRef.current)
            }
            setTier('none')
            if (showToastOnError) {
              toast.error('Adres niet gevonden')
            }
          },
        }
      )
    },
    [lookup, mapRef]
  )

  const makeInspectorParcel = useCallback((input: {
    parcelId: string
    address: string | null
    parcelCode?: string | null
    gemeenteCode?: string | null
    areaM2?: number | null
    hasPand?: boolean
    bouwjaar?: number | null
    pandStatus?: string | null
    vacancySignal?: ScanResultItem['vacancy_signal']
    vacancyConfidence?: number | null
    vacancyReasons?: string[] | null
    vacancyModelVersion?: string | null
    bestemmingen?: Record<string, unknown>[] | null
    maxBebouwingspercentage?: number | null
    maxFloorAreaRatio?: number | null
    score?: number | null
    scoreCategory?: string | null
    scoreBreakdown?: Record<string, unknown> | null
    potentieScore?: number | null
    risicoScore?: number | null
    marketSignals?: ScanResultItem['market_signals']
    opportunitySignals?: string[] | null
    buildingMetrics?: Record<string, unknown> | null
    hasReport?: boolean
  }): ScanResultItem => {
    const hasPand = input.hasPand ?? true
    const vacancySignal =
      input.vacancySignal ??
      deriveVacancySignalFromPandStatus(input.pandStatus, hasPand)
    const fallbackBuildingMetrics = {
      max_bebouwingspercentage: input.maxBebouwingspercentage ?? null,
      max_floor_area_ratio: input.maxFloorAreaRatio ?? null,
    }
    const mergedBuildingMetrics =
      input.buildingMetrics && Object.keys(input.buildingMetrics).length > 0
        ? {
            ...fallbackBuildingMetrics,
            ...input.buildingMetrics,
          }
        : fallbackBuildingMetrics

    return {
      parcel_id: input.parcelId,
      parcel_code: input.parcelCode ?? '',
      address: input.address ?? null,
      gemeente_code: input.gemeenteCode ?? null,
      area_m2: input.areaM2 ?? null,
      has_pand: hasPand,
      bouwjaar: input.bouwjaar ?? null,
      pand_status: input.pandStatus ?? null,
      bestemmingen: input.bestemmingen ?? null,
      score: input.score ?? null,
      score_category: input.scoreCategory ?? null,
      score_breakdown: input.scoreBreakdown ?? null,
      potentie_score: input.potentieScore ?? null,
      risico_score: input.risicoScore ?? null,
      vacancy_signal: vacancySignal,
      vacancy_confidence: input.vacancyConfidence ?? null,
      vacancy_reasons: input.vacancyReasons ?? null,
      vacancy_model_version: input.vacancyModelVersion ?? null,
      market_signals: input.marketSignals ?? null,
      opportunity_signals: input.opportunitySignals ?? null,
      building_metrics: mergedBuildingMetrics,
      has_report: input.hasReport ?? false,
    }
  }, [])

  // For URL-driven postcode/huisnummer navigation and address search:
  // resolve parcel_id then fetch full scan data (same as map click) for rich detail panel.
  useEffect(() => {
    if (!lookup.data) return
    const pending = pendingLookupInspectorRef.current
    if (!pending || !accessToken) return

    pendingLookupInspectorRef.current = null
    const data = lookup.data

    void resolveParcelByAddress(
      {
        street: data.address.straat,
        huisnummer: data.address.huisnummer,
        postcode: data.address.postcode,
      },
      accessToken
    )
      .then(async (resolved) => {
        exitGemeenteMode()
        setAutoEnableParcelsKey(
          `addr:${pending.postcode.replace(/\s/g, '').toUpperCase()}:${pending.huisnummer}`
        )
        setTier('none')
        setParcelGeometryHighlight(null)

        // Use fetchParcelAtPoint to get full scan data (score, building_metrics,
        // vacancy, market signals) — same path as clicking a parcel on the map.
        try {
          const full = await fetchParcelAtPoint(
            resolved.lng,
            resolved.lat,
            accessToken,
            { scanId: activeScanIdRef.current },
          )
          setActivePanel({ kind: 'parcel', parcel:
            makeInspectorParcel({
              parcelId: full.parcel_id,
              address: full.address ?? resolved.address ?? `${data.address.straat} ${data.address.huisnummer}${data.address.huisletter ?? ''}${data.address.toevoeging ? ` ${data.address.toevoeging}` : ''}, ${data.address.postcode} ${data.address.woonplaats}`,
              parcelCode: full.parcel_code ?? null,
              gemeenteCode: full.gemeente_code ?? null,
              areaM2: full.area_m2 ?? null,
              hasPand: full.has_pand,
              bouwjaar: full.bouwjaar ?? null,
              pandStatus: full.pand_status ?? null,
              score: full.score ?? null,
              scoreCategory: full.score_category ?? null,
              scoreBreakdown: full.score_breakdown ?? null,
              potentieScore: full.potentie_score ?? null,
              risicoScore: full.risico_score ?? null,
              vacancySignal: (full.vacancy_signal as ScanResultItem['vacancy_signal']) ?? null,
              vacancyConfidence: full.vacancy_confidence ?? null,
              vacancyReasons: full.vacancy_reasons ?? null,
              vacancyModelVersion: full.vacancy_model_version ?? null,
              marketSignals: full.market_signals ?? null,
              opportunitySignals: full.opportunity_signals ?? null,
              buildingMetrics: full.building_metrics ?? null,
              bestemmingen: full.bestemmingen ?? null,
              hasReport: full.has_report,
            })
          })
          if (full.geometry) {
            setParcelGeometryHighlight({
              lng: full.lng,
              lat: full.lat,
              parcelCode: full.parcel_code ?? null,
              areaM2: full.area_m2 ?? null,
              geometry: full.geometry,
            })
          }
          setPropertyLngLat([full.lng, full.lat])
        } catch {
          // Fallback: parcel not in any scan — use basic property lookup data
          const firstParcel = data.cadastral_parcels?.[0]
          const primaryBestemming = data.zoning?.primary_bestemming
          const hasPand = Boolean(data.building?.pand_id)
          setActivePanel({ kind: 'parcel', parcel:
            makeInspectorParcel({
              parcelId: resolved.parcel_id,
              address: resolved.address ?? `${data.address.straat} ${data.address.huisnummer}${data.address.huisletter ?? ''}${data.address.toevoeging ? ` ${data.address.toevoeging}` : ''}, ${data.address.postcode} ${data.address.woonplaats}`,
              parcelCode: firstParcel?.kadastrale_aanduiding ?? null,
              areaM2: firstParcel?.oppervlakte ?? data.building?.oppervlakte ?? null,
              hasPand,
              bouwjaar: data.building?.bouwjaar ?? null,
              pandStatus: data.building?.status ?? null,
              bestemmingen: primaryBestemming ? [{ type: primaryBestemming, naam: primaryBestemming }] : null,
              maxBebouwingspercentage: data.zoning?.building_dimensions?.max_bebouwingspercentage ?? null,
              maxFloorAreaRatio: data.zoning?.building_dimensions?.max_floor_area_ratio ?? null,
            })
          })
          void fetchParcelCentroid(resolved.parcel_id, accessToken)
            .then((centroid) => {
              if (centroid.geometry) {
                setParcelGeometryHighlight({
                  lng: centroid.lng,
                  lat: centroid.lat,
                  parcelCode: centroid.parcel_code ?? firstParcel?.kadastrale_aanduiding ?? null,
                  areaM2: centroid.area_m2 ?? firstParcel?.oppervlakte ?? null,
                  geometry: centroid.geometry,
                })
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {
        // Address resolution failed — no parcel match.
      })
  }, [lookup.data, accessToken, makeInspectorParcel])

  const handleOpenQuickDetails = useCallback(async () => {
    if (lookup.isPending || isQuickOpeningDetails) return
    if (!lookup.data) {
      toast.info('Perceeldetails worden nog geladen')
      return
    }
    if (!accessToken) {
      toast.error('Sessie verlopen. Log opnieuw in.')
      return
    }

    const data = lookup.data
    setIsQuickOpeningDetails(true)
    try {
      const resolved = await resolveParcelByAddress(
        {
          street: data.address.straat,
          huisnummer: data.address.huisnummer,
          postcode: data.address.postcode,
        },
        accessToken
      )

      const firstParcel = data.cadastral_parcels?.[0]
      const primaryBestemming = data.zoning?.primary_bestemming
      setActivePanel({ kind: 'parcel', parcel:
        makeInspectorParcel({
          parcelId: resolved.parcel_id,
          address: resolved.address ?? `${data.address.straat} ${data.address.huisnummer}${data.address.huisletter ?? ''}${data.address.toevoeging ? ` ${data.address.toevoeging}` : ''}, ${data.address.postcode} ${data.address.woonplaats}`,
          parcelCode: firstParcel?.kadastrale_aanduiding ?? null,
          areaM2: firstParcel?.oppervlakte ?? data.building?.oppervlakte ?? null,
          hasPand: Boolean(data.building?.pand_id),
          bouwjaar: data.building?.bouwjaar ?? null,
          pandStatus: data.building?.status ?? null,
          vacancySignal: deriveVacancySignalFromPandStatus(
            data.building?.status ?? null,
            Boolean(data.building?.pand_id)
          ),
          bestemmingen: primaryBestemming
            ? [{ type: primaryBestemming, naam: primaryBestemming }]
            : null,
          maxBebouwingspercentage: data.zoning?.building_dimensions?.max_bebouwingspercentage ?? null,
          maxFloorAreaRatio: data.zoning?.building_dimensions?.max_floor_area_ratio ?? null,
        })
      })
      void fetchParcelCentroid(resolved.parcel_id, accessToken)
        .then((centroid) => {
          if (centroid.geometry) {
            setParcelGeometryHighlight({
              lng: centroid.lng,
              lat: centroid.lat,
              parcelCode: centroid.parcel_code ?? firstParcel?.kadastrale_aanduiding ?? null,
              areaM2: centroid.area_m2 ?? firstParcel?.oppervlakte ?? null,
              geometry: centroid.geometry,
            })
          }
        })
        .catch(() => {
          // Keep inspector open even when centroid enrichment fails.
        })
      setTier('none')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Perceeldetails openen mislukt'
      )
    } finally {
      setIsQuickOpeningDetails(false)
    }
  }, [lookup.isPending, lookup.data, accessToken, makeInspectorParcel, isQuickOpeningDetails])

  // Handle saved report loading (from sidebar report selection)
  useEffect(() => {
    if (!reportId || !savedReport.data) return

    // Prevent re-triggering for the same report
    if (handledReportRef.current === reportId) return
    handledReportRef.current = reportId

    // Extract PropertyReportResponse from saved report's report_data
    const propertyData = savedReport.data.report_data as unknown as PropertyReportResponse

    setTier('none')
    setParcelGeometryHighlight(null)
    setActivePanel(null)
    pendingLookupInspectorRef.current = null

    // Set coordinates — flyTo handled by dedicated effect
    const coords = propertyData.map_data?.center_wgs84
    if (coords && coords.length === 2) {
      setPropertyLngLat([coords[0]!, coords[1]!])
    }

    const resolveFocus = async () => {
      const addr = propertyData.address
      const huisnummerParsed = Number(addr?.huisnummer)
      if (addr?.postcode && Number.isFinite(huisnummerParsed) && huisnummerParsed > 0) {
        setAutoEnableParcelsKey(`report:${reportId}:${navTs ?? 0}`)
        focusAddressWithLookup({
          postcode: addr.postcode,
          huisnummer: huisnummerParsed,
          showToastOnError: true,
          openInspectorOnSuccess: true,
        })
      }
    }

    void resolveFocus().finally(() => {
      // Clear reportId from URL so it doesn't re-trigger
      navigate({ to: '/map', search: {}, replace: true })
    })
  }, [reportId, savedReport.data, navigate, navTs, focusAddressWithLookup])

  // Restore scan context when returning from /resultaten with ?scan_id=...
  // When parcel_id is present, wait for auth token before fetching centroid.
  useEffect(() => {
    if (!urlScanId) return
    if (!activeScanId) {
      setActiveScanId(urlScanId)
    }
    // Returning from /resultaten should not trigger completion toast + redirect loop.
    shouldAutoFollowScanRef.current = false

    const focusKey = `${urlScanId}:${urlParcelId ?? ''}:${navTs ?? 0}`
    if (handledScanFocusRef.current === focusKey) return

    // parcel focus requires auth; keep URL intact until token is available.
    if (urlParcelId && !accessToken) return

    handledScanFocusRef.current = focusKey

    if (urlParcelId && accessToken) {
      // Clear stale focus immediately so old parcel/marker never lingers while loading a new one.
      setTier('none')
      setParcelGeometryHighlight(null)
      setActivePanel(null)
      pendingLookupInspectorRef.current = null
      if (mapRef.current) {
        clearPropertyGeometry(mapRef.current)
      }

      fetchParcelCentroid(urlParcelId, accessToken)
        .then(async (centroid) => {
          // Fetch full scan data (score, building_metrics, vacancy, etc.)
          // so the detail panel matches what map clicks show.
          const full = await fetchParcelAtPoint(
            centroid.lng,
            centroid.lat,
            accessToken,
            { scanId: urlScanId },
          )
          exitGemeenteMode()
          setAutoEnableParcelsKey(`${urlParcelId}:${urlScanId}:${navTs ?? 0}`)
          setPropertyLngLat([full.lng ?? centroid.lng, full.lat ?? centroid.lat])
          setTier('none')
          setActivePanel({ kind: 'parcel', parcel:
            makeInspectorParcel({
              parcelId: full.parcel_id,
              address: full.address ?? centroid.address ?? fallbackAddress ?? null,
              parcelCode: full.parcel_code ?? centroid.parcel_code ?? null,
              gemeenteCode: full.gemeente_code ?? centroid.gemeente_code ?? null,
              areaM2: full.area_m2 ?? centroid.area_m2 ?? null,
              hasPand: full.has_pand,
              bouwjaar: full.bouwjaar ?? centroid.bouwjaar ?? null,
              pandStatus: full.pand_status ?? centroid.pand_status ?? null,
              score: full.score ?? null,
              scoreCategory: full.score_category ?? null,
              scoreBreakdown: full.score_breakdown ?? null,
              potentieScore: full.potentie_score ?? null,
              risicoScore: full.risico_score ?? null,
              vacancySignal: (full.vacancy_signal as ScanResultItem['vacancy_signal']) ?? null,
              vacancyConfidence: full.vacancy_confidence ?? null,
              vacancyReasons: full.vacancy_reasons ?? null,
              vacancyModelVersion: full.vacancy_model_version ?? null,
              marketSignals: full.market_signals ?? null,
              opportunitySignals: full.opportunity_signals ?? null,
              buildingMetrics: full.building_metrics ?? null,
              bestemmingen: full.bestemmingen ?? null,
              hasReport: full.has_report,
            })
          })
          if (full.geometry ?? centroid.geometry) {
            setParcelGeometryHighlight({
              lng: centroid.lng,
              lat: centroid.lat,
              parcelCode: full.parcel_code ?? centroid.parcel_code ?? null,
              areaM2: full.area_m2 ?? centroid.area_m2 ?? null,
              geometry: (full.geometry ?? centroid.geometry)!,
            })
          }
        })
        .catch(() => {
          // Silently fall back — scan layer still loads
        })
        .finally(() => {
          navigate({ to: '/map', search: {}, replace: true })
        })
      return
    }

    // Clear from URL to prevent re-trigger on hot reload.
    navigate({ to: '/map', search: {}, replace: true })
  }, [urlScanId, urlParcelId, activeScanId, accessToken, navigate, navTs, fallbackAddress, makeInspectorParcel, exitGemeenteMode])

  // Handle direct parcel navigation (e.g. from meldingen) without scan context
  useEffect(() => {
    if (!urlParcelId || urlScanId || !accessToken) return

    const key = `${urlParcelId}:${navTs ?? 0}`
    if (handledParcelRef.current === key) return
    handledParcelRef.current = key

    // Clear stale focus immediately so old parcel/marker never lingers while loading a new one.
    setTier('none')
    setParcelGeometryHighlight(null)
    setActivePanel(null)
    pendingLookupInspectorRef.current = null
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }

    fetchParcelCentroid(urlParcelId, accessToken)
      .then(async (centroid) => {
        // Fetch full scan data so detail panel shows all fields
        const full = await fetchParcelAtPoint(
          centroid.lng,
          centroid.lat,
          accessToken,
          { scanId: activeScanIdRef.current },
        )
        exitGemeenteMode()
        setAutoEnableParcelsKey(key)
        setPropertyLngLat([centroid.lng, centroid.lat])
        setTier('none')
        setActivePanel({ kind: 'parcel', parcel:
          makeInspectorParcel({
            parcelId: full.parcel_id,
            address: full.address ?? centroid.address ?? fallbackAddress ?? null,
            parcelCode: full.parcel_code ?? centroid.parcel_code ?? null,
            gemeenteCode: full.gemeente_code ?? centroid.gemeente_code ?? null,
            areaM2: full.area_m2 ?? centroid.area_m2 ?? null,
            hasPand: full.has_pand,
            bouwjaar: full.bouwjaar ?? centroid.bouwjaar ?? null,
            pandStatus: full.pand_status ?? centroid.pand_status ?? null,
            score: full.score ?? null,
            scoreCategory: full.score_category ?? null,
            scoreBreakdown: full.score_breakdown ?? null,
            potentieScore: full.potentie_score ?? null,
            risicoScore: full.risico_score ?? null,
            vacancySignal: (full.vacancy_signal as ScanResultItem['vacancy_signal']) ?? null,
            vacancyConfidence: full.vacancy_confidence ?? null,
            vacancyReasons: full.vacancy_reasons ?? null,
            vacancyModelVersion: full.vacancy_model_version ?? null,
            marketSignals: full.market_signals ?? null,
            opportunitySignals: full.opportunity_signals ?? null,
            buildingMetrics: full.building_metrics ?? null,
            bestemmingen: full.bestemmingen ?? null,
            hasReport: full.has_report,
          })
        })
        if (full.geometry ?? centroid.geometry) {
          setParcelGeometryHighlight({
            lng: centroid.lng,
            lat: centroid.lat,
            parcelCode: full.parcel_code ?? centroid.parcel_code ?? null,
            areaM2: full.area_m2 ?? centroid.area_m2 ?? null,
            geometry: (full.geometry ?? centroid.geometry)!,
          })
        }
      })
      .catch(() => {
        toast.error('Kon perceel op kaart niet centreren')
      })
      .finally(() => {
        navigate({ to: '/map', search: {}, replace: true })
      })
  }, [urlParcelId, urlScanId, navTs, accessToken, navigate, fallbackAddress, makeInspectorParcel, exitGemeenteMode])

  // Handle incoming search params (from recent viewed / report sidebar / project list)
  useEffect(() => {
    if (!postcode || !huisnummer) return

    // Use timestamp-based key to allow re-navigation to same address
    const key = `${postcode}-${huisnummer}-${navTs ?? 0}`
    if (handledSearchRef.current === key) return
    handledSearchRef.current = key

    // Clear search params immediately so back-button doesn't re-trigger
    navigate({ to: '/map', search: {}, replace: true })

    // Capture values before async — navigate may clear them
    const pc = postcode
    const hn = huisnummer

    // Clear stale focus immediately so old parcel/marker never lingers while loading a new one.
    setTier('none')
    setParcelGeometryHighlight(null)
    setActivePanel(null)
    pendingLookupInspectorRef.current = null
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }

    setPropertyLngLat(null)
    focusAddressWithLookup({
      postcode: pc,
      huisnummer: hn,
      showToastOnError: true,
      openInspectorOnSuccess: true,
    })
  }, [postcode, huisnummer, navTs, navigate, focusAddressWithLookup])

  const loadedScoreLayerScanIdRef = useRef<string | null>(null)
  const scoreLayerPendingRef = useRef(false)

  const ensureParcelScoreLayer = useCallback((scanId: string, forceBust?: string) => {
    const map = mapRef.current
    if (!map) return

    // Skip if this exact scan is already loaded (unless force-busting cache)
    if (!forceBust && loadedScoreLayerScanIdRef.current === scanId && map.getSource('parcel-scores')) {
      return
    }

    // Skip if another call is already in-flight for the same scan
    if (scoreLayerPendingRef.current) return
    scoreLayerPendingRef.current = true

    const tileUrl = getScanTileUrl(scanId, forceBust)

    const addLayerSafe = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', addLayerSafe)
        return // Don't clear pending — still waiting
      }
      try {
        if (map.getSource('parcel-scores')) {
          updateParcelScoreSource(map, tileUrl, 'parcel_scores')
        } else {
          addParcelScoreLayer(map, tileUrl, 'parcel_scores')
        }
        loadedScoreLayerScanIdRef.current = scanId
        // Add favorite markers layer on top of parcel score layer
        if (!map.getSource('favorite-markers')) {
          addFavoriteMarkersLayer(map)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('Style is not done loading')) {
          map.once('styledata', addLayerSafe)
          return // Don't clear pending — still waiting
        }
        throw error
      }
      scoreLayerPendingRef.current = false
    }

    addLayerSafe()
  }, [mapRef])

  // Show score layer when scan completes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !scanStatus.data) return

    if (scanStatus.data.status === 'completed' && activeScanId) {
      // Add score overlay tiles from backend proxy
      ensureParcelScoreLayer(activeScanId)
    }
  }, [scanStatus.data, activeScanId, mapReady, ensureParcelScoreLayer])

  // Load score layer when activeScanId is set or parcels toggled on
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeScanId) return
    ensureParcelScoreLayer(activeScanId)
  }, [activeScanId, mapReady, ensureParcelScoreLayer, layerState.showParcels])

  // Update score threshold filter when org setting changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    updateScoreThreshold(map, scoreThreshold)
  }, [scoreThreshold, mapReady, mapRef])

  // Reload tiles when score weights change (rescore invalidation)
  useEffect(() => {
    if (!scoreWeightsData || !activeScanId || !mapReady) return
    // Use a stable key from the weights to detect actual changes
    const key = JSON.stringify(scoreWeightsData.weights)
    if (tileCacheBusterRef.current === key) return
    tileCacheBusterRef.current = key
    // Force tile reload with new cache buster
    ensureParcelScoreLayer(activeScanId, Date.now().toString())
  }, [scoreWeightsData, activeScanId, mapReady, ensureParcelScoreLayer])

  // Update favorite markers when centroids data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!map.getSource('favorite-markers')) return
    updateFavoriteMarkers(map, favoriteCentroids ?? [])
  }, [favoriteCentroids, mapReady])

  // Handle scan completion and failure
  useEffect(() => {
    if (!scanStatus.data) return
    if (!shouldAutoFollowScanRef.current) return

    if (scanStatus.data.status === 'completed') {
      shouldAutoFollowScanRef.current = false
      toast.success(`Scan voltooid: ${scanStatus.data.results_count} percelen gevonden`)
      // Invalidate stale results cache so fresh data is fetched
      queryClient.invalidateQueries({ queryKey: ['scan-results', activeScanId] })
      // Navigate via shared handler (prevents double-navigation with CTA button)
      handleViewResults()
    } else if (scanStatus.data.status === 'failed') {
      shouldAutoFollowScanRef.current = false
      toast.error('Scan mislukt')
      setActiveScanId(null) // Clear scan
    }
  }, [scanStatus.data, activeScanId, handleViewResults, queryClient])

  // Setup bestemmingsplan click handler
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const cleanup = setupBestemmingsplanClickHandler(
      mapRef.current,
      (info, lngLat) => setZoneInfo({ info, lngLat }),
      (loading) => setZoneLoading(loading)
    )
    return cleanup
  }, [mapReady])

  // Open inspector when a parcel is clicked on the map and ensure pointer cursor
  // appears consistently on clickable parcel overlays.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const interactiveParcelLayers = [
      PARCEL_SCORE_FILL_LAYER_ID,
      PARCEL_BUILT_STATUS_FILL_LAYER_ID,
      PARCEL_REPORT_STATUS_FILL_LAYER_ID,
      PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID,
      PARCEL_BUILD_CAPACITY_FILL_LAYER_ID,
      PARCEL_FOUNDATION_RISK_FILL_LAYER_ID,
    ]

    const buildParcelFromFeatureProps = (
      props: maplibregl.GeoJSONFeature['properties']
    ): ScanResultItem | null => {
      if (!props) return null

      const listingDurationDays = parseFeatureInt(props.listing_duration_days)
      const priceChangeCount = parseFeatureInt(props.price_change_count)
      const listingSnapshotsCount = parseFeatureInt(props.listing_snapshots_count)
      const daysSinceLastSeen = parseFeatureInt(props.days_since_last_seen)
      const marketSignals =
        listingDurationDays !== null ||
        priceChangeCount !== null ||
        listingSnapshotsCount !== null ||
        daysSinceLastSeen !== null
          ? {
              listing_duration_days: listingDurationDays ?? 0,
              price_change_count: priceChangeCount ?? 0,
              listing_snapshots_count: listingSnapshotsCount ?? 0,
              days_since_last_seen: daysSinceLastSeen ?? 0,
            }
          : null
      return {
        parcel_id: (props.parcel_id as string) ?? '',
        parcel_code: (props.parcel_code as string) ?? '',
        address: (props.address as string | null) ?? null,
        gemeente_code: (props.gemeente_code as string | null) ?? null,
        area_m2: parseFeatureNumber(props.area_m2),
        has_pand: parseFeatureBool(props.has_pand),
        bouwjaar: parseFeatureInt(props.bouwjaar),
        pand_status: (props.pand_status as string | null) ?? null,
        bestemmingen: null,
        score: parseFeatureNumber(props.score),
        score_category: (props.score_category as string | null) ?? null,
        score_breakdown: null,
        vacancy_signal: (props.vacancy_signal as string | null) ?? null,
        vacancy_confidence: parseFeatureNumber(props.vacancy_confidence),
        vacancy_reasons: null,
        vacancy_model_version: (props.vacancy_model_version as string | null) ?? null,
        market_signals: marketSignals,
        opportunity_signals: null,
        building_metrics: {
          max_bebouwingspercentage:
            (props.max_bebouwingspercentage as number | null) ?? null,
          max_floor_area_ratio:
            (props.max_floor_area_ratio as number | null) ?? null,
        },
        has_report: parseFeatureBool(props.has_report),
      }
    }

    const queryTopParcelFeature = (point: maplibregl.PointLike): maplibregl.MapGeoJSONFeature | null => {
      const availableLayers = interactiveParcelLayers.filter((layerId) => map.getLayer(layerId))
      if (availableLayers.length === 0) return null
      const [feature] = map.queryRenderedFeatures(point, { layers: availableLayers })
      return feature ?? null
    }

    const handleParcelClick = (e: maplibregl.MapMouseEvent) => {
      // Only respond to clicks when the Percelen toggle is ON
      const parcelModeActive = isParcelsVisibleRef.current
      const requestSeq = ++parcelClickRequestSeqRef.current
      const feature = parcelModeActive ? queryTopParcelFeature(e.point) : null
      if (feature?.properties) {
        const parcel = buildParcelFromFeatureProps(feature.properties)
        if (parcel) {
          setTier('none')
          setActivePanel({ kind: 'parcel', parcel })

          // Fetch full scan data so tile-clicked parcels get the same rich
          // fields (opportunity_signals, vacancy_reasons, score_breakdown,
          // bestemmingen) as the spatial-lookup fallback path.
          if (accessToken) {
            void fetchParcelAtPoint(e.lngLat.lng, e.lngLat.lat, accessToken, {
              scanId: activeScanIdRef.current,
            })
              .then((resolved) => {
                if (requestSeq !== parcelClickRequestSeqRef.current) return
                setActivePanel((prev) => {
                  if (!prev || prev.kind !== 'parcel') return prev
                  if (prev.parcel.parcel_id !== parcel.parcel_id) return prev
                  return { kind: 'parcel', parcel:
                    makeInspectorParcel({
                      parcelId: resolved.parcel_id,
                      address: resolved.address ?? parcel.address,
                      parcelCode: resolved.parcel_code ?? parcel.parcel_code,
                      gemeenteCode: resolved.gemeente_code ?? parcel.gemeente_code,
                      areaM2: resolved.area_m2 ?? parcel.area_m2,
                      hasPand: resolved.has_pand ?? parcel.has_pand,
                      bouwjaar: resolved.bouwjaar ?? parcel.bouwjaar,
                      pandStatus: resolved.pand_status ?? parcel.pand_status,
                      score: resolved.score ?? parcel.score,
                      scoreCategory: resolved.score_category ?? parcel.score_category,
                      scoreBreakdown: resolved.score_breakdown ?? parcel.score_breakdown,
                      potentieScore: resolved.potentie_score ?? parcel.potentie_score,
                      risicoScore: resolved.risico_score ?? parcel.risico_score,
                      vacancySignal:
                        (resolved.vacancy_signal as ScanResultItem['vacancy_signal']) ??
                        parcel.vacancy_signal,
                      vacancyConfidence: resolved.vacancy_confidence ?? parcel.vacancy_confidence,
                      vacancyReasons: resolved.vacancy_reasons ?? parcel.vacancy_reasons,
                      vacancyModelVersion: resolved.vacancy_model_version ?? parcel.vacancy_model_version,
                      marketSignals: resolved.market_signals ?? parcel.market_signals,
                      opportunitySignals: resolved.opportunity_signals ?? parcel.opportunity_signals,
                      buildingMetrics: resolved.building_metrics ?? (parcel.building_metrics as Record<string, unknown> | null),
                      bestemmingen: resolved.bestemmingen ?? parcel.bestemmingen ?? null,
                      hasReport: resolved.has_report ?? parcel.has_report,
                    })
                  }
                })
                if (resolved.geometry) {
                  setParcelGeometryHighlight({
                    lng: resolved.lng,
                    lat: resolved.lat,
                    parcelCode: resolved.parcel_code ?? parcel.parcel_code ?? null,
                    areaM2: resolved.area_m2 ?? parcel.area_m2 ?? null,
                    geometry: resolved.geometry,
                  })
                }
                setPropertyLngLat([resolved.lng, resolved.lat])
              })
              .catch(() => {
                // Keep modal data from tile props when full lookup fails.
              })
          }
          return
        }
      }

      // Fallback path: no scored feature under cursor.
      // Try spatial point lookup so "Percelen" mode remains clickable.
      if (!parcelModeActive || !accessToken) return
      void fetchParcelAtPoint(e.lngLat.lng, e.lngLat.lat, accessToken, {
        scanId: activeScanIdRef.current,
      })
        .then((resolved) => {
          if (requestSeq !== parcelClickRequestSeqRef.current) return

          setTier('none')
          setActivePanel({ kind: 'parcel', parcel:
            makeInspectorParcel({
              parcelId: resolved.parcel_id,
              address: resolved.address ?? null,
              parcelCode: resolved.parcel_code ?? null,
              gemeenteCode: resolved.gemeente_code ?? null,
              areaM2: resolved.area_m2 ?? null,
              hasPand: resolved.has_pand,
              bouwjaar: resolved.bouwjaar ?? null,
              pandStatus: resolved.pand_status ?? null,
              score: resolved.score ?? null,
              scoreCategory: resolved.score_category ?? null,
              scoreBreakdown: resolved.score_breakdown ?? null,
              potentieScore: resolved.potentie_score ?? null,
              risicoScore: resolved.risico_score ?? null,
              vacancySignal:
                (resolved.vacancy_signal as ScanResultItem['vacancy_signal']) ??
                null,
              vacancyConfidence: resolved.vacancy_confidence ?? null,
              vacancyReasons: resolved.vacancy_reasons ?? null,
              vacancyModelVersion: resolved.vacancy_model_version ?? null,
              marketSignals: resolved.market_signals ?? null,
              opportunitySignals: resolved.opportunity_signals ?? null,
              buildingMetrics: resolved.building_metrics ?? null,
              bestemmingen: resolved.bestemmingen ?? null,
              hasReport: resolved.has_report,
            })
          })
          if (resolved.geometry) {
            setParcelGeometryHighlight({
              lng: resolved.lng,
              lat: resolved.lat,
              parcelCode: resolved.parcel_code ?? null,
              areaM2: resolved.area_m2 ?? null,
              geometry: resolved.geometry,
            })
          }
          setPropertyLngLat([resolved.lng, resolved.lat])
        })
        .catch(() => {
          // Silent: click misses should not spam toasts during map exploration.
        })
    }

    const handleCursorMove = (e: maplibregl.MapMouseEvent) => {
      const parcelModeActive = isParcelsVisibleRef.current
      if (!parcelModeActive || map.getZoom() < PARCEL_INTERACTION_MIN_ZOOM) {
        map.getCanvas().style.cursor = ''
        return
      }
      const feature = queryTopParcelFeature(e.point)
      map.getCanvas().style.cursor = feature ? 'pointer' : ''
    }

    const resetCursor = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', handleParcelClick)
    map.on('mousemove', handleCursorMove)
    map.on('mouseout', resetCursor)
    return () => {
      map.off('click', handleParcelClick)
      map.off('mousemove', handleCursorMove)
      map.off('mouseout', resetCursor)
    }
  }, [accessToken, makeInspectorParcel, mapReady, mapRef])

  // Cleanup highlight and BAG layer on unmount
  useEffect(() => {
    const map = mapRef.current
    return () => {
      if (map) {
        removeScanAreaHighlight(map)
        removeBAGPandLayer(map)
      }
    }
  }, [])

  // Show monitored wijk overlay when wijk GeoJSON loads and monitored projects exist
  useEffect(() => {
    if (!mapReady || !mapRef.current || !wijkGeojson) return

    // Extract monitored wijk names from projects data
    const monitoredWijkNames: string[] = []
    if (monitoredProjects?.projects) {
      for (const project of monitoredProjects.projects) {
        // Children are wijk projects with wijk_naam
        if (project.children) {
          for (const child of project.children) {
            if (child.wijk_naam) {
              monitoredWijkNames.push(child.wijk_naam)
            }
          }
        }
        // Also check top-level wijk projects (flat response fallback)
        if (project.wijk_naam) {
          monitoredWijkNames.push(project.wijk_naam)
        }
      }
    }

    if (monitoredWijkNames.length === 0) return

    addMonitoredWijkOverlay(mapRef.current, wijkGeojson, monitoredWijkNames)

    return () => {
      if (mapRef.current) {
        removeMonitoredWijkOverlay(mapRef.current)
      }
    }
  }, [mapReady, wijkGeojson, monitoredProjects])

  // Show scanned wijk highlight when wijk GeoJSON loads and scan history has completed scans
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    if (!showScannedWijkBoundaries || !wijkGeojson || scannedWijkNames.length === 0) {
      removeScannedWijkHighlight(mapRef.current)
      return
    }

    addScannedWijkHighlight(mapRef.current, wijkGeojson, scannedWijkNames)
    return () => {
      if (mapRef.current) removeScannedWijkHighlight(mapRef.current)
    }
  }, [mapReady, wijkGeojson, scannedWijkNames, showScannedWijkBoundaries])

  // Handle address selection from search
  const handleAddressSelect = useCallback(async (suggestion: SuggestResult) => {
    setParcelGeometryHighlight(null)
    setActivePanel(null)
    pendingLookupInspectorRef.current = null
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }

    setTier('none')
    setPropertyLngLat(null)

    try {
      // PDOK suggest only returns id + weergavenaam, so look up full details
      const details = await lookupPdokAddress(suggestion.id)

      const pc = details.postcode?.replace(/\s/g, '')
      const hn = details.huisnummer

      if (!pc || !hn) {
        console.warn('Could not extract postcode/huisnummer from PDOK lookup:', details)
        return
      }

      // Extract coordinates — flyTo handled by dedicated effect
      if (details.centroide_ll) {
        const match = details.centroide_ll.match(/POINT\(([^ ]+) ([^ ]+)\)/)
        if (match) {
          setPropertyLngLat([parseFloat(match[1]!), parseFloat(match[2]!)])
        }
      }

      // Set pending ref so the useEffect auto-opens ParcelDetailModal on lookup success
      pendingLookupInspectorRef.current = { postcode: pc, huisnummer: hn }

      // Trigger property lookup — parcel detail panel opens via pendingLookupInspectorRef effect
      lookup.mutate(
        { postcode: pc, huisnummer: hn },
        {
          onSuccess: (data) => {
            addRecentItem({
              id: data.address.nummeraanduiding_id,
              report_name: `${data.address.straat} ${data.address.huisnummer}${data.address.huisletter || ''}${data.address.toevoeging || ''}`,
              postcode: data.address.postcode,
              huisnummer: data.address.huisnummer,
              woonplaats: data.address.woonplaats,
            })
          },
          onError: () => {
            pendingLookupInspectorRef.current = null
            toast.error('Adres niet gevonden')
          },
        }
      )
    } catch (err) {
      console.error('PDOK address lookup failed:', err)
    }
  }, [lookup, addRecentItem])

  // Handle QuickCard close (clears everything)
  const handleCloseQuickCard = useCallback(() => {
    setTier('none')
    setPropertyLngLat(null)
    setParcelGeometryHighlight(null)
    pendingLookupInspectorRef.current = null
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }
  }, [])

  // Wijk click handler — opens wijk detail panel instead of scan confirmation
  const handleWijkClick = useCallback(
    (
      wijkCode: string,
      wijkNaam: string,
      bbox: [number, number, number, number],
      geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
    ) => {
      const currentGemeente = activeGemeenteRef.current
      if (!currentGemeente || !mapRef.current) return

      // Highlight selected wijk
      removeScanAreaHighlight(mapRef.current)
      addScanAreaHighlight(mapRef.current, geometry)

      // Zoom to wijk — percentage-based padding
      const canvas = mapRef.current.getCanvas()
      const padX = Math.round(canvas.clientWidth * 0.08)
      const padY = Math.round(canvas.clientHeight * 0.08)
      mapRef.current.fitBounds(
        [bbox[0], bbox[1], bbox[2], bbox[3]] as [number, number, number, number],
        { padding: { top: padY, bottom: padY, left: padX, right: padX }, duration: 600, maxZoom: 15 }
      )

      // Find latest scan for this wijk
      const latestScan = scanHistory?.scans?.find(
        (s) =>
          s.gemeente_code === currentGemeente.code &&
          s.wijk_naam === wijkNaam &&
          s.status === 'completed'
      ) ?? null

      setActivePanel({
        kind: 'wijk',
        code: wijkCode,
        naam: wijkNaam,
        gemeenteCode: currentGemeente.code,
        gemeenteNaam: currentGemeente.naam,
        latestScan,
      })
    },
    [scanHistory?.scans]
  )

  // Ref for wijk click handler to avoid stale closure
  const handleWijkClickRef = useRef(handleWijkClick)
  handleWijkClickRef.current = handleWijkClick

  // Confirm wijk scan from confirmation dialog
  const handleConfirmScan = useCallback(() => {
    if (!pendingScan) return

    const { wijkNaam, ...scanParams } = pendingScan
    setPendingScan(null)

    triggerScan.mutate(
      { ...scanParams, wijk_naam: wijkNaam },
      {
        onSuccess: (data) => {
          setActiveScanId(data.scan_id)
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
          if (data.status === 'existing' && !data.needs_rescan) {
            shouldAutoFollowScanRef.current = false
            navigate({ to: '/resultaten', search: { scan_id: data.scan_id } })
            toast.info(`Bestaande scan gevonden — resultaten laden`)
          } else {
            shouldAutoFollowScanRef.current = true
            toast.success(`Scan gestart voor ${wijkNaam}`)
          }
        },
        onError: (err) => {
          toast.error(`Scan starten mislukt: ${err.message}`)
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
        },
      }
    )
  }, [pendingScan, triggerScan, navigate])

  // Cancel wijk scan confirmation
  const handleCancelScan = useCallback(() => {
    setPendingScan(null)
    if (mapRef.current) removeScanAreaHighlight(mapRef.current)
    setSelectedArea(null)
  }, [])

  const activateGemeenteContext = useCallback(
    async (
      gemeenteCode: string,
      gemeenteNaam: string,
      bbox: [number, number, number, number],
      options?: { force?: boolean; showLoadedToast?: boolean }
    ): Promise<GeoJSON.FeatureCollection | null> => {
      if (!mapRef.current) return null

      // Guard: prevent selection during active scan
      if (isScanRunning) {
        toast.info('Scan al bezig, wacht even...')
        return null
      }

      // If clicking same gemeente, do nothing unless forced (URL deep-link flow)
      if (!options?.force && activeGemeenteRef.current?.code === gemeenteCode) {
        return wijkGeojsonRef.current
      }

      // Clear previous wijk layer if switching gemeente
      if (wijkGeojsonRef.current && mapRef.current) {
        removeWijkBoundariesLayer(mapRef.current)
        setWijkGeojson(null)
      }

      // Remove any existing scan area highlight
      removeScanAreaHighlight(mapRef.current)
      setSelectedArea(null)

      // Set active gemeente context, zoom, and open panel
      setActiveGemeente({ code: gemeenteCode, naam: gemeenteNaam, bbox })
      setActivePanel({ kind: 'gemeente', code: gemeenteCode, naam: gemeenteNaam, bbox })
      // Zoom to gemeente — delay slightly so the left panel portal has expanded
      // and the map canvas has resized (first click measures pre-shrink canvas otherwise)
      const map = mapRef.current
      setTimeout(() => {
        if (!map) return
        map.resize()
        const canvas = map.getCanvas()
        const cw = canvas.clientWidth
        const ch = canvas.clientHeight
        const padX = Math.round(cw * 0.08)
        const padY = Math.round(ch * 0.08)
        map.fitBounds(
          [bbox[0], bbox[1], bbox[2], bbox[3]] as [number, number, number, number],
          { padding: { top: padY, bottom: padY, left: padX, right: padX }, duration: 800, maxZoom: 12 }
        )
      }, 400) // matches 350ms portal transition + buffer

      // Fetch wijken from backend
      try {
        const geojson = await fetchWijken(gemeenteCode, accessToken)
        setWijkGeojson(geojson)

        // Replace wijk layer with fresh data
        if (mapRef.current) {
          if (mapRef.current.getSource('cbs-wijken')) {
            removeWijkBoundariesLayer(mapRef.current)
          }
          addWijkBoundariesLayer(mapRef.current, geojson, (code, naam, nextBbox, geometry) => {
            handleWijkClickRef.current(code, naam, nextBbox, geometry)
          })
          setWijkBoundariesVisibility(mapRef.current, true)
        }

        if (options?.showLoadedToast) {
          toast.success(`${gemeenteNaam}: ${geojson.features.length} wijken geladen`)
        }

        return geojson
      } catch (err) {
        console.error('Failed to fetch wijken:', err)
        toast.error('Kon wijken niet laden')
        setActiveGemeente(null) // Clear context on error
        return null
      }
    },
    [accessToken, isScanRunning]
  )

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    if (!layerState.showGemeenten || !gemeenteGeojson) return

    const map = mapRef.current
    if (!map.getSource('cbs-gemeenten')) {
      addGemeenteBoundariesLayer(map, gemeenteGeojson, (gemeenteCode, gemeenteNaam, bbox, _geometry) => {
        void activateGemeenteContext(gemeenteCode, gemeenteNaam, bbox)
      })
      return
    }

    setGemeenteBoundariesVisibility(map, true)
  }, [mapReady, mapRef, layerState.showGemeenten, gemeenteGeojson, activateGemeenteContext])

  // Gemeenten layer toggle handler — no-arg, uses hook action
  const handleGemeentenToggle = useCallback(
    () => {
      const next = !layerState.showGemeenten
      layerActions.setGemeenten(next)

      if (!mapRef.current) return
      const map = mapRef.current

      if (next) {
        // Gemeenten ON → turn off parcels (exclusive modes), close any parcel panel
        if (layerState.showParcels) {
          handleParcelsLayerToggle(false)
          setParcelBoundariesVisibility(map, false)
        }
        // Close any active panel and zoom to NL overview
        setActivePanel(null)
        setParcelGeometryHighlight(null)
        map.flyTo({ center: NL_CENTER, zoom: NL_ZOOM, duration: 1000 })
        return
      }

      // Gemeenten OFF → hide boundaries, clear all gemeente/wijk context
      setGemeenteBoundariesVisibility(map, false)
      if (wijkGeojsonRef.current) {
        removeWijkBoundariesLayer(map)
        setWijkGeojson(null)
      }
      removeScanAreaHighlight(map)
      setSelectedArea(null)
      setActiveGemeente(null)
      setActivePanel(null)
      map.flyTo({ center: NL_CENTER, zoom: NL_ZOOM, duration: 1000 })
    },
    [layerState.showGemeenten, layerState.showParcels, layerActions, mapRef, handleParcelsLayerToggle, setActivePanel, setParcelGeometryHighlight]
  )

  // Handle direct gemeente/wijk navigation from projects flow.
  // Deep-link example: /map?gemeente_code=GM0983&wijk_naam=Wijk%2044%20Arcen
  useEffect(() => {
    if (!urlGemeenteCode || !mapReady || !mapRef.current) return
    if (urlParcelId || urlScanId || reportId) return

    const navKey = `${normalizeGemeenteCode(urlGemeenteCode)}:${normalizeAreaName(urlWijkNaam ?? '')}:${navTs ?? 0}`
    if (handledGemeenteWijkRef.current === navKey) return
    layerActions.setGemeenten(true)
    if (!gemeenteGeojson) return

    let cancelled = false

    const run = async () => {
      const map = mapRef.current
      if (!map) return
      const geojson = gemeenteGeojson
      handledGemeenteWijkRef.current = navKey

      // Ensure gemeente layer exists + visible so geometry context is consistent.
      if (!map.getSource('cbs-gemeenten')) {
        addGemeenteBoundariesLayer(map, geojson, (gemeenteCode, gemeenteNaam, bbox, _geometry) => {
          void activateGemeenteContext(gemeenteCode, gemeenteNaam, bbox)
        })
      } else {
        setGemeenteBoundariesVisibility(map, true)
      }

      const targetCode = normalizeGemeenteCode(urlGemeenteCode)
      const targetFeature = geojson.features.find((feature) => {
        const featureCode = String(feature.properties?.statcode ?? '')
        return normalizeGemeenteCode(featureCode) === targetCode
      })

      if (!targetFeature) {
        toast.error('Gemeente niet gevonden')
        return
      }

      const targetGeometry = targetFeature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined
      if (!targetGeometry || (targetGeometry.type !== 'Polygon' && targetGeometry.type !== 'MultiPolygon')) {
        return
      }

      const gemeenteNaam = String(targetFeature.properties?.statnaam ?? urlGemeenteCode)
      const gemeenteCode = String(targetFeature.properties?.statcode ?? urlGemeenteCode)
      const gemeenteBbox = calculateBboxFromGeometry(targetGeometry)

      const loadedWijkGeojson = await activateGemeenteContext(
        gemeenteCode,
        gemeenteNaam,
        gemeenteBbox,
        { force: true, showLoadedToast: false }
      )
      if (cancelled) return

      // Optional wijk focus
      if (loadedWijkGeojson && urlWijkNaam && mapRef.current) {
        const targetWijk = loadedWijkGeojson.features.find((feature) => (
          normalizeAreaName(String(feature.properties?.statnaam ?? '')) === normalizeAreaName(urlWijkNaam)
        ))
        const targetWijkGeometry = targetWijk?.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined
        if (targetWijkGeometry && (targetWijkGeometry.type === 'Polygon' || targetWijkGeometry.type === 'MultiPolygon')) {
          const wijkBbox = calculateBboxFromGeometry(targetWijkGeometry)
          mapRef.current.fitBounds(
            [wijkBbox[0], wijkBbox[1], wijkBbox[2], wijkBbox[3]] as [number, number, number, number],
            { padding: 80, duration: 900, maxZoom: 17 }
          )
        }
      }

      // Clear URL after one-time handling.
      navigate({ to: '/map', search: {}, replace: true })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [
    urlGemeenteCode,
    urlWijkNaam,
    navTs,
    mapReady,
    urlParcelId,
    urlScanId,
    reportId,
    gemeenteGeojson,
    activateGemeenteContext,
    navigate,
    layerActions,
  ])

  // Bestemmingsplan layer toggle handler — no-arg, uses hook action
  const handleBestemmingsplanToggle = useCallback(
    () => {
      if (!mapRef.current) return

      const map = mapRef.current
      const next = !layerState.showBestemmingsplan

      if (next) {
        // Add source if it doesn't exist
        if (!map.getSource('pdok-bestemmingsplan')) {
          addBestemmingsplanLayer(map)
        }
        // Show layer
        setBestemmingsplanVisibility(map, true)
        layerActions.setBestemmingsplan(true)
        layerActions.setActiveParcelOverlay('bestemmingsplan')
      } else {
        // Hide layer
        setBestemmingsplanVisibility(map, false)
        layerActions.setBestemmingsplan(false)
        setZoneInfo(null)
        // Revert to default overlay if bestemmingsplan was active
        if (layerState.activeParcelOverlay === 'bestemmingsplan') {
          layerActions.setActiveParcelOverlay('potential')
        }
      }
    },
    [layerState.showBestemmingsplan, layerState.activeParcelOverlay, layerActions, mapRef]
  )

  // BAG Panden layer toggle handler
  const handleBAGPandenToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      const map = mapRef.current

      if (visible) {
        if (!map.getSource('pdok-bag-pand')) {
          addBAGPandLayer(map)
        }
        setBAGPandVisibility(map, true)
      } else {
        setBAGPandVisibility(map, false)
      }
    },
    []
  )

  // Score layer visibility toggle handler
  const handleScoreToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelScoreVisibility(mapRef.current, visible)
      if (visible) layerActions.setActiveParcelOverlay('potential')
    },
    [layerActions]
  )

  const handleBuiltStatusToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelBuiltStatusVisibility(mapRef.current, visible)
      if (visible) layerActions.setActiveParcelOverlay('built_status')
    },
    [layerActions]
  )

  const handleReportStatusToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelReportStatusVisibility(mapRef.current, visible)
      if (visible) layerActions.setActiveParcelOverlay('report_coverage')
    },
    [layerActions]
  )

  const handleVacancySignalToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelVacancySignalVisibility(mapRef.current, visible)
      if (visible) layerActions.setActiveParcelOverlay('vacancy_signal')
    },
    [layerActions]
  )

  const handleBuildCapacityToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelBuildCapacityVisibility(mapRef.current, visible)
      if (visible) layerActions.setActiveParcelOverlay('build_capacity')
    },
    [layerActions]
  )

  const handleFoundationRiskToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelFoundationRiskVisibility(mapRef.current, visible)
      if (visible) layerActions.setActiveParcelOverlay('foundation_risk')
    },
    [layerActions]
  )

  const handleScannedScopeToggle = useCallback((visible: boolean) => {
    setShowScannedWijkBoundaries(visible)
  }, [])

  // Unified overlay select handler for OverlayPicker
  const handleOverlaySelect = useCallback(
    (overlayId: import('@/lib/map/layers').ParcelOverlayLayerId) => {
      if (!mapRef.current) return

      if (overlayId === 'bestemmingsplan') {
        // Turn off all score overlays
        handleScoreToggle(false)
        handleBuiltStatusToggle(false)
        handleReportStatusToggle(false)
        handleVacancySignalToggle(false)
        handleBuildCapacityToggle(false)
        handleFoundationRiskToggle(false)
        // Turn on bestemmingsplan if not already on
        if (!layerState.showBestemmingsplan) handleBestemmingsplanToggle()
        layerActions.setActiveParcelOverlay('bestemmingsplan')
      } else {
        // Turn off bestemmingsplan if active
        if (layerState.showBestemmingsplan) handleBestemmingsplanToggle()
        // Turn off all score overlays first
        handleScoreToggle(false)
        handleBuiltStatusToggle(false)
        handleReportStatusToggle(false)
        handleVacancySignalToggle(false)
        handleBuildCapacityToggle(false)
        handleFoundationRiskToggle(false)
        // Turn on the selected one
        const handlers: Record<string, (v: boolean) => void> = {
          potential: handleScoreToggle,
          built_status: handleBuiltStatusToggle,
          report_coverage: handleReportStatusToggle,
          vacancy_signal: handleVacancySignalToggle,
          build_capacity: handleBuildCapacityToggle,
          foundation_risk: handleFoundationRiskToggle,
        }
        handlers[overlayId]?.(true)
      }
    },
    [
      mapRef, layerState.showBestemmingsplan, layerActions,
      handleScoreToggle, handleBuiltStatusToggle, handleReportStatusToggle,
      handleVacancySignalToggle, handleBuildCapacityToggle, handleFoundationRiskToggle,
      handleBestemmingsplanToggle,
    ]
  )

  // Handle "Scan dit gebied" from bestemmingsplan zone
  const handleScanZone = useCallback(() => {
    if (!mapRef.current || !zoneInfo) return

    // Guard: prevent scan during active scan
    if (isScanRunning) {
      toast.info('Scan al bezig, wacht even...')
      return
    }

    // Try to find gemeente at zone click location
    const point = mapRef.current.project(new maplibregl.LngLat(zoneInfo.lngLat[0], zoneInfo.lngLat[1]))
    const features = mapRef.current.queryRenderedFeatures(point, { layers: ['gemeente-fill'] })

    if (features.length === 0) {
      toast.info('Zet de gemeentegrenzen aan om een scan te starten')
      return
    }

    const gemeenteFeature = features[0]
    const gemeenteCode = gemeenteFeature?.properties?.statcode as string
    const gemeenteNaam = gemeenteFeature?.properties?.statnaam as string

    if (!gemeenteCode || !gemeenteNaam) return

    // Use viewport bbox
    const bounds = mapRef.current.getBounds()
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ]

    const bboxPolygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[
        [bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]],
      ]],
    }
    addScanAreaHighlight(mapRef.current, bboxPolygon)
    setSelectedArea({ bbox, name: `${zoneInfo.info.bestemmingType} - ${zoneInfo.info.planNaam}`, source: 'bestemmingsplan' })

    // Trigger scan directly (bestemmingsplan click is already a deliberate action)
    triggerScan.mutate(
      { gemeente_code: gemeenteCode, gemeente_naam: gemeenteNaam, bbox_wgs84: bbox },
      {
        onSuccess: (data) => {
          setActiveScanId(data.scan_id)
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
          setZoneInfo(null) // Close zone info card
          if (data.status === 'existing' && !data.needs_rescan) {
            navigate({ to: '/resultaten', search: { scan_id: data.scan_id } })
            toast.info(`Bestaande scan gevonden — resultaten laden`)
          } else {
            toast.success('Scan gestart')
          }
        },
        onError: (err) => {
          toast.error(`Scan starten mislukt: ${err.message}`)
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
        },
      }
    )
  }, [zoneInfo, triggerScan, isScanRunning])

  // Panel: start scan from wijk panel
  const handleWijkPanelStartScan = useCallback(() => {
    if (!activePanel || activePanel.kind !== 'wijk') return
    const currentGemeente = activeGemeenteRef.current
    if (!currentGemeente) return

    // Find wijk feature for bbox
    const feature = wijkGeojson?.features.find(
      (f) => (f.properties?.statcode as string) === activePanel.code
    )
    if (!feature) return

    const bbox = calculateBboxFromGeometry(
      feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
    ) as [number, number, number, number]

    setPendingScan({
      wijkNaam: activePanel.naam,
      gemeente_code: currentGemeente.code,
      gemeente_naam: currentGemeente.naam,
      bbox_wgs84: bbox,
    })
  }, [activePanel, wijkGeojson])

  // No-arg parcel toggle — wraps side-effect handler with current state
  const handleParcelsToggle = useCallback(() => {
    handleParcelsLayerToggle(!layerState.showParcels)
  }, [handleParcelsLayerToggle, layerState.showParcels])

  // Auto-enable parcels when external triggers set autoEnableParcelsKey
  // (address search, URL navigation, report focus flows).
  // Gemeente cleanup is handled by exitGemeenteMode at each call site.
  useEffect(() => {
    if (!autoEnableParcelsKey) return
    if (!layerState.showParcels) {
      handleParcelsLayerToggle(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnableParcelsKey])

  return (
    <MapShell>
      {/* Search pill — top-left, shifts right when left panel (gemeente/wijk) or right panel (parcel) is open */}
      <motion.div
        className="absolute top-6 left-8 z-[var(--z-search-bar)] h-14 bg-white/40 backdrop-blur-2xl border border-white/30 ring-1 ring-inset ring-white/30 rounded-full flex items-center px-4 shadow-lg"
        animate={{ x: panelOpen ? 636 : leftPanelOpen ? 636 : 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      >
        <AddressSearch onSelect={handleAddressSelect} />
      </motion.div>

      {/* View toggle — bottom-left */}
      <motion.div
        className="absolute bottom-6 left-8 z-[var(--z-search-bar)] h-12 bg-white/40 backdrop-blur-2xl border border-white/30 ring-1 ring-inset ring-white/30 rounded-full flex items-center px-3 shadow-lg"
        animate={{ x: panelOpen ? 636 : leftPanelOpen ? 636 : 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      >
        <LayerToggle
          mapRef={mapRef}
          mapReady={mapReady}
          basemap={layerState.basemap}
          showParcels={layerState.showParcels}
          showGemeenten={layerState.showGemeenten}
          showBestemmingsplan={layerState.showBestemmingsplan}
          activeParcelOverlay={layerState.activeParcelOverlay}
          onBasemapChange={layerActions.setBasemap}
          onParcelsToggle={handleParcelsToggle}
          onGemeentenToggle={handleGemeentenToggle}
          onBestemmingsplanToggle={handleBestemmingsplanToggle}
          onBAGPandenToggle={handleBAGPandenToggle}
          onScannedScopeToggle={handleScannedScopeToggle}
          onScoreToggle={handleScoreToggle}
          onBuiltStatusToggle={handleBuiltStatusToggle}
          onReportStatusToggle={handleReportStatusToggle}
          onVacancySignalToggle={handleVacancySignalToggle}
          onBuildCapacityToggle={handleBuildCapacityToggle}
          onFoundationRiskToggle={handleFoundationRiskToggle}
          hasScoreData={!!activeScanId}
        />
      </motion.div>

      {/* Bestemmingsplan legend */}
      <BestemmingsplanLegend visible={layerState.showBestemmingsplan} />

      {/* Zone info card */}
      {zoneLoading && (
        <div className="absolute bottom-20 left-4 bg-aura-glass-white/60 md:bg-aura-glass-white/60/90 md:backdrop-blur-md border border-neutral-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-aura-amber"></div>
            <p className="text-sm text-neutral-600">Zone info laden...</p>
          </div>
        </div>
      )}
      {zoneInfo && !zoneLoading && (
        <div className="absolute bottom-20 left-4 bg-aura-glass-white/60 md:bg-aura-glass-white/60/90 md:backdrop-blur-md border border-neutral-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-aura-ink">Bestemmingsplan</h3>
            <button
              onClick={() => setZoneInfo(null)}
              className="text-neutral-600 hover:text-aura-ink transition-colors"
              aria-label="Sluiten"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-aura-ink">{zoneInfo.info.planNaam}</p>
            <div className="inline-block px-2 py-1 bg-aura-amber/20 text-aura-amber text-xs font-medium rounded">
              {zoneInfo.info.bestemmingType}
            </div>
            {zoneInfo.info.planStatus && (
              <p className="text-xs text-neutral-600">Status: {zoneInfo.info.planStatus}</p>
            )}
            {zoneInfo.info.planLink && (
              <a
                href={zoneInfo.info.planLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-aura-amber hover:text-aura-amber-hover transition-colors"
              >
                Bekijk officieel document
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {/* Scan button — desktop only */}
            <div className="hidden md:block">
              <button
                onClick={handleScanZone}
                disabled={triggerScan.isPending || !!activeScanId}
                className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-aura-obsidian bg-aura-amber hover:bg-aura-amber-hover disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              >
                {triggerScan.isPending ? 'Scan starten...' : 'Scan dit gebied'}
              </button>
            </div>
            {/* Mobile explanation — scanning requires desktop */}
            <div className="md:hidden mt-3">
              <div className="rounded-md bg-aura-amber/10 border border-aura-amber/30 px-3 py-2 text-xs text-aura-amber">
                Gebruik desktop voor scannen
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier 1: QuickCard — MapLibre popup anchored to property */}
      {tier === 'quick' && (
        <PropertyQuickCard
          data={lookup.data ?? null}
          isLoading={lookup.isPending}
          onOpenDetails={handleOpenQuickDetails}
          isOpeningDetails={lookup.isPending || isQuickOpeningDetails}
          onClose={handleCloseQuickCard}
          mapRef={mapRef}
          lngLat={propertyLngLat}
        />
      )}

      {/* Overlay color mode legend — bottom-right */}
      <OverlayLegend
        activeOverlay={layerState.activeParcelOverlay}
        visible={layerState.showParcels && !!activeScanId}
      />

      {/* Overlay picker — bottom-right, only when parcels active */}
      {layerState.showParcels && (
        <OverlayPicker
          activeOverlay={layerState.activeParcelOverlay}
          onSelect={handleOverlaySelect}
        />
      )}

      {/* Map detail panels — only one visible at a time */}
      {activePanel?.kind === 'gemeente' && (
        <GemeenteContextPanel
          naam={activePanel.naam}
          code={activePanel.code}
          wijkGeojson={wijkGeojson}
          scans={scanHistory?.scans ?? []}
          onClose={handleCloseGemeentePanel}
          onSelectWijk={handleGemeentePanelSelectWijk}
        />
      )}
      {activePanel?.kind === 'wijk' && (
        <WijkMapPanel
          naam={activePanel.naam}
          gemeenteNaam={activePanel.gemeenteNaam}
          latestScan={activePanel.latestScan}
          onClose={() => setActivePanel(null)}
          onBack={handleWijkPanelBack}
          onStartScan={handleWijkPanelStartScan}
          onViewResults={(scanId) => navigate({ to: '/resultaten', search: { scan_id: scanId } })}
        />
      )}
      <AnimatePresence>
        {activePanel?.kind === 'parcel' && inspectorParcel && (
          <ParcelDetailPanel
            key="parcel-panel"
            parcel={inspectorParcel}
            gemeenteNaam={activePanel?.kind === 'parcel' && activePanel.gemeenteNaam ? activePanel.gemeenteNaam : activeGemeente?.naam}
            wijkNaam={activePanel?.kind === 'parcel' && activePanel.wijkNaam ? activePanel.wijkNaam : urlWijkNaam}
            onClose={handleCloseParcelPanel}
          />
        )}
      </AnimatePresence>

      {/* Wijk scan confirmation dialog */}
      <Modal isOpen={!!pendingScan} onClose={handleCancelScan} size="sm">
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-aura-amber/15">
            <svg className="h-6 w-6 text-aura-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-aura-ink mb-2">
            Wijk scannen?
          </h3>
          <p className="text-sm text-neutral-600 mb-6">
            Wil je <span className="font-medium text-neutral-700">{pendingScan?.wijkNaam}</span> scannen op bouwmogelijkheden?
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="ghost" size="lg" onClick={handleCancelScan}>
              Annuleren
            </Button>
            <Button variant="primary" size="lg" onClick={handleConfirmScan}>
              Scannen
            </Button>
          </div>
        </div>
      </Modal>
    </MapShell>
  )
}
