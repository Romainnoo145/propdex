import { useRef, useState, useEffect, useCallback } from 'react'
import { createFileRoute, Outlet, redirect, useMatchRoute } from '@tanstack/react-router'
import type { Map as MapLibreMap } from 'maplibre-gl'
import SideRailNav from '@/components/layout/SideRailNav'
import BottomTabNav from '@/components/layout/BottomTabNav'
import MapView from '@/components/map/MapView'
import { MapContext } from '@/lib/MapContext'
import { useAuth } from '@/lib/auth/useAuth'
import { WorkspaceProvider } from '@/lib/workspace/WorkspaceContext'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/auth',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const matchRoute = useMatchRoute()
  const isMapVisible = !!matchRoute({ to: '/map', fuzzy: true })
  const { accessToken } = useAuth()

  // Use ref to prevent stale closure in transformRequest (Pitfall 2)
  const accessTokenRef = useRef(accessToken)
  // Sync ref in effect to avoid mutating ref during render
  useEffect(() => {
    accessTokenRef.current = accessToken
  }, [accessToken])

  // Stable transformRequest — reads token from ref, never re-initializes MapLibre
  const transformRequest = useCallback(
    (url: string, resourceType?: string) => {
      if ((url.startsWith('/api/') || url.includes('/api/scans/')) && resourceType === 'Tile') {
        const headers: Record<string, string> = {}
        if (accessTokenRef.current) {
          headers['Authorization'] = `Bearer ${accessTokenRef.current}`
        }
        return { url, headers, credentials: 'include' as const }
      }
      return { url }
    },
    [] // stable — reads from ref
  )

  // Resize map after becoming visible again (Pitfall 1)
  useEffect(() => {
    if (!isMapVisible || !mapReady || !mapRef.current) return
    const timer = setTimeout(() => mapRef.current?.resize(), 50)
    return () => clearTimeout(timer)
  }, [isMapVisible, mapReady])

  // Reset cursor/hover state when hiding the map (Pitfall 6)
  useEffect(() => {
    if (!isMapVisible && mapRef.current) {
      mapRef.current.getCanvas().style.cursor = ''
    }
  }, [isMapVisible])

  return (
    <WorkspaceProvider>
      <div className="relative h-screen w-screen overflow-hidden">
        <main className="relative h-full">
          {/* MapView: always in DOM, CSS-toggled visibility — never unmounts */}
          <div
            className="absolute inset-0"
            style={{ display: isMapVisible ? 'block' : 'none' }}
          >
            <MapView
              mapRef={mapRef}
              onMapReady={() => setMapReady(true)}
              transformRequest={transformRequest}
            />
          </div>
          {/* Route content rendered on top / instead of map */}
          <MapContext.Provider value={{ mapRef, mapReady }}>
            <Outlet />
          </MapContext.Provider>
        </main>
        {/* SideRailNav floats on top of all content */}
        <SideRailNav />
        <BottomTabNav />
      </div>
    </WorkspaceProvider>
  )
}
