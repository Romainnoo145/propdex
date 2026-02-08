import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import AppLayout from '@/components/layout/AppLayout'
import MapView from '@/components/map/MapView'
import LayerToggle from '@/components/map/LayerToggle'
import { AddressSearch } from '@/components/search/AddressSearch'
import PropertyDetailPanel from '@/components/property/PropertyDetailPanel'
import { usePropertyLookup } from '@/hooks/usePropertyLookup'
import { updatePropertyGeometry, clearPropertyGeometry } from '@/components/map/PropertyGeometryLayer'
import type { SuggestResult } from '@/lib/types/property'

export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
})

function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const lookup = usePropertyLookup()

  // Handle address selection from search
  const handleAddressSelect = useCallback((suggestion: SuggestResult) => {
    // Extract postcode and huisnummer from PDOK suggestion
    // PDOK suggest docs include postcode, huis_nlt fields
    const postcode = (suggestion as Record<string, unknown>).postcode as string | undefined
    const huisnummer = parseInt(
      String((suggestion as Record<string, unknown>).huis_nlt ?? '0'),
      10
    )

    if (!postcode || !huisnummer) {
      console.warn('Could not extract postcode/huisnummer from suggestion:', suggestion)
      return
    }

    // Trigger property lookup mutation
    lookup.mutate(
      { postcode, huisnummer },
      {
        onSuccess: (data) => {
          setShowPanel(true)
          if (mapRef.current) {
            updatePropertyGeometry(mapRef.current, data)
          }
        },
      }
    )

    // Show panel immediately (for loading state)
    setShowPanel(true)
  }, [lookup])

  // Handle panel close
  const handleClosePanel = useCallback(() => {
    setShowPanel(false)
    if (mapRef.current) {
      clearPropertyGeometry(mapRef.current)
    }
  }, [])

  return (
    <AppLayout>
      <MapView mapRef={mapRef} />
      <AddressSearch onSelect={handleAddressSelect} />
      {showPanel && (
        <PropertyDetailPanel
          data={lookup.data ?? null}
          isLoading={lookup.isPending}
          error={lookup.error}
          onClose={handleClosePanel}
        />
      )}
      <LayerToggle mapRef={mapRef} />
    </AppLayout>
  )
}
