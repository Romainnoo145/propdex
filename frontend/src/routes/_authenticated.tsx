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
      <div className="relative h-screen w-screen overflow-hidden bg-aura-canvas">
        {/* Background mesh: subtle blurred color blobs behind everything */}
        <div
          className="fixed top-0 left-0 w-[40vw] h-[40vw] rounded-full pointer-events-none"
          style={{ background: '#D1E2D8', opacity: 0.15, filter: 'blur(100px)' }}
        />
        <div
          className="fixed bottom-0 right-0 w-[35vw] h-[35vw] rounded-full pointer-events-none"
          style={{ background: '#F9A826', opacity: 0.10, filter: 'blur(100px)' }}
        />

        <main className="relative h-full">
          {/* MapView: always in DOM, CSS-toggled visibility — never unmounts */}
          <div
            className="absolute inset-4 rounded-[40px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.03)]"
            style={{ display: isMapVisible ? 'block' : 'none' }}
          >
            <div className="absolute inset-0">
              <MapView
                mapRef={mapRef}
                onMapReady={() => setMapReady(true)}
                transformRequest={transformRequest}
              />
            </div>
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
