import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import AppLayout from '@/components/layout/AppLayout'
import MapView from '@/components/map/MapView'
import LayerToggle from '@/components/map/LayerToggle'
import { AddressSearch } from '@/components/search/AddressSearch'
import { PropertyQuickCard } from '@/components/property/PropertyQuickCard'
import { PropertyDetailDrawer } from '@/components/property/PropertyDetailDrawer'
import { usePropertyLookup } from '@/hooks/usePropertyLookup'
import { updatePropertyGeometry, clearPropertyGeometry } from '@/components/map/PropertyGeometryLayer'
import { lookupPdokAddress } from '@/lib/api'
import { getDemoProperty } from '@/lib/demo-data'
import type { SuggestResult, PropertyReportResponse } from '@/lib/types/property'

export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
})

type ViewTier = 'none' | 'quick' | 'drawer'

function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [tier, setTier] = useState<ViewTier>('none')
  const [demoData, setDemoData] = useState<PropertyReportResponse | null>(null)
  const lookup = usePropertyLookup()

  // Handle address selection from search
  const handleAddressSelect = useCallback(async (suggestion: SuggestResult) => {
    // Show QuickCard immediately (for loading state)
    setTier('quick')
    setDemoData(null)

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
          mapRef.current.flyTo({
            center: [parseFloat(match[1]!), parseFloat(match[2]!)],
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
          },
          onError: () => {
            // Backend unavailable — try demo data fallback
            const demo = getDemoProperty(postcode, huisnummer)
            if (demo) {
              setDemoData(demo)
            }
          },
        }
      )
    } catch (err) {
      console.error('PDOK address lookup failed:', err)
      setTier('none')
    }
  }, [lookup])

  // Handle QuickCard close (clears everything)
  const handleCloseQuickCard = useCallback(() => {
    setTier('none')
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }
  }, [])

  // Handle Drawer close (back to QuickCard, keep geometry)
  const handleCloseDrawer = useCallback(() => {
    setTier('quick')
  }, [])

  // Placeholder handlers for save/export (wired in Plan 07)
  const handleSave = useCallback(() => {
    console.log('Save functionality - to be implemented in Plan 07')
  }, [])

  const handleExportPDF = useCallback(() => {
    console.log('Export PDF functionality - to be implemented in Plan 07')
  }, [])

  return (
    <AppLayout>
      <MapView mapRef={mapRef} />
      <AddressSearch onSelect={handleAddressSelect} />

      {/* Tier 1: QuickCard */}
      {tier === 'quick' && (
        <PropertyQuickCard
          data={demoData ?? lookup.data ?? null}
          isLoading={!demoData && lookup.isPending}
          onViewDetails={() => setTier('drawer')}
          onClose={handleCloseQuickCard}
        />
      )}

      {/* Tier 2: Drawer */}
      {tier === 'drawer' && (
        <PropertyDetailDrawer
          data={demoData ?? lookup.data ?? null}
          isLoading={!demoData && lookup.isPending}
          error={!demoData ? lookup.error : null}
          onClose={handleCloseDrawer}
          onExportPDF={handleExportPDF}
          onSave={handleSave}
        />
      )}

      <LayerToggle mapRef={mapRef} />
    </AppLayout>
  )
}
