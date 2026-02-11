import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState, useCallback, useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { toast } from 'sonner'
import AppLayout from '@/components/layout/AppLayout'
import MapView from '@/components/map/MapView'
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
  addBestemmingsplanLayer,
  setBestemmingsplanVisibility,
  setupBestemmingsplanClickHandler,
} from '@/components/map/BestemmingsplanLayer'
import { addParcelScoreLayer } from '@/components/map/ParcelScoreLayer'
import { useTriggerScan, useScanPolling, useCancelScan } from '@/hooks/useScans'
import { useAuth } from '@/lib/auth/useAuth'
import ScanProgressOverlay from '@/components/map/ScanProgressOverlay'
import { BestemmingsplanLegend } from '@/components/map/BestemmingsplanLegend'
import { lookupPdokAddress, getScanTileUrl } from '@/lib/api'
import { getDemoProperty } from '@/lib/demo-data'
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
  const mapRef = useRef<maplibregl.Map | null>(null)
  const navigate = useNavigate()
  const { postcode, huisnummer, reportId } = Route.useSearch()
  const { accessToken } = useAuth()
  const [tier, setTier] = useState<ViewTier>('none')
  const [demoData, setDemoData] = useState<PropertyReportResponse | null>(null)
  const [propertyLngLat, setPropertyLngLat] = useState<[number, number] | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [gemeenteGeojson, setGemeenteGeojson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  const [showBestemmingsplan, setShowBestemmingsplan] = useState(false)
  const [zoneInfo, setZoneInfo] = useState<{ info: ZoneFeatureInfo; lngLat: [number, number] } | null>(null)
  const [zoneLoading, setZoneLoading] = useState(false)
  const lookup = usePropertyLookup()
  const { addRecentItem } = useRecentViewed()

  // Scan hooks
  const triggerScan = useTriggerScan()
  const scanStatus = useScanPolling(activeScanId)
  const cancelScan = useCancelScan()

  // Fetch saved report if reportId provided
  const savedReport = useReport(reportId || null)

  // Save/export flow
  const currentData = demoData ?? lookup.data ?? null
  const saveFlow = useSaveReportFlow(currentData)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)

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

    /* eslint-disable react-hooks/set-state-in-effect -- intentional sync reset */
    setDemoData(propertyData)
    setSavedReportId(reportId)
    setTier('drawer')
    /* eslint-enable react-hooks/set-state-in-effect */

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

    /* eslint-disable react-hooks/set-state-in-effect -- intentional sync reset before async mutation */
    setTier('quick')
    setDemoData(null)
    setPropertyLngLat(null)
    /* eslint-enable react-hooks/set-state-in-effect */

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
    /* eslint-disable react-hooks/set-state-in-effect -- Intentional: Update local state based on external scan status */
    if (scanStatus.data.status === 'completed') {
      toast.success(`Scan voltooid: ${scanStatus.data.results_count} percelen gevonden`)
      // Keep activeScanId to show score layer
    } else if (scanStatus.data.status === 'failed') {
      toast.error('Scan mislukt')
      setActiveScanId(null) // Clear scan
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [scanStatus.data])

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

  // MapLibre transformRequest for authenticated tile requests
  const transformRequest = useCallback(
    (url: string, resourceType?: string) => {
      // Add auth for tile requests to our backend
      if (url.startsWith('/api/') && resourceType === 'Tile') {
        const headers: Record<string, string> = {}
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
        return {
          url,
          headers,
          credentials: 'include' as const,
        }
      }
      return { url }
    },
    [accessToken]
  )

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
          addGemeenteBoundariesLayer(map, geojson, (gemeenteCode, gemeenteNaam) => {
            console.log('Gemeente selected:', gemeenteCode, gemeenteNaam)

            // Trigger scan
            triggerScan.mutate(
              { gemeente_code: gemeenteCode, gemeente_naam: gemeenteNaam },
              {
                onSuccess: (data) => {
                  if (data.status === 'existing' && !data.needs_rescan) {
                    // Existing scan found - show results from existing scan
                    setActiveScanId(data.scan_id)
                    toast.info(`Bestaande scan van ${data.scan_date} gevonden`)
                  } else {
                    // New scan started
                    setActiveScanId(data.scan_id)
                  }
                },
                onError: (err) => {
                  toast.error(`Scan starten mislukt: ${err.message}`)
                },
              }
            )
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
    }
    },
    [gemeenteGeojson, triggerScan]
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

  return (
    <AppLayout>
      <MapView
        mapRef={mapRef}
        onMapReady={() => setMapReady(true)}
        transformRequest={transformRequest}
      />
      <AddressSearch onSelect={handleAddressSelect} />

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
      />
    </AppLayout>
  )
}
