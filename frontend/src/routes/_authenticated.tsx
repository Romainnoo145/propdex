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

  const accessTokenRef = useRef(accessToken)
  useEffect(() => {
    accessTokenRef.current = accessToken
  }, [accessToken])

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
    []
  )

  useEffect(() => {
    if (!isMapVisible || !mapReady || !mapRef.current) return
    const timer = setTimeout(() => mapRef.current?.resize(), 50)
    return () => clearTimeout(timer)
  }, [isMapVisible, mapReady])

  useEffect(() => {
    if (!isMapVisible && mapRef.current) {
      mapRef.current.getCanvas().style.cursor = ''
    }
  }, [isMapVisible])

  return (
    <WorkspaceProvider>
      {/* The Desk: Morning Mist canvas with background blobs */}
      <div className="h-screen w-screen overflow-hidden bg-aura-canvas">
        {/* Background mesh blobs — sidebar absorbs Sage Mint via backdrop-blur */}
        <div
          className="fixed top-[-5%] left-[-2%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: '#D1E2D8', opacity: 0.40, filter: 'blur(150px)' }}
        />
        <div
          className="fixed bottom-[-5%] right-[-2%] w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: '#F9A826', opacity: 0.12, filter: 'blur(150px)' }}
        />

        {/* The App Container: floats on the desk with 16px breathing room */}
        <div className="relative h-full p-4 flex gap-4">
          {/* Sidebar Rail — flex sibling, not overlay */}
          <div className="hidden md:block flex-shrink-0">
            <SideRailNav />
          </div>

          {/* Content area — takes remaining space */}
          <div className="relative flex-1 min-w-0">
            {/* Map container: rounded glass card */}
            <div
              className="absolute inset-0 rounded-[40px] overflow-hidden border border-white/20"
              style={{ display: isMapVisible ? 'block' : 'none' }}
            >
              <MapView
                mapRef={mapRef}
                onMapReady={() => setMapReady(true)}
                transformRequest={transformRequest}
              />
            </div>

            {/* Non-map route content */}
            <MapContext.Provider value={{ mapRef, mapReady }}>
              <Outlet />
            </MapContext.Provider>
          </div>
        </div>

        <BottomTabNav />
      </div>
    </WorkspaceProvider>
  )
}
