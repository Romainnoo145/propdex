import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState, useCallback, useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
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
import { lookupPdokAddress } from '@/lib/api'
import { getDemoProperty } from '@/lib/demo-data'
import type { SuggestResult, PropertyReportResponse } from '@/lib/types/property'

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
  const [tier, setTier] = useState<ViewTier>('none')
  const [demoData, setDemoData] = useState<PropertyReportResponse | null>(null)
  const [propertyLngLat, setPropertyLngLat] = useState<[number, number] | null>(null)
  const lookup = usePropertyLookup()
  const { addRecentItem } = useRecentViewed()

  // Fetch saved report if reportId provided
  const savedReport = useReport(reportId || null)

  // Save/export flow
  const currentData = demoData ?? lookup.data ?? null
  const saveFlow = useSaveReportFlow(currentData)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)

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

    // Fly to property location if coordinates available
    const coords = propertyData.map_data?.center_wgs84
    if (coords && coords.length === 2) {
      const lngLat: [number, number] = [coords[0]!, coords[1]!]
      setPropertyLngLat(lngLat)
      if (mapRef.current) {
        mapRef.current.flyTo({ center: lngLat, zoom: 17 })
        updatePropertyGeometry(mapRef.current, propertyData)
      }
    }

    // Clear reportId from URL so it doesn't re-trigger
    navigate({ to: '/map', search: {}, replace: true })
  }, [reportId, savedReport.data, navigate])

  // Handle incoming search params (from recent viewed / report sidebar)
  useEffect(() => {
    if (!postcode || !huisnummer) return

    // Prevent re-triggering for the same params
    const key = `${postcode}-${huisnummer}`
    if (handledSearchRef.current === key) return
    handledSearchRef.current = key

    /* eslint-disable react-hooks/set-state-in-effect -- intentional sync reset before async mutation */
    setTier('quick')
    setDemoData(null)
    setPropertyLngLat(null)
    /* eslint-enable react-hooks/set-state-in-effect */

    lookup.mutate(
      { postcode, huisnummer },
      {
        onSuccess: (data) => {
          const coords = data.map_data?.center_wgs84
          if (coords && coords.length === 2) {
            const lngLat: [number, number] = [coords[0]!, coords[1]!]
            setPropertyLngLat(lngLat)
            if (mapRef.current) {
              mapRef.current.flyTo({ center: lngLat, zoom: 17 })
            }
          }
          if (mapRef.current) {
            updatePropertyGeometry(mapRef.current, data)
          }
        },
        onError: () => {
          const demo = getDemoProperty(postcode, huisnummer)
          if (demo) {
            setDemoData(demo)
            const coords = demo.map_data?.center_wgs84
            if (coords && coords.length === 2) {
              const lngLat: [number, number] = [coords[0]!, coords[1]!]
              setPropertyLngLat(lngLat)
              if (mapRef.current) {
                mapRef.current.flyTo({ center: lngLat, zoom: 17 })
                updatePropertyGeometry(mapRef.current, demo)
              }
            }
          }
        },
      }
    )

    // Clear search params so they don't re-trigger
    navigate({ to: '/map', search: {}, replace: true })
  }, [postcode, huisnummer, lookup, navigate])

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

      // Fly to address location if we have coordinates
      if (details.centroide_ll && mapRef.current) {
        const match = details.centroide_ll.match(/POINT\(([^ ]+) ([^ ]+)\)/)
        if (match) {
          const coords: [number, number] = [parseFloat(match[1]!), parseFloat(match[2]!)]
          setPropertyLngLat(coords)
          mapRef.current.flyTo({
            center: coords,
            zoom: 17,
          })
        }
      }

      // Trigger property lookup mutation with demo fallback
      lookup.mutate(
        { postcode: pc, huisnummer: hn },
        {
          onSuccess: (data) => {
            if (mapRef.current) {
              updatePropertyGeometry(mapRef.current, data)
            }
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

  return (
    <AppLayout>
      <MapView mapRef={mapRef} />
      <AddressSearch onSelect={handleAddressSelect} />

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

      <LayerToggle mapRef={mapRef} />
    </AppLayout>
  )
}
