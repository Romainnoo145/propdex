import { useRef, useState, useEffect, useCallback } from 'react'
import { AMBER, MINT } from '@/lib/tokens'
import { createFileRoute, Outlet, redirect, useMatchRoute } from '@tanstack/react-router'
import type { Map as MapLibreMap } from 'maplibre-gl'
import SideRailNav from '@/components/layout/SideRailNav'
import LifecycleSideRailNav from '@/components/layout/LifecycleSideRailNav'
import { LIFECYCLE_PHASES, type LifecyclePhaseKey } from '@/lib/lifecycle/phases'
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
  const leftPanelPortalRef = useRef<HTMLDivElement | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const matchRoute = useMatchRoute()
  const isMapVisible = !!matchRoute({ to: '/map', fuzzy: true })
  const isOpgeslagenRoute = !!matchRoute({ to: '/opgeslagen', fuzzy: true })
  const phaseMatch = matchRoute({ to: '/opgeslagen/perceel/$parcelId/$phase' }) as { phase?: string } | false
  const activeLifecyclePhase: LifecyclePhaseKey =
    phaseMatch && phaseMatch.phase && LIFECYCLE_PHASES.some((p) => p.key === phaseMatch.phase)
      ? (phaseMatch.phase as LifecyclePhaseKey)
      : '1-onderzoek'
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

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const interval = setInterval(() => mapRef.current?.resize(), 16)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      mapRef.current?.resize()
    }, 400)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [panelOpen, leftPanelOpen, mapReady])

  return (
    <WorkspaceProvider>
      {/* Skip navigation link — visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-aura-obsidian focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
      >
        Ga naar hoofdinhoud
      </a>
      {/* The Desk: Morning Mist canvas with background blobs */}
      <div className="h-screen w-screen overflow-hidden bg-aura-canvas">
        {/* Background mesh blobs — sidebar absorbs Sage Mint via backdrop-blur */}
        <div
          className="fixed top-[-5%] left-0 w-[60vw] h-[60vw] rounded-full pointer-events-none"
          style={{ background: MINT, opacity: 0.35, filter: 'blur(120px)' }}
        />
        <div
          className="fixed bottom-[-10%] right-[5%] w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: AMBER.base, opacity: 0.20, filter: 'blur(150px)' }}
        />

        {/* Fixed sidebar — floats over the canvas, not in the flow */}
        <div className="hidden md:block">
          {isOpgeslagenRoute ? <LifecycleSideRailNav activePhaseKey={activeLifecyclePhase} /> : <SideRailNav />}
        </div>

        {/* The App Container: floats on the desk with breathing room */}
        <div className="relative h-full pt-4 pr-4 pb-4">
          {/* Content area — flex row: [left panel slot] + [map] + [right panel slot] */}
          <div className="relative h-full ml-[130px] min-w-0 flex">
            {/* Left panel portal target — gemeente/wijk context panels rendered here via createPortal */}
            <div
              ref={leftPanelPortalRef}
              className="shrink-0 h-full relative"
              style={{
                width: leftPanelOpen ? '620px' : '0px',
                marginRight: leftPanelOpen ? '16px' : '0px',
                overflow: leftPanelOpen ? 'visible' : 'hidden',
                transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), margin-right 350ms cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 10,
              }}
            />

            {/* Right panel portal target — parcel detail panel rendered here via createPortal */}
            <div
              ref={panelPortalRef}
              className="shrink-0 h-full relative"
              style={{
                width: panelOpen ? '620px' : '0px',
                marginRight: panelOpen ? '16px' : '0px',
                overflow: panelOpen ? 'visible' : 'hidden',
                transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), margin-right 350ms cubic-bezier(0.4, 0, 0.2, 1)',
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
            <MapContext.Provider value={{ mapRef, mapReady, panelPortalRef, panelOpen, setPanelOpen, leftPanelPortalRef, leftPanelOpen, setLeftPanelOpen }}>
              <main id="main-content" className={isMapVisible ? 'absolute inset-0 pointer-events-none' : 'flex-1 min-w-0 relative h-full'} style={isMapVisible ? { zIndex: 1 } : undefined}>
                <Outlet />
              </main>
            </MapContext.Provider>
          </div>
        </div>

        <BottomTabNav />
      </div>
    </WorkspaceProvider>
  )
}
