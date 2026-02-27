import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/primitives/Button'
import MapShell from '@/components/layout/MapShell'
import LayerToggle from '@/components/map/LayerToggle'
import { AddressSearch } from '@/components/search/AddressSearch'
import { PropertyQuickCard } from '@/components/property/PropertyQuickCard'
import { ParcelDetailModal } from '@/components/results/ParcelDetailModal'
import { usePropertyLookup } from '@/hooks/usePropertyLookup'
import { useRecentViewed } from '@/hooks/useRecentViewed'
import { useReport } from '@/hooks/useReports'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { updatePropertyGeometry, clearPropertyGeometry } from '@/components/map/PropertyGeometryLayer'
import {
  addGemeenteBoundariesLayer,
  setGemeenteBoundariesVisibility,
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
  addParcelScoreLayer,
  updateParcelScoreSource,
  PARCEL_SCORE_FILL_LAYER_ID,
  PARCEL_BUILT_STATUS_FILL_LAYER_ID,
  PARCEL_REPORT_STATUS_FILL_LAYER_ID,
  PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID,
  PARCEL_BUILD_CAPACITY_FILL_LAYER_ID,
  setParcelBuiltStatusVisibility,
  setParcelBuildCapacityVisibility,
  setParcelVacancySignalVisibility,
  setParcelReportStatusVisibility,
  setParcelScoreVisibility,
} from '@/components/map/ParcelScoreLayer'
import {
  addMonitoredWijkOverlay,
  removeMonitoredWijkOverlay,
} from '@/components/map/MonitoredWijkOverlay'
import {
  addScannedWijkHighlight,
  removeScannedWijkHighlight,
} from '@/components/map/ScannedWijkHighlightLayer'
import { useTriggerScan, useScanPolling, useCancelScan, useScanHistory } from '@/hooks/useScans'
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
import { readPersistedMapLayerState } from '@/lib/map/layers'
import { PARCEL_INTERACTION_MIN_ZOOM } from '@/lib/map/constants'
import type { SuggestResult, PropertyReportResponse } from '@/lib/types/property'
import type { ZoneFeatureInfo } from '@/lib/types/bestemmingsplan'
import type { ScanResultItem } from '@/lib/types/scan'
import { calculateBboxFromGeometry } from '@/lib/geo-utils'
import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'

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
  const { mapRef, mapReady } = useMapContext()
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
  const [tier, setTier] = useState<ViewTier>('none')
  // demo data removed — all property data comes from lookup API
  const [propertyLngLat, setPropertyLngLat] = useState<[number, number] | null>(null)
  const [showGemeentenLayer, setShowGemeentenLayer] = useState(false)
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  const navigatedRef = useRef(false)
  const [showBestemmingsplan, setShowBestemmingsplan] = useState(false)
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

  const [wijkGeojson, setWijkGeojson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [wijkLoading, setWijkLoading] = useState(false)
  const [inspectorParcel, setInspectorParcel] = useState<ScanResultItem | null>(null)
  const [autoEnableParcelsKey, setAutoEnableParcelsKey] = useState<string | null>(null)
  const [isParcelsVisible, setIsParcelsVisible] = useState(false)
  const parcelClickRequestSeqRef = useRef(0)
  const [showScannedWijkBoundaries, setShowScannedWijkBoundaries] = useState(
    () => readPersistedMapLayerState().showScannedScope
  )
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

  // Track wijk name for inline progress display
  const [activeScanWijk, setActiveScanWijk] = useState<string | null>(null)

  // Pending scan confirmation state
  const [pendingScan, setPendingScan] = useState<{
    wijkNaam: string
    gemeente_code: string
    gemeente_naam: string
    bbox_wgs84: [number, number, number, number]
  } | null>(null)

  const shouldLoadGemeenteGeojson =
    showGemeentenLayer ||
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
  const cancelScan = useCancelScan()
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

  // Scan history for scanned wijk highlight
  const { data: scanHistory } = useScanHistory({ limit: 100 })

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

    // Avoid silently switching users to a random wijk scan when multiple scans exist.
    if (activeGemeente && gemeentePool.length === 1) {
      return gemeentePool[0] ?? null
    }

    return null
  }, [activeGemeente, scanHistory?.scans])

  const activatePreferredScan = useCallback(
    () => {
      if (!preferredCompletedScan) return false
      if (activeScanId === preferredCompletedScan.scan_id) return true
      setActiveScanId(preferredCompletedScan.scan_id)
      setActiveScanWijk(preferredCompletedScan.wijk_naam ?? null)
      return true
    },
    [activeScanId, preferredCompletedScan]
  )

  const handleParcelsLayerToggle = useCallback((visible: boolean) => {
    setIsParcelsVisible(visible)
    const map = mapRef.current
    currentMapCenterRef.current = map
      ? [map.getCenter().lng, map.getCenter().lat]
      : null
    if (visible) {
      currentCenteredWijkNameRef.current = readCenteredWijkName()
    } else {
      currentCenteredWijkNameRef.current = null
    }

    if (!visible || activeScanId) return
    activatePreferredScan()
  }, [activeScanId, activatePreferredScan, mapRef, readCenteredWijkName])

  // If parcels were enabled before scan history finished loading, auto-attach
  // the preferred completed scan as soon as it becomes available.
  useEffect(() => {
    if (!isParcelsVisible || activeScanId) return
    activatePreferredScan()
  }, [activeScanId, activatePreferredScan, isParcelsVisible])

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

    // Only show lookup geometry while quick card is active.
    // Once we switch to parcel-detail mode, geometry should come from the parcel itself.
    if (lookup.data && tier === 'quick') {
      updatePropertyGeometry(mapRef.current, lookup.data)
      return
    }

    clearPropertyGeometry(mapRef.current)
  }, [lookup.data, mapReady, parcelGeometryHighlight, mapRef, tier])

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
    bestemmingen?: Record<string, unknown>[] | null
    maxBebouwingspercentage?: number | null
    maxFloorAreaRatio?: number | null
    score?: number | null
    scoreCategory?: string | null
    scoreBreakdown?: Record<string, unknown> | null
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
      vacancy_signal: vacancySignal,
      vacancy_confidence: null,
      vacancy_reasons: null,
      vacancy_model_version: null,
      market_signals: input.marketSignals ?? null,
      opportunity_signals: input.opportunitySignals ?? null,
      building_metrics: mergedBuildingMetrics,
      has_report: input.hasReport ?? false,
    }
  }, [])

  const focusParcelWithInspector = useCallback((input: {
    parcelId: string
    lng: number
    lat: number
    address: string | null
    parcelCode?: string | null
    gemeenteCode?: string | null
    areaM2?: number | null
    hasPand?: boolean | null
    bouwjaar?: number | null
    pandStatus?: string | null
    geometry?: GeoJSON.Geometry | null
    autoEnableKey: string
  }) => {
    setTier('none')
    setParcelGeometryHighlight(null)
    setParcelGeometryHighlight(
      input.geometry
        ? {
            lng: input.lng,
            lat: input.lat,
            parcelCode: input.parcelCode ?? null,
            areaM2: input.areaM2 ?? null,
            geometry: input.geometry,
          }
        : null
    )
    setPropertyLngLat([input.lng, input.lat])
    setAutoEnableParcelsKey(input.autoEnableKey)
    setInspectorParcel(
      makeInspectorParcel({
        parcelId: input.parcelId,
        address: input.address,
        parcelCode: input.parcelCode ?? null,
        gemeenteCode: input.gemeenteCode ?? null,
        areaM2: input.areaM2 ?? null,
        hasPand: typeof input.hasPand === 'boolean' ? input.hasPand : undefined,
        bouwjaar: input.bouwjaar ?? null,
        pandStatus: input.pandStatus ?? null,
        vacancySignal: deriveVacancySignalFromPandStatus(
          input.pandStatus ?? null,
          typeof input.hasPand === 'boolean' ? input.hasPand : true
        ),
      })
    )
  }, [makeInspectorParcel])

  // For URL-driven postcode/huisnummer navigation: auto-open the same parcel detail modal
  // once we can resolve a concrete parcel_id from the lookup response.
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
      .then((resolved) => {
        const firstParcel = data.cadastral_parcels?.[0]
        const primaryBestemming = data.zoning?.primary_bestemming
        const hasPand = Boolean(data.building?.pand_id)

        setAutoEnableParcelsKey(
          `addr:${pending.postcode.replace(/\s/g, '').toUpperCase()}:${pending.huisnummer}`
        )
        setTier('none')
        setParcelGeometryHighlight(null)
        setInspectorParcel(
          makeInspectorParcel({
            parcelId: resolved.parcel_id,
            address:
              resolved.address ??
              `${data.address.straat} ${data.address.huisnummer}${data.address.huisletter ?? ''}${data.address.toevoeging ? ` ${data.address.toevoeging}` : ''}, ${data.address.postcode} ${data.address.woonplaats}`,
            parcelCode: firstParcel?.kadastrale_aanduiding ?? null,
            areaM2: firstParcel?.oppervlakte ?? data.building?.oppervlakte ?? null,
            hasPand,
            bouwjaar: data.building?.bouwjaar ?? null,
            pandStatus: data.building?.status ?? null,
            vacancySignal: deriveVacancySignalFromPandStatus(
              data.building?.status ?? null,
              hasPand
            ),
            bestemmingen: primaryBestemming
              ? [{ type: primaryBestemming, naam: primaryBestemming }]
              : null,
            maxBebouwingspercentage:
              data.zoning?.building_dimensions?.max_bebouwingspercentage ?? null,
            maxFloorAreaRatio:
              data.zoning?.building_dimensions?.max_floor_area_ratio ?? null,
          })
        )
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
      })
      .catch(() => {
        // Keep quick card fallback if parcel resolution fails.
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
      setInspectorParcel(
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
      )
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
    setInspectorParcel(null)
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
      setInspectorParcel(null)
      pendingLookupInspectorRef.current = null
      if (mapRef.current) {
        clearPropertyGeometry(mapRef.current)
      }

      fetchParcelCentroid(urlParcelId, accessToken)
        .then(({ lng, lat, address, parcel_code, gemeente_code, area_m2, has_pand, bouwjaar, pand_status, geometry }) => {
          focusParcelWithInspector({
            parcelId: urlParcelId,
            lng,
            lat,
            address: address ?? fallbackAddress ?? null,
            parcelCode: parcel_code ?? null,
            gemeenteCode: gemeente_code ?? null,
            areaM2: area_m2 ?? null,
            hasPand: has_pand ?? undefined,
            bouwjaar: bouwjaar ?? null,
            pandStatus: pand_status ?? null,
            geometry: geometry ?? null,
            autoEnableKey: `${urlParcelId}:${urlScanId}:${navTs ?? 0}`,
          })
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
  }, [urlScanId, urlParcelId, activeScanId, accessToken, navigate, navTs, fallbackAddress, focusParcelWithInspector])

  // Handle direct parcel navigation (e.g. from meldingen) without scan context
  useEffect(() => {
    if (!urlParcelId || urlScanId || !accessToken) return

    const key = `${urlParcelId}:${navTs ?? 0}`
    if (handledParcelRef.current === key) return
    handledParcelRef.current = key

    // Clear stale focus immediately so old parcel/marker never lingers while loading a new one.
    setTier('none')
    setParcelGeometryHighlight(null)
    setInspectorParcel(null)
    pendingLookupInspectorRef.current = null
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }

    fetchParcelCentroid(urlParcelId, accessToken)
      .then(({ lng, lat, address, parcel_code, gemeente_code, area_m2, has_pand, bouwjaar, pand_status, geometry }) => {
        focusParcelWithInspector({
          parcelId: urlParcelId,
          lng,
          lat,
          address: address ?? fallbackAddress ?? null,
          parcelCode: parcel_code ?? null,
          gemeenteCode: gemeente_code ?? null,
          areaM2: area_m2 ?? null,
          hasPand: has_pand ?? undefined,
          bouwjaar: bouwjaar ?? null,
          pandStatus: pand_status ?? null,
          geometry: geometry ?? null,
          autoEnableKey: key,
        })
      })
      .catch(() => {
        toast.error('Kon perceel op kaart niet centreren')
      })
      .finally(() => {
        navigate({ to: '/map', search: {}, replace: true })
      })
  }, [urlParcelId, urlScanId, navTs, accessToken, navigate, fallbackAddress, focusParcelWithInspector])

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
    setInspectorParcel(null)
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

  const ensureParcelScoreLayer = useCallback((scanId: string) => {
    const map = mapRef.current
    if (!map) return
    const tileUrl = getScanTileUrl(scanId)

    const addLayerSafe = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', addLayerSafe)
        return
      }
      try {
        if (map.getSource('parcel-scores')) {
          updateParcelScoreSource(map, tileUrl, 'parcel_scores')
        } else {
          addParcelScoreLayer(map, tileUrl, 'parcel_scores')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('Style is not done loading')) {
          map.once('styledata', addLayerSafe)
          return
        }
        throw error
      }
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

  // Restore score layer when returning to map with ?scan_id=X (no active polling for pre-existing scan)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeScanId) return
    // Safe add with style-load retry.
    ensureParcelScoreLayer(activeScanId)
  }, [activeScanId, mapReady, ensureParcelScoreLayer])

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
      const parcelModeActive = isParcelsVisible || !!activeScanIdRef.current
      const requestSeq = ++parcelClickRequestSeqRef.current
      const feature = parcelModeActive ? queryTopParcelFeature(e.point) : null
      if (feature?.properties) {
        const parcel = buildParcelFromFeatureProps(feature.properties)
        if (parcel) {
          setTier('none')
          setInspectorParcel(parcel)

          // Fetch full geometry for reliable full-parcel yellow highlight.
          if (accessToken) {
            void fetchParcelCentroid(parcel.parcel_id, accessToken)
              .then((centroid) => {
                if (requestSeq !== parcelClickRequestSeqRef.current) return
                setInspectorParcel((current) => {
                  if (!current || current.parcel_id !== parcel.parcel_id) return current
                  return {
                    ...current,
                    address: current.address ?? centroid.address ?? current.address,
                    parcel_code: centroid.parcel_code ?? current.parcel_code,
                    gemeente_code: current.gemeente_code ?? centroid.gemeente_code ?? current.gemeente_code,
                    area_m2: centroid.area_m2 ?? current.area_m2,
                    has_pand:
                      typeof centroid.has_pand === 'boolean'
                        ? centroid.has_pand
                        : current.has_pand,
                    bouwjaar: current.bouwjaar ?? centroid.bouwjaar ?? current.bouwjaar,
                    pand_status: current.pand_status ?? centroid.pand_status ?? current.pand_status,
                  }
                })
                if (centroid.geometry) {
                  setParcelGeometryHighlight({
                    lng: centroid.lng,
                    lat: centroid.lat,
                    parcelCode: centroid.parcel_code ?? parcel.parcel_code ?? null,
                    areaM2: centroid.area_m2 ?? parcel.area_m2 ?? null,
                    geometry: centroid.geometry,
                  })
                }
                setPropertyLngLat([centroid.lng, centroid.lat])
              })
              .catch(() => {
                // Keep modal data from tile props when centroid lookup fails.
              })
          }
          return
        }
      }

      // Fallback path: no scored feature under cursor.
      // Try spatial point lookup so "Percelen" mode remains clickable.
      if (!accessToken) return
      void fetchParcelAtPoint(e.lngLat.lng, e.lngLat.lat, accessToken, {
        scanId: activeScanIdRef.current,
      })
        .then((resolved) => {
          if (requestSeq !== parcelClickRequestSeqRef.current) return

          setTier('none')
          setInspectorParcel(
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
              vacancySignal:
                (resolved.vacancy_signal as ScanResultItem['vacancy_signal']) ??
                null,
              marketSignals: resolved.market_signals ?? null,
              opportunitySignals: resolved.opportunity_signals ?? null,
              buildingMetrics: resolved.building_metrics ?? null,
              hasReport: resolved.has_report,
            })
          )
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
      const parcelModeActive = isParcelsVisible || !!activeScanIdRef.current
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
  }, [accessToken, isParcelsVisible, makeInspectorParcel, mapReady, mapRef])

  // Cleanup highlight on unmount
  useEffect(() => {
    const map = mapRef.current
    return () => {
      if (map) {
        removeScanAreaHighlight(map)
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
    setInspectorParcel(null)
    pendingLookupInspectorRef.current = null
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }

    // Show QuickCard immediately (for loading state)
    setTier('quick')
    setPropertyLngLat(null)

    try {
      // PDOK suggest only returns id + weergavenaam, so look up full details
      const details = await lookupPdokAddress(suggestion.id)

      const pc = details.postcode?.replace(/\s/g, '')
      const hn = details.huisnummer

      if (!pc || !hn) {
        console.warn('Could not extract postcode/huisnummer from PDOK lookup:', details)
        setTier('none')
        return
      }

      // Extract coordinates — flyTo handled by dedicated effect
      if (details.centroide_ll) {
        const match = details.centroide_ll.match(/POINT\(([^ ]+) ([^ ]+)\)/)
        if (match) {
          setPropertyLngLat([parseFloat(match[1]!), parseFloat(match[2]!)])
        }
      }

      // Trigger property lookup mutation with demo fallback
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
            toast.error('Adres niet gevonden')
          },
        }
      )
    } catch (err) {
      console.error('PDOK address lookup failed:', err)
      setTier('none')
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

  // Wijk click handler
  const handleWijkClick = useCallback(
    (
      wijkCode: string,
      wijkNaam: string,
      bbox: [number, number, number, number],
      geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
    ) => {
      const currentGemeente = activeGemeenteRef.current
      if (!currentGemeente || !mapRef.current) return

      // Guard: prevent during active scan
      if (isScanRunning) {
        toast.info('Scan al bezig, wacht even...')
        return
      }

      // Highlight selected wijk
      removeScanAreaHighlight(mapRef.current)
      addScanAreaHighlight(mapRef.current, geometry)

      // Show confirmation dialog before scanning
      setPendingScan({
        wijkNaam,
        gemeente_code: currentGemeente.code,
        gemeente_naam: currentGemeente.naam,
        bbox_wgs84: bbox,
      })
    },
    [isScanRunning]
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
          setActiveScanWijk(wijkNaam)
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
          setActiveScanWijk(null)
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

  // Viewport scan handler
  const handleScanViewport = useCallback(() => {
    const currentGemeente = activeGemeenteRef.current
    if (!mapRef.current || !currentGemeente) {
      toast.info('Selecteer eerst een gemeente')
      return
    }

    if (isScanRunning) {
      toast.info('Scan al bezig, wacht even...')
      return
    }

    const bounds = mapRef.current.getBounds()
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ]

    // Create bbox polygon for highlight
    const bboxPolygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[
        [bbox[0], bbox[1]], [bbox[2], bbox[1]],
        [bbox[2], bbox[3]], [bbox[0], bbox[3]],
        [bbox[0], bbox[1]],
      ]],
    }

    removeScanAreaHighlight(mapRef.current)
    addScanAreaHighlight(mapRef.current, bboxPolygon)

    triggerScan.mutate(
      {
        gemeente_code: currentGemeente.code,
        gemeente_naam: currentGemeente.naam,
        bbox_wgs84: bbox,
      },
      {
        onSuccess: (data) => {
          setActiveScanId(data.scan_id)
          setActiveScanWijk('Viewport')
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
          if (data.status === 'existing' && !data.needs_rescan) {
            shouldAutoFollowScanRef.current = false
            navigate({ to: '/resultaten', search: { scan_id: data.scan_id } })
            toast.info(`Bestaande scan gevonden — resultaten laden`)
          } else {
            shouldAutoFollowScanRef.current = true
            toast.success(`Scan gestart voor ${currentGemeente.naam}`)
          }
        },
        onError: (err) => {
          toast.error(`Scan starten mislukt: ${err.message}`)
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
          setActiveScanWijk(null)
        },
      }
    )
  }, [triggerScan, isScanRunning])

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

      // Set active gemeente context and zoom
      setActiveGemeente({ code: gemeenteCode, naam: gemeenteNaam, bbox })
      mapRef.current.fitBounds(
        [bbox[0], bbox[1], bbox[2], bbox[3]] as [number, number, number, number],
        { padding: 50, duration: 800 }
      )

      // Fetch wijken from backend
      setWijkLoading(true)
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

        if (options?.showLoadedToast ?? true) {
          toast.success(`${gemeenteNaam}: ${geojson.features.length} wijken geladen`)
        }

        return geojson
      } catch (err) {
        console.error('Failed to fetch wijken:', err)
        toast.error('Kon wijken niet laden')
        setActiveGemeente(null) // Clear context on error
        return null
      } finally {
        setWijkLoading(false)
      }
    },
    [accessToken, isScanRunning]
  )

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    if (!showGemeentenLayer || !gemeenteGeojson) return

    const map = mapRef.current
    if (!map.getSource('cbs-gemeenten')) {
      addGemeenteBoundariesLayer(map, gemeenteGeojson, (gemeenteCode, gemeenteNaam, bbox, _geometry) => {
        void activateGemeenteContext(gemeenteCode, gemeenteNaam, bbox)
      })
      return
    }

    setGemeenteBoundariesVisibility(map, true)
  }, [mapReady, mapRef, showGemeentenLayer, gemeenteGeojson, activateGemeenteContext])

  // Gemeenten layer toggle handler
  const handleGemeentenToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return

      const map = mapRef.current
      setShowGemeentenLayer(visible)

      if (visible) {
        return
      }

      setGemeenteBoundariesVisibility(map, false)
      // Also clear gemeente context and wijk layer
      if (wijkGeojsonRef.current) {
        removeWijkBoundariesLayer(map)
        setWijkGeojson(null)
      }
      setActiveGemeente(null)
    },
    [mapRef]
  )

  // Handle direct gemeente/wijk navigation from projects flow.
  // Deep-link example: /map?gemeente_code=GM0983&wijk_naam=Wijk%2044%20Arcen
  useEffect(() => {
    if (!urlGemeenteCode || !mapReady || !mapRef.current) return
    if (urlParcelId || urlScanId || reportId) return

    const navKey = `${normalizeGemeenteCode(urlGemeenteCode)}:${normalizeAreaName(urlWijkNaam ?? '')}:${navTs ?? 0}`
    if (handledGemeenteWijkRef.current === navKey) return
    setShowGemeentenLayer(true)
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
            { padding: 70, duration: 900 }
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
  ])

  // Bestemmingsplan layer toggle handler
  const handleBestemmingsplanToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return

      const map = mapRef.current

      if (visible) {
        // Add source if it doesn't exist
        if (!map.getSource('pdok-bestemmingsplan')) {
          addBestemmingsplanLayer(map)
        }
        // Show layer
        setBestemmingsplanVisibility(map, true)
        setShowBestemmingsplan(true)
      } else {
        // Hide layer
        setBestemmingsplanVisibility(map, false)
        setShowBestemmingsplan(false)
        setZoneInfo(null)
      }
    },
    []
  )

  // Wijken layer toggle handler
  const handleWijkenToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setWijkBoundariesVisibility(mapRef.current, visible)
    },
    []
  )

  // Score layer visibility toggle handler
  const handleScoreToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelScoreVisibility(mapRef.current, visible)
    },
    []
  )

  const handleBuiltStatusToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelBuiltStatusVisibility(mapRef.current, visible)
    },
    []
  )

  const handleReportStatusToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelReportStatusVisibility(mapRef.current, visible)
    },
    []
  )

  const handleVacancySignalToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelVacancySignalVisibility(mapRef.current, visible)
    },
    []
  )

  const handleBuildCapacityToggle = useCallback(
    (visible: boolean) => {
      if (!mapRef.current) return
      setParcelBuildCapacityVisibility(mapRef.current, visible)
    },
    []
  )

  const handleScannedScopeToggle = useCallback((visible: boolean) => {
    setShowScannedWijkBoundaries(visible)
  }, [])

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

  return (
    <MapShell>
      <AddressSearch onSelect={handleAddressSelect} />

      {/* Active gemeente context header */}
      {activeGemeente && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[var(--z-map-controls)] bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md border border-grey-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-accent"></div>
            <span className="text-sm font-medium text-grey-100">
              {activeGemeente.naam}
            </span>
            {/* Read-only label — mobile only, since scan buttons are hidden */}
            <span className="text-xs text-grey-400 md:hidden">(alleen lezen)</span>
          </div>
          {wijkLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-accent"></div>
          )}

          {/* Inline scan progress — replaces buttons when scan is running */}
          {activeScanId && scanStatus.data && scanStatus.data.status === 'running' ? (
            <div className="hidden md:flex items-center gap-3">
              <div className="border-l border-grey-700 h-5" />
              <span className="text-xs font-medium text-grey-100">
                {scanStatus.data.current_phase === null
                  ? 'Starten...'
                  : activeScanWijk ?? 'Scannen'}
              </span>
              <div className="bg-grey-800 rounded-full h-1.5 w-24 overflow-hidden">
                <div
                  className="bg-amber-accent h-full transition-all duration-500 ease-out"
                  style={{ width: `${scanStatus.data.progress_pct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-amber-accent tabular-nums">
                {Math.round(scanStatus.data.progress_pct)}%
              </span>
              <button
                onClick={() => cancelScan.mutate(activeScanId)}
                disabled={cancelScan.isPending}
                className="text-xs text-grey-400 hover:text-grey-100 disabled:opacity-50 font-medium transition-colors"
              >
                {cancelScan.isPending ? 'Annuleren...' : 'Annuleren'}
              </button>
            </div>
          ) : (
            <>
              {/* Viewport scan button — desktop only (scanning is not supported on mobile) */}
              <span className="hidden md:inline-flex">
                <button
                  onClick={handleScanViewport}
                  disabled={!!activeScanId || triggerScan.isPending}
                  className="px-3 py-1 text-xs font-medium text-on-accent bg-amber-accent hover:bg-amber-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {triggerScan.isPending ? 'Scannen...' : 'Scan zichtbaar gebied'}
                </button>
              </span>
              {/* Toon Lijst button — desktop only, visible when a scan is active */}
              {activeScanId && (
                <span className="hidden md:inline-flex">
                  <button
                    onClick={() => navigate({ to: '/resultaten', search: { scan_id: activeScanId } })}
                    className="px-3 py-1 text-xs font-medium text-amber-accent border border-amber-accent/50 hover:bg-amber-accent/10 rounded transition-colors"
                  >
                    Toon Lijst
                  </button>
                </span>
              )}
            </>
          )}

          <button
            onClick={() => {
              setActiveGemeente(null)
              if (wijkGeojsonRef.current && mapRef.current) {
                removeWijkBoundariesLayer(mapRef.current)
                setWijkGeojson(null)
              }
              if (mapRef.current) {
                mapRef.current.flyTo({ center: NL_CENTER, zoom: NL_ZOOM, duration: 1000 })
              }
            }}
            className="text-grey-400 hover:text-grey-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Gemeente deselecteren"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Scan progress is now inline in the gemeente header bar above */}

      {/* Bestemmingsplan legend */}
      <BestemmingsplanLegend visible={showBestemmingsplan} />

      {/* Zone info card */}
      {zoneLoading && (
        <div className="absolute bottom-20 left-4 bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md border border-grey-800 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-accent"></div>
            <p className="text-sm text-grey-400">Zone info laden...</p>
          </div>
        </div>
      )}
      {zoneInfo && !zoneLoading && (
        <div className="absolute bottom-20 left-4 bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md border border-grey-800 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-grey-100">Bestemmingsplan</h3>
            <button
              onClick={() => setZoneInfo(null)}
              className="text-grey-400 hover:text-grey-100 transition-colors"
              aria-label="Sluiten"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-grey-100">{zoneInfo.info.planNaam}</p>
            <div className="inline-block px-2 py-1 bg-amber-accent/20 text-amber-accent text-xs font-medium rounded">
              {zoneInfo.info.bestemmingType}
            </div>
            {zoneInfo.info.planStatus && (
              <p className="text-xs text-grey-400">Status: {zoneInfo.info.planStatus}</p>
            )}
            {zoneInfo.info.planLink && (
              <a
                href={zoneInfo.info.planLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber-accent hover:text-amber-accent-hover transition-colors"
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
                className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-on-accent bg-amber-accent hover:bg-amber-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              >
                {triggerScan.isPending ? 'Scan starten...' : 'Scan dit gebied'}
              </button>
            </div>
            {/* Mobile explanation — scanning requires desktop */}
            <div className="md:hidden mt-3">
              <div className="rounded-md bg-amber-accent/10 border border-amber-accent/30 px-3 py-2 text-xs text-amber-accent">
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

      <LayerToggle
        mapRef={mapRef}
        mapReady={mapReady}
        autoEnableParcelsKey={autoEnableParcelsKey}
        onParcelsToggle={handleParcelsLayerToggle}
        onGemeentenToggle={handleGemeentenToggle}
        onBestemmingsplanToggle={handleBestemmingsplanToggle}
        onWijkenToggle={handleWijkenToggle}
        showWijkenToggle={!!activeGemeente}
        onScannedScopeToggle={handleScannedScopeToggle}
        showScannedScopeToggle={!!activeGemeente}
        onScoreToggle={handleScoreToggle}
        showScoreToggle={false}
        onBuiltStatusToggle={handleBuiltStatusToggle}
        showBuiltStatusToggle={false}
        onReportStatusToggle={handleReportStatusToggle}
        showReportStatusToggle={false}
        onVacancySignalToggle={handleVacancySignalToggle}
        showVacancySignalToggle={false}
        onBuildCapacityToggle={handleBuildCapacityToggle}
        showBuildCapacityToggle={false}
      />

      {/* Parcel details modal — same component as scan results row click */}
      <ParcelDetailModal
        parcel={inspectorParcel}
        isOpen={!!inspectorParcel}
        onClose={() => setInspectorParcel(null)}
        onViewOnMap={undefined}
        presentation="map-panel"
      />

      {/* Wijk scan confirmation dialog */}
      <Modal isOpen={!!pendingScan} onClose={handleCancelScan} size="sm">
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-accent/15">
            <svg className="h-6 w-6 text-amber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-grey-100 mb-2">
            Wijk scannen?
          </h3>
          <p className="text-sm text-grey-400 mb-6">
            Wil je <span className="font-medium text-grey-300">{pendingScan?.wijkNaam}</span> scannen op bouwmogelijkheden?
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
