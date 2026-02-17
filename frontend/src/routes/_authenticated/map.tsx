import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, useCallback, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { toast } from 'sonner'
import AppLayout from '@/components/layout/AppLayout'
import ResultsLayout from '@/components/results/ResultsLayout'
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
import { addParcelScoreLayer, removeParcelScoreLayer } from '@/components/map/ParcelScoreLayer'
import {
  addMonitoredWijkOverlay,
  removeMonitoredWijkOverlay,
} from '@/components/map/MonitoredWijkOverlay'
import { useTriggerScan, useScanPolling, useCancelScan } from '@/hooks/useScans'
import { useMonitoredProjects } from '@/hooks/useProjects'
import { useAuth } from '@/lib/auth/useAuth'
import ScanProgressOverlay from '@/components/map/ScanProgressOverlay'
import { BestemmingsplanLegend } from '@/components/map/BestemmingsplanLegend'
import { lookupPdokAddress, getScanTileUrl, fetchWijken } from '@/lib/api'
import { getDemoProperty } from '@/lib/demo-data'
import { NL_CENTER, NL_ZOOM } from '@/lib/pdok'
import { useMapContext } from '@/lib/MapContext'
import type { SuggestResult, PropertyReportResponse, AddressInput } from '@/lib/types/property'
import type { ZoneFeatureInfo } from '@/lib/types/bestemmingsplan'

interface MapSearchParams {
  postcode?: string
  huisnummer?: number
  reportId?: string
}

export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
  validateSearch: (search: Record<string, unknown>): MapSearchParams => ({
    postcode: typeof search.postcode === 'string' ? search.postcode : undefined,
    huisnummer: typeof search.huisnummer === 'number' ? search.huisnummer
      : typeof search.huisnummer === 'string' ? parseInt(search.huisnummer, 10) || undefined
      : undefined,
    reportId: typeof search.reportId === 'string' ? search.reportId : undefined,
  }),
})

type ViewTier = 'none' | 'quick' | 'drawer' | 'modal'

