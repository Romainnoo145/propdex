import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/primitives/Button'
import MapShell from '@/components/layout/MapShell'
import { InspectorPanel } from '@/components/layout/InspectorPanel'
import LayerToggle from '@/components/map/LayerToggle'
import { AddressSearch } from '@/components/search/AddressSearch'
import { PropertyQuickCard } from '@/components/property/PropertyQuickCard'
import { PropertyDetailDrawer } from '@/components/property/PropertyDetailDrawer'
import { PDFExportModal } from '@/components/reports/PDFExportModal'
import { useSaveReportFlow } from '@/components/reports/SaveReportFlow'
import { usePropertyLookup } from '@/hooks/usePropertyLookup'
import { useRecentViewed } from '@/hooks/useRecentViewed'
import { useReport } from '@/hooks/useReports'
import { updatePropertyGeometry, clearPropertyGeometry } from '@/components/map/PropertyGeometryLayer'
import {
  fetchGemeenteGeoJSON,
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
import { addParcelScoreLayer, setParcelScoreVisibility } from '@/components/map/ParcelScoreLayer'
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
  resolveParcelByAddress,
  generateReportFromParcel,
  generateReportFromAddress,
} from '@/lib/api'
import { NL_CENTER, NL_ZOOM } from '@/lib/pdok'
import { useMapContext } from '@/lib/MapContext'
import type { SuggestResult, PropertyReportResponse, AddressInput } from '@/lib/types/property'
import type { ZoneFeatureInfo } from '@/lib/types/bestemmingsplan'
import type { ScanResultItem } from '@/lib/types/scan'

interface MapSearchParams {
  postcode?: string
  huisnummer?: number
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
    reportId: typeof search.reportId === 'string' ? search.reportId : undefined,
    panel: search.panel === 'results' ? 'results' : undefined,
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
    parcel_id: typeof search.parcel_id === 'string' ? search.parcel_id : undefined,
    gemeente_code: typeof search.gemeente_code === 'string' ? search.gemeente_code : undefined,
    wijk_naam: typeof search.wijk_naam === 'string' ? search.wijk_naam : undefined,
    _t: typeof search._t === 'number' ? search._t : undefined,
  }),
})

type ViewTier = 'none' | 'quick' | 'drawer' | 'modal'

function parseAddressForReport(address: string | null): {
  postcode: string
  huisnummer: number
} | null {
  if (!address) return null

  const postcodeMatch = address.toUpperCase().match(/\b(\d{4})\s*([A-Z]{2})\b/)
  const huisnummerMatch = (address.split(',')[0] ?? address).match(/\b(\d+)\b/)
  if (!postcodeMatch || !huisnummerMatch) return null

  const huisnummer = Number.parseInt(huisnummerMatch[1]!, 10)
  if (!Number.isFinite(huisnummer) || huisnummer <= 0) return null

  return {
    postcode: `${postcodeMatch[1]} ${postcodeMatch[2]}`,
    huisnummer,
  }
}

