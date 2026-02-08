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
import { lookupPdokAddress } from '@/lib/api'
import type { SuggestResult } from '@/lib/types/property'

export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
})

function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const lookup = usePropertyLookup()

  // Handle address selection from search
  const handleAddressSelect = useCallback(async (suggestion: SuggestResult) => {
    // Show panel immediately (for loading state)
    setShowPanel(true)

    try {
      // PDOK suggest only returns id + weergavenaam, so look up full details
      const details = await lookupPdokAddress(suggestion.id)

      const postcode = details.postcode?.replace(/\s/g, '')
      const huisnummer = details.huisnummer

      if (!postcode || !huisnummer) {
        console.warn('Could not extract postcode/huisnummer from PDOK lookup:', details)
        setShowPanel(false)
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

      // Trigger property lookup mutation
      lookup.mutate(
        { postcode, huisnummer },
        {
          onSuccess: (data) => {
            if (mapRef.current) {
              updatePropertyGeometry(mapRef.current, data)
            }
          },
        }
      )
    } catch (err) {
      console.error('PDOK address lookup failed:', err)
      setShowPanel(false)
    }
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