function MapPage() {
  // MapView is now in the parent layout — get mapRef/mapReady from context
  const { mapRef, mapReady } = useMapContext()
  const navigate = useNavigate()
  const { postcode, huisnummer, reportId } = Route.useSearch()
  const { accessToken } = useAuth()
  const [tier, setTier] = useState<ViewTier>('none')
  const [demoData, setDemoData] = useState<PropertyReportResponse | null>(null)
  const [propertyLngLat, setPropertyLngLat] = useState<[number, number] | null>(null)
  const [gemeenteGeojson, setGemeenteGeojson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
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
  const [showResults, setShowResults] = useState(false)

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

  // Fetch saved report if reportId provided
  const savedReport = useReport(reportId || null)

  // Save/export flow
  const currentData = demoData ?? lookup.data ?? null
  const saveFlow = useSaveReportFlow(currentData)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)

  // Monitored projects for wijk overlay
  const { data: monitoredProjects } = useMonitoredProjects()

  // Fly to property whenever coordinates are set and map is ready
  useEffect(() => {
    if (!propertyLngLat || !mapReady || !mapRef.current) return
    mapRef.current.flyTo({ center: propertyLngLat, zoom: 17 })
  }, [propertyLngLat, mapReady])

  // Update geometry whenever data changes and map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const data = demoData ?? lookup.data ?? null
    if (data) {
      updatePropertyGeometry(mapRef.current, data)
    }
  }, [demoData, lookup.data, mapReady])

  // Track whether we've already handled the current search params
  const handledSearchRef = useRef<string | null>(null)
  const handledReportRef = useRef<string | null>(null)

  // Handle saved report loading (from sidebar report selection)
  useEffect(() => {
    if (!reportId || !savedReport.data) return

    // Prevent re-triggering for the same report
    if (handledReportRef.current === reportId) return
    handledReportRef.current = reportId

    // Extract PropertyReportResponse from saved report's report_data
    const propertyData = savedReport.data.report_data as unknown as PropertyReportResponse

    setDemoData(propertyData)
    setSavedReportId(reportId)
    setTier('drawer')

    // Set coordinates — flyTo handled by dedicated effect
    const coords = propertyData.map_data?.center_wgs84
    if (coords && coords.length === 2) {
      setPropertyLngLat([coords[0]!, coords[1]!])
    }

    // Clear reportId from URL so it doesn't re-trigger
    navigate({ to: '/map', search: {}, replace: true })
  }, [reportId, savedReport.data, navigate])

  // Handle incoming search params (from recent viewed / report sidebar / project list)
  useEffect(() => {
    if (!postcode || !huisnummer) return

    // Use timestamp-based key to allow re-navigation to same address
    const key = `${postcode}-${huisnummer}`
    if (handledSearchRef.current === key) return
    handledSearchRef.current = key

    // Clear search params immediately so back-button doesn't re-trigger
    navigate({ to: '/map', search: {}, replace: true })

    // Capture values before async — navigate may clear them
    const pc = postcode
    const hn = huisnummer

    setTier('quick')
    setDemoData(null)
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
          const demo = getDemoProperty(pc, hn)
          if (demo) {
            setDemoData(demo)
            const coords = demo.map_data?.center_wgs84
            if (coords && coords.length === 2) {
              setPropertyLngLat([coords[0]!, coords[1]!])
            }
          }
        },
      }
    )
  }, [postcode, huisnummer, lookup, navigate])

  // Show score layer when scan completes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !scanStatus.data) return

    if (scanStatus.data.status === 'completed' && activeScanId) {
      // Add score overlay tiles from backend proxy
      const tileUrl = getScanTileUrl(activeScanId)
      addParcelScoreLayer(mapRef.current, tileUrl, 'parcel_scores')
    }
  }, [scanStatus.data, activeScanId, mapReady])

  // Handle scan completion and failure
  useEffect(() => {
    if (!scanStatus.data) return
    if (scanStatus.data.status === 'completed') {
      toast.success(`Scan voltooid: ${scanStatus.data.results_count} percelen gevonden`)
      // Invalidate stale results cache so fresh data is fetched
      queryClient.invalidateQueries({ queryKey: ['scan-results', activeScanId] })
      // Keep activeScanId to show score layer and results panel
      setShowResults(true)
    } else if (scanStatus.data.status === 'failed') {
      toast.error('Scan mislukt')
      setActiveScanId(null) // Clear scan
      setShowResults(false)
    }
  }, [scanStatus.data, activeScanId, queryClient])

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

  // Handle address selection from search
  const handleAddressSelect = useCallback(async (suggestion: SuggestResult) => {
    // Show QuickCard immediately (for loading state)
    setTier('quick')
    setDemoData(null)
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
            const demo = getDemoProperty(pc, hn)
            if (demo) {
              setDemoData(demo)
              addRecentItem({
                id: demo.address.nummeraanduiding_id,
                report_name: `${demo.address.straat} ${demo.address.huisnummer}${demo.address.huisletter || ''}${demo.address.toevoeging || ''}`,
                postcode: demo.address.postcode,
                huisnummer: demo.address.huisnummer,
                woonplaats: demo.address.woonplaats,
              })
            }
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

      // Trigger scan directly (wijk click is a deliberate action -- no confirmation needed)
      triggerScan.mutate(
        {
          gemeente_code: currentGemeente.code,
          gemeente_naam: currentGemeente.naam,
          bbox_wgs84: bbox,
          wijk_naam: wijkNaam,
        },
        {
          onSuccess: (data) => {
            setActiveScanId(data.scan_id)
            if (mapRef.current) removeScanAreaHighlight(mapRef.current)
            setSelectedArea(null)
            if (data.status === 'existing' && !data.needs_rescan) {
              // Existing completed scan — show results immediately
              setShowResults(true)
              toast.info(`Bestaande scan gevonden — resultaten laden`)
            } else {
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
    },
    [triggerScan]
  )

  // Ref for wijk click handler to avoid stale closure
  const handleWijkClickRef = useRef(handleWijkClick)
  handleWijkClickRef.current = handleWijkClick

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
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
          if (data.status === 'existing' && !data.needs_rescan) {
            setShowResults(true)
            toast.info(`Bestaande scan gevonden — resultaten laden`)
          } else {
            toast.success(`Scan gestart voor ${currentGemeente.naam}`)
          }
        },
        onError: (err) => {
          toast.error(`Scan starten mislukt: ${err.message}`)
          if (mapRef.current) removeScanAreaHighlight(mapRef.current)
          setSelectedArea(null)
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
            setShowResults(true)
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
    <AppLayout>
      {/* Results panel — overlay that slides in from left over the persistent map */}
      <ResultsLayout
        scanId={activeScanId}
        collapsed={!showResults || !activeScanId}
        mapRef={mapRef}
        onClose={() => {
          setShowResults(false)
          setActiveScanId(null)
          // Clean up score layer from map
          if (mapRef.current) {
            removeParcelScoreLayer(mapRef.current)
          }
        }}
      />
      <AddressSearch onSelect={handleAddressSelect} />

      {/* Active gemeente context header */}
      {activeGemeente && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[var(--z-map-controls)] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-sm font-medium text-gray-900">
              {activeGemeente.naam}
            </span>
          </div>
          {wijkLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
          )}
          {/* Viewport scan button */}
          <button
            onClick={handleScanViewport}
            disabled={!!activeScanId || triggerScan.isPending}
            className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            {triggerScan.isPending ? 'Scannen...' : 'Scan zichtbaar gebied'}
          </button>
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
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Gemeente deselecteren"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Scan progress overlay */}
      {activeScanId && scanStatus.data && scanStatus.data.status !== 'completed' && (
        <ScanProgressOverlay
          status={scanStatus.data}
          onCancel={() => cancelScan.mutate(activeScanId)}
          isCancelling={cancelScan.isPending}
        />
      )}

      {/* Bestemmingsplan legend */}
      <BestemmingsplanLegend visible={showBestemmingsplan} />

      {/* Zone info card */}
      {zoneLoading && (
        <div className="absolute bottom-20 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            <p className="text-sm text-gray-600">Zone info laden...</p>
          </div>
        </div>
      )}
      {zoneInfo && !zoneLoading && (
        <div className="absolute bottom-20 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Bestemmingsplan</h3>
            <button
              onClick={() => setZoneInfo(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Sluiten"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900">{zoneInfo.info.planNaam}</p>
            <div className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
              {zoneInfo.info.bestemmingType}
            </div>
            {zoneInfo.info.planStatus && (
              <p className="text-xs text-gray-600">Status: {zoneInfo.info.planStatus}</p>
            )}
            {zoneInfo.info.planLink && (
              <a
                href={zoneInfo.info.planLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
              >
                Bekijk officieel document
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <button
              onClick={handleScanZone}
              disabled={triggerScan.isPending || !!activeScanId}
              className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {triggerScan.isPending ? 'Scan starten...' : 'Scan dit gebied'}
            </button>
          </div>
        </div>
      )}

      {/* Tier 1: QuickCard — MapLibre popup anchored to property */}
      {tier === 'quick' && (
        <PropertyQuickCard
          data={demoData ?? lookup.data ?? null}
          isLoading={!demoData && lookup.isPending}
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
          isLoading={!demoData && lookup.isPending}
          error={!demoData ? lookup.error : null}
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
        onGemeentenToggle={handleGemeentenToggle}
        onBestemmingsplanToggle={handleBestemmingsplanToggle}
        onWijkenToggle={handleWijkenToggle}
        showWijkenToggle={!!activeGemeente}
      />
    </AppLayout>
  )
}
