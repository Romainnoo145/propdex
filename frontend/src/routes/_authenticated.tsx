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
  const panelPortalRef = useRef<HTMLDivElement | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
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

  // Trigger map resize during panel transition (350ms CSS transition)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    // Resize repeatedly during the 350ms transition so the map follows the flex change
    const interval = setInterval(() => mapRef.current?.resize(), 16)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      mapRef.current?.resize()
    }, 400)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [panelOpen, mapReady])

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
          className="fixed top-[-5%] left-0 w-[60vw] h-[60vw] rounded-full pointer-events-none"
          style={{ background: '#D1E2D8', opacity: 0.35, filter: 'blur(120px)' }}
        />
        <div
          className="fixed bottom-[-10%] right-[5%] w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: '#F9A826', opacity: 0.20, filter: 'blur(150px)' }}
        />

        {/* Fixed sidebar — floats over the canvas, not in the flow */}
        <div className="hidden md:block">
          <SideRailNav />
        </div>

        {/* The App Container: floats on the desk with breathing room */}
        <div className="relative h-full pt-4 pr-4 pb-4">
          {/* Content area — flex row: [panel slot] + [map] */}
          <div className="relative h-full ml-[110px] min-w-0 flex gap-4">
            {/* Panel portal target — panel content rendered here via createPortal from map.tsx */}
            <div
              ref={panelPortalRef}
              className="shrink-0 h-full relative"
              style={{
                width: panelOpen ? '620px' : '0px',
                overflow: panelOpen ? 'visible' : 'hidden',
                transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 10,
              }}
            />

            {/* Map container: rounded glass card — flex-1 shrinks when panel opens */}
            <div
              className="flex-1 min-w-0 rounded-[40px] overflow-hidden border border-white/20 relative"
              style={{ display: isMapVisible ? 'block' : 'none' }}
            >
              <MapView
                mapRef={mapRef}
                onMapReady={() => setMapReady(true)}
                transformRequest={transformRequest}
              />
            </div>

            {/* Outlet: absolute overlay on map route, flex child on other routes */}
            <MapContext.Provider value={{ mapRef, mapReady, panelPortalRef, panelOpen, setPanelOpen }}>
              {isMapVisible ? (
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
                  <Outlet />
                </div>
              ) : (
                <div className="flex-1 min-w-0 relative h-full">
                  <Outlet />
                </div>
              )}
            </MapContext.Provider>
          </div>
        </div>

        <BottomTabNav />
      </div>
    </WorkspaceProvider>
  )
}