function MapPage() {
  // MapView is now in the parent layout — get mapRef/mapReady from context
  const { mapRef, mapReady } = useMapContext()
  const navigate = useNavigate()
  const {
    postcode,
    huisnummer,
    reportId,
    scan_id: urlScanId,
    parcel_id: urlParcelId,
    _t: navTs,
  } = Route.useSearch()
  const { accessToken } = useAuth()
  const [tier, setTier] = useState<ViewTier>('none')
  // demo data removed — all property data comes from lookup API
  const [propertyLngLat, setPropertyLngLat] = useState<[number, number] | null>(null)
  const [gemeenteGeojson, setGemeenteGeojson] = useState<GeoJSON.FeatureCollection | null>(null)
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
  const [focusedParcel, setFocusedParcel] = useState<{
    parcelId: string | null
    lng: number
    lat: number
    address: string | null
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

  // Reset navigatedRef when activeScanId changes (new scan = fresh navigation guard)
  useEffect(() => {
    navigatedRef.current = false
  }, [activeScanId])

  // Shared navigation handler for CTA button and completion useEffect
  const handleViewResults = useCallback(() => {
    if (navigatedRef.current || !activeScanId) return
    navigatedRef.current = true
    navigate({ to: '/resultaten', search: { scan_id: activeScanId } })
  }, [activeScanId, navigate])

  // Fetch saved report if reportId provided
  const savedReport = useReport(reportId || null)

  // Save/export flow
  const currentData = lookup.data ?? null
  const saveFlow = useSaveReportFlow(currentData)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)

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

  // Fly to property whenever coordinates are set and map is ready
  useEffect(() => {
    if (!propertyLngLat || !mapReady || !mapRef.current) return
    mapRef.current.flyTo({ center: propertyLngLat, zoom: 17 })
  }, [propertyLngLat, mapReady])

  // Update geometry whenever data changes and map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const data = lookup.data ?? null
    if (data) {
      updatePropertyGeometry(mapRef.current, data)
    }
  }, [lookup.data, mapReady])

  // Track whether we've already handled the current search params
  const handledSearchRef = useRef<string | null>(null)
  const handledParcelRef = useRef<string | null>(null)
  const handledScanFocusRef = useRef<string | null>(null)
  const handledReportRef = useRef<string | null>(null)
  const focusedMarkerRef = useRef<maplibregl.Marker | null>(null)
  const focusedPopupRef = useRef<maplibregl.Popup | null>(null)

  // Handle saved report loading (from sidebar report selection)
  useEffect(() => {
    if (!reportId || !savedReport.data) return

    // Prevent re-triggering for the same report
    if (handledReportRef.current === reportId) return
    handledReportRef.current = reportId

    // Extract PropertyReportResponse from saved report's report_data
    const propertyData = savedReport.data.report_data as unknown as PropertyReportResponse

    setSavedReportId(reportId)
    setTier('drawer')
    setFocusedParcel(null)

    // Set coordinates — flyTo handled by dedicated effect
    const coords = propertyData.map_data?.center_wgs84
    if (coords && coords.length === 2) {
      setPropertyLngLat([coords[0]!, coords[1]!])
    }

    const resolveFocus = async () => {
      if (!accessToken) return
      const addr = propertyData.address
      if (!addr?.straat || !addr?.huisnummer) return
      const fallbackAddress = [addr.straat, String(addr.huisnummer), addr.postcode, addr.woonplaats]
        .filter(Boolean)
        .join(' ')
        .trim()

      try {
        const resolved = await resolveParcelByAddress(
          {
            street: addr.straat,
            huisnummer: addr.huisnummer,
            postcode: addr.postcode,
          },
          accessToken
        )
        setFocusedParcel({
          parcelId: resolved.parcel_id,
          lng: resolved.lng,
          lat: resolved.lat,
          address: resolved.address,
        })
        setAutoEnableParcelsKey(`report:${reportId}:${navTs ?? 0}`)
      } catch {
        // Fallback: still render a marker at known report center when parcel resolve fails.
        if (coords && coords.length === 2) {
          setFocusedParcel({
            parcelId: null,
            lng: coords[0]!,
            lat: coords[1]!,
            address: fallbackAddress || null,
          })
        }
      }
    }

    void resolveFocus().finally(() => {
      // Clear reportId from URL so it doesn't re-trigger
      navigate({ to: '/map', search: {}, replace: true })
    })
  }, [reportId, savedReport.data, accessToken, navigate, navTs])

  // Always center map on the focused marker target.
  useEffect(() => {
    if (!focusedParcel || !mapReady || !mapRef.current) return
    mapRef.current.flyTo({
      center: [focusedParcel.lng, focusedParcel.lat],
      zoom: 17,
      duration: 700,
    })
  }, [focusedParcel, mapReady])

  // Restore scan context when returning from /resultaten with ?scan_id=...
  // When parcel_id is present, wait for auth token before fetching centroid.
  useEffect(() => {
    if (!urlScanId) return
    if (!activeScanId) {
      setActiveScanId(urlScanId)
    }

    const focusKey = `${urlScanId}:${urlParcelId ?? ''}:${navTs ?? 0}`
    if (handledScanFocusRef.current === focusKey) return

    // parcel focus requires auth; keep URL intact until token is available.
    if (urlParcelId && !accessToken) return

    handledScanFocusRef.current = focusKey

    if (urlParcelId && accessToken) {
      fetchParcelCentroid(urlParcelId, accessToken)
        .then(({ lng, lat, address }) => {
          setPropertyLngLat([lng, lat])
          setFocusedParcel({ parcelId: urlParcelId, lng, lat, address })
          setAutoEnableParcelsKey(`${urlParcelId}:${urlScanId}:${navTs ?? 0}`)
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
  }, [urlScanId, urlParcelId, activeScanId, accessToken, navigate, navTs])

  // Handle direct parcel navigation (e.g. from meldingen) without scan context
  useEffect(() => {
    if (!urlParcelId || urlScanId || !accessToken) return

    const key = `${urlParcelId}:${navTs ?? 0}`
    if (handledParcelRef.current === key) return
    handledParcelRef.current = key

    fetchParcelCentroid(urlParcelId, accessToken)
      .then(({ lng, lat, address }) => {
        setPropertyLngLat([lng, lat])
        setFocusedParcel({ parcelId: urlParcelId, lng, lat, address })
        setAutoEnableParcelsKey(key)
      })
      .catch(() => {
        toast.error('Kon perceel op kaart niet centreren')
      })
      .finally(() => {
        navigate({ to: '/map', search: {}, replace: true })
      })
  }, [urlParcelId, urlScanId, navTs, accessToken, navigate])

  // Render amber marker for parcel-focused navigation and attach popup CTA.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !focusedParcel) return
    const map = mapRef.current

    focusedPopupRef.current?.remove()
    focusedPopupRef.current = null
    focusedMarkerRef.current?.remove()
    focusedMarkerRef.current = null

    const markerEl = document.createElement('button')
    markerEl.type = 'button'
    markerEl.className = 'bg-transparent border-0 p-0 cursor-pointer'
    markerEl.title = 'Geselecteerd perceel'
    markerEl.setAttribute('aria-label', 'Geselecteerd perceel')
    markerEl.innerHTML = `
      <svg width="30" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 22s8-7.2 8-13a8 8 0 1 0-16 0c0 5.8 8 13 8 13z" fill="#F59E0B" stroke="#FFFFFF" stroke-width="1.6"/>
        <circle cx="12" cy="9" r="3.2" fill="#FFFFFF"/>
      </svg>
    `

    const marker = new maplibregl.Marker({
      element: markerEl,
      anchor: 'bottom',
    })
      .setLngLat([focusedParcel.lng, focusedParcel.lat])
      .addTo(map)

    let popup: maplibregl.Popup | null = null
    let cta: HTMLButtonElement | null = null
    let handleGenerate: (() => Promise<void>) | null = null
    let openPopup: (() => void) | null = null
    const parsedAddress = parseAddressForReport(focusedParcel.address)
    const hasGenerateCta = Boolean(
      accessToken && (focusedParcel.parcelId || parsedAddress)
    )

    if (hasGenerateCta) {
      const popupRoot = document.createElement('div')
      popupRoot.className = 'min-w-[120px]'

      cta = document.createElement('button')
      cta.type = 'button'
      cta.className =
        'w-full rounded-md border border-grey-700 bg-grey-900 px-2.5 py-1.5 text-[11px] font-medium text-amber-accent transition-colors hover:bg-grey-850'
      cta.textContent = 'Genereer rapport'
      popupRoot.appendChild(cta)

      let isGenerating = false
      const setGenerating = (busy: boolean) => {
        isGenerating = busy
        if (!cta) return
        cta.disabled = busy
        cta.textContent = busy ? 'Bezig met genereren...' : 'Genereer rapport'
        cta.classList.toggle('opacity-60', busy)
        cta.classList.toggle('cursor-not-allowed', busy)
      }

      handleGenerate = async () => {
        if (isGenerating || !accessToken) return
        setGenerating(true)
        try {
          let report
          if (focusedParcel.parcelId) {
            try {
              report = await generateReportFromParcel(
                focusedParcel.parcelId,
                accessToken
              )
            } catch (error) {
              if (!parsedAddress) throw error
              report = await generateReportFromAddress(
                {
                  postcode: parsedAddress.postcode,
                  huisnummer: parsedAddress.huisnummer,
                },
                accessToken
              )
            }
          } else if (parsedAddress) {
            report = await generateReportFromAddress(
              {
                postcode: parsedAddress.postcode,
                huisnummer: parsedAddress.huisnummer,
              },
              accessToken
            )
          } else {
            return
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['reports'] }),
            queryClient.invalidateQueries({ queryKey: ['projects'] }),
          ])
          toast.success('Rapport gegenereerd')
          navigate({ to: '/rapport/$id', params: { id: String(report.id) } })
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Rapport genereren mislukt'
          )
        } finally {
          setGenerating(false)
        }
      }
      cta.addEventListener('click', handleGenerate)

      popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 16,
        className: 'focused-parcel-popup',
      }).setDOMContent(popupRoot)

      openPopup = () => {
        if (!popup) return
        popup.setLngLat([focusedParcel.lng, focusedParcel.lat]).addTo(map)
      }
      markerEl.addEventListener('click', openPopup)
    }

    focusedMarkerRef.current = marker
    focusedPopupRef.current = popup

    return () => {
      if (cta && handleGenerate) cta.removeEventListener('click', handleGenerate)
      if (openPopup) markerEl.removeEventListener('click', openPopup)
      popup?.remove()
      marker.remove()
    }
  }, [mapReady, mapRef, focusedParcel, accessToken, navigate])

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

    setTier('quick')
    setPropertyLngLat(null)

    lookup.mutate(
      { postcode: pc, huisnummer: hn },
      {
        onSuccess: (data) => {
          const coords = data.map_data?.center_wgs84
          if (coords && coords.length === 2) {
            setPropertyLngLat([coords[0]!, coords[1]!])
          }
        },
        onError: () => {
          toast.error('Adres niet gevonden')
        },
      }
    )
  }, [postcode, huisnummer, navTs, lookup, navigate])

  // Show score layer when scan completes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !scanStatus.data) return

    if (scanStatus.data.status === 'completed' && activeScanId) {
      // Add score overlay tiles from backend proxy
      const tileUrl = getScanTileUrl(activeScanId)
      addParcelScoreLayer(mapRef.current, tileUrl, 'parcel_scores')
    }
  }, [scanStatus.data, activeScanId, mapReady])

  // Restore score layer when returning to map with ?scan_id=X (no active polling for pre-existing scan)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeScanId) return
    // addParcelScoreLayer has internal guard (getSource check) -- safe to call if layer already exists
    const tileUrl = getScanTileUrl(activeScanId)
    addParcelScoreLayer(mapRef.current, tileUrl, 'parcel_scores')
  }, [activeScanId, mapReady])

  // Handle scan completion and failure
  useEffect(() => {
    if (!scanStatus.data) return
    if (scanStatus.data.status === 'completed') {
      toast.success(`Scan voltooid: ${scanStatus.data.results_count} percelen gevonden`)
      // Invalidate stale results cache so fresh data is fetched
      queryClient.invalidateQueries({ queryKey: ['scan-results', activeScanId] })
      // Navigate via shared handler (prevents double-navigation with CTA button)
      handleViewResults()
    } else if (scanStatus.data.status === 'failed') {
      toast.error('Scan mislukt')
      setActiveScanId(null) // Clear scan
    }
  }, [scanStatus.data?.status])

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

  // Open inspector when a scored parcel is clicked on the map.
  // Register once map is ready — MapLibre silently ignores clicks on layers that
  // don't exist yet, so we don't need to guard against missing source/layer here.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const handleParcelClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature?.properties) return

      const props = feature.properties
      const parcel: ScanResultItem = {
        parcel_id: (props.parcel_id as string) ?? '',
        parcel_code: (props.parcel_code as string) ?? '',
        address: (props.address as string | null) ?? null,
        gemeente_code: (props.gemeente_code as string | null) ?? null,
        area_m2: (props.area_m2 as number | null) ?? null,
        has_pand: Boolean(props.has_pand),
        bouwjaar: (props.bouwjaar as number | null) ?? null,
        pand_status: (props.pand_status as string | null) ?? null,
        bestemmingen: null,
        score: (props.score as number | null) ?? null,
        score_category: (props.score_category as string | null) ?? null,
        score_breakdown: null,
      }
      setInspectorParcel(parcel)
    }

    map.on('click', 'parcel-score-fill', handleParcelClick)
    return () => {
      map.off('click', 'parcel-score-fill', handleParcelClick)
    }
  }, [mapReady])

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
    if (!mapReady || !mapRef.current || !wijkGeojson || scannedWijkNames.length === 0) return
    addScannedWijkHighlight(mapRef.current, wijkGeojson, scannedWijkNames)
    return () => {
      if (mapRef.current) removeScannedWijkHighlight(mapRef.current)
    }
  }, [mapReady, wijkGeojson, scannedWijkNames])

  // Handle address selection from search
  const handleAddressSelect = useCallback(async (suggestion: SuggestResult) => {
    setFocusedParcel(null)

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
    setFocusedParcel(null)
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }
  }, [])

  // Handle Drawer close (back to QuickCard, keep geometry)
  const handleCloseDrawer = useCallback(() => {
    setTier('quick')
  }, [])

  // Save handler
  const handleSave = useCallback(async () => {
    const reportId = await saveFlow.handleSave()
    if (reportId) {
      setSavedReportId(reportId)
    }
  }, [saveFlow])

  // Export handler - opens modal
  const handleExportPDF = useCallback(() => {
    setTier('modal')
  }, [])

  // Close modal handler
  const handleCloseModal = useCallback(() => {
    setTier('drawer')
  }, [])

  // Force refresh handler
  const handleForceRefresh = useCallback(() => {
    if (!currentData?.address) return
    const input: AddressInput = {
      postcode: currentData.address.postcode,
      huisnummer: currentData.address.huisnummer,
      huisletter: currentData.address.huisletter || undefined,
      toevoeging: currentData.address.toevoeging || undefined,
    }
    lookup.mutate(
      { ...input, forceRefresh: true },
      {
        onSuccess: () => toast.success('Gegevens bijgewerkt met laatste bronnen'),
        onError: (err: Error) => toast.error(err.message),
      }
    )
  }, [currentData, lookup])

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
      if (activeScanIdRef.current) {
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
    []
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
            navigate({ to: '/resultaten', search: { scan_id: data.scan_id } })
            toast.info(`Bestaande scan gevonden — resultaten laden`)
          } else {
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

    if (activeScanIdRef.current) {
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
            navigate({ to: '/resultaten', search: { scan_id: data.scan_id } })
            toast.info(`Bestaande scan gevonden — resultaten laden`)
          } else {
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
  }, [triggerScan])

  // Gemeenten layer toggle handler
  const handleGemeentenToggle = useCallback(
    async (visible: boolean) => {
    if (!mapRef.current) return

    const map = mapRef.current

    if (visible) {
      // Fetch GeoJSON if not cached
      if (!gemeenteGeojson) {
        try {
          const geojson = await fetchGemeenteGeoJSON()
          setGemeenteGeojson(geojson)

          // Add layer with click handler
          addGemeenteBoundariesLayer(map, geojson, async (gemeenteCode, gemeenteNaam, bbox, _geometry) => {
            // Guard: prevent selection during active scan
            if (activeScanIdRef.current) {
              toast.info('Scan al bezig, wacht even...')
              return
            }

            // If clicking same gemeente, do nothing
            if (activeGemeenteRef.current?.code === gemeenteCode) return

            // Clear previous wijk layer if switching gemeente
            if (wijkGeojsonRef.current && mapRef.current) {
              removeWijkBoundariesLayer(mapRef.current)
              setWijkGeojson(null)
            }

            // Remove any existing scan area highlight
            removeScanAreaHighlight(map)
            setSelectedArea(null)

            // Set active gemeente context
            setActiveGemeente({ code: gemeenteCode, naam: gemeenteNaam, bbox })

            // Zoom into gemeente
            map.fitBounds(
              [bbox[0], bbox[1], bbox[2], bbox[3]] as [number, number, number, number],
              { padding: 50, duration: 800 }
            )

            // Fetch wijken from backend
            setWijkLoading(true)
            try {
              const geojson = await fetchWijken(gemeenteCode, accessToken)
              setWijkGeojson(geojson)

              // Add wijk layer to map with click handler
              if (mapRef.current) {
                addWijkBoundariesLayer(mapRef.current, geojson, (code, naam, bbox, geometry) => {
                  handleWijkClickRef.current(code, naam, bbox, geometry)
                })
              }

              toast.success(`${gemeenteNaam}: ${geojson.features.length} wijken geladen`)
            } catch (err) {
              console.error('Failed to fetch wijken:', err)
              toast.error('Kon wijken niet laden')
              setActiveGemeente(null) // Clear context on error
            } finally {
              setWijkLoading(false)
            }
          })
        } catch (err) {
          console.error('Failed to fetch gemeente boundaries:', err)
          toast.error('Kon gemeentegrenzen niet laden')
        }
      } else {
        // Layer already exists, just show it
        setGemeenteBoundariesVisibility(map, true)
      }
    } else {
      // Hide layer
      setGemeenteBoundariesVisibility(map, false)
      // Also clear gemeente context and wijk layer
      if (wijkGeojsonRef.current && map) {
        removeWijkBoundariesLayer(map)
        setWijkGeojson(null)
      }
      setActiveGemeente(null)
    }
    },
    [gemeenteGeojson, accessToken]
  )

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

  // Handle "Scan dit gebied" from bestemmingsplan zone
  const handleScanZone = useCallback(() => {
    if (!mapRef.current || !zoneInfo) return

    // Guard: prevent scan during active scan
    if (triggerScan.isPending || activeScanId) {
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
  }, [zoneInfo, triggerScan, activeScanId])

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
          onViewDetails={() => setTier('drawer')}
          onClose={handleCloseQuickCard}
          mapRef={mapRef}
          lngLat={propertyLngLat}
        />
      )}

      {/* Tier 2: Drawer */}
      {(tier === 'drawer' || tier === 'modal') && (
        <PropertyDetailDrawer
          data={currentData}
          isLoading={lookup.isPending}
          error={lookup.error}
          onClose={handleCloseDrawer}
          onExportPDF={handleExportPDF}
          onSave={handleSave}
          isSaving={saveFlow.isSaving}
          isSaved={!!savedReportId}
          onRefreshAll={handleForceRefresh}
          isRefreshing={lookup.isPending}
        />
      )}

      {/* Tier 3: PDF Export Modal */}
      {tier === 'modal' && (
        <PDFExportModal
          reportId={savedReportId}
          propertyData={currentData}
          isOpen={tier === 'modal'}
          onClose={handleCloseModal}
          onSaveFirst={handleSave}
        />
      )}

      <LayerToggle
        mapRef={mapRef}
        autoEnableParcelsKey={autoEnableParcelsKey}
        onGemeentenToggle={handleGemeentenToggle}
        onBestemmingsplanToggle={handleBestemmingsplanToggle}
        onWijkenToggle={handleWijkenToggle}
        showWijkenToggle={!!activeGemeente}
        onScoreToggle={handleScoreToggle}
        showScoreToggle={!!activeScanId}
      />

      {/* Inspector panel — right-edge slide-over for parcel details */}
      <InspectorPanel
        isOpen={!!inspectorParcel}
        onClose={() => setInspectorParcel(null)}
        parcel={inspectorParcel}
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
