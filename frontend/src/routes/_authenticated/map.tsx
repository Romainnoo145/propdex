import { createFileRoute } from '@tanstack/react-router'
import { useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import AppLayout from '@/components/layout/AppLayout'
import MapView from '@/components/map/MapView'
import LayerToggle from '@/components/map/LayerToggle'

export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
})

function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null)

  return (
    <AppLayout>
      <MapView mapRef={mapRef} />
      <LayerToggle mapRef={mapRef} />
    </AppLayout>
  )
}
