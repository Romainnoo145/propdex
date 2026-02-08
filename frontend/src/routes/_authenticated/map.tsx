import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, useCallback } from 'react'
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
import { updatePropertyGeometry, clearPropertyGeometry } from '@/components/map/PropertyGeometryLayer'
import { lookupPdokAddress } from '@/lib/api'
import { getDemoProperty } from '@/lib/demo-data'
import type { SuggestResult, PropertyReportResponse } from '@/lib/types/property'

export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
})

type ViewTier = 'none' | 'quick' | 'drawer' | 'modal'

function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [tier, setTier] = useState<ViewTier>('none')
  const [demoData, setDemoData] = useState<PropertyReportResponse | null>(null)
  const [propertyLngLat, setPropertyLngLat] = useState<[number, number] | null>(null)
  const lookup = usePropertyLookup()
  const { addRecentItem } = useRecentViewed()

  // Save/export flow
  const currentData = demoData ?? lookup.data ?? null
  const saveFlow = useSaveReportFlow(currentData)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)

  // Handle address selection from search
  const handleAddressSelect = useCallback(async (suggestion: SuggestResult) => {
    // Show QuickCard immediately (for loading state)
    setTier('quick')
    setDemoData(null)
    setPropertyLngLat(null)

    try {
      // PDOK suggest only returns id + weergavenaam, so look up full details
      const details = await lookupPdokAddress(suggestion.id)

      const postcode = details.postcode?.replace(/\s/g, '')
      const huisnummer = details.huisnummer

      if (!postcode || !huisnummer) {
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
        { postcode, huisnummer },
        {
          onSuccess: (data) => {
            if (mapRef.current) {
              updatePropertyGeometry(mapRef.current, data)
            }
            // Track in recent viewed
            addRecentItem({
              id: data.address.nummeraanduiding_id,
              report_name: `${data.address.straat} ${data.address.huisnummer}${data.address.huisletter || ''}${data.address.toevoeging || ''}`,
              postcode: data.address.postcode,
              woonplaats: data.address.woonplaats,
            })
          },
          onError: () => {
            // Backend unavailable — try demo data fallback
            const demo = getDemoProperty(postcode, huisnummer)
            if (demo) {
              setDemoData(demo)
              // Track demo data in recent viewed
              addRecentItem({
                id: demo.address.nummeraanduiding_id,
                report_name: `${demo.address.straat} ${demo.address.huisnummer}${demo.address.huisletter || ''}${demo.address.toevoeging || ''}`,
                postcode: demo.address.postcode,
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
