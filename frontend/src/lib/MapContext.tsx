import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

interface MapContextValue {
  mapRef: RefObject<MapLibreMap | null>
  mapReady: boolean
  /** Ref to the right panel portal target in _authenticated layout (parcel detail) */
  panelPortalRef: RefObject<HTMLDivElement | null>
  /** Whether the right panel is currently open (triggers map resize) */
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  /** Ref to the left panel portal target in _authenticated layout (gemeente/wijk context) */
  leftPanelPortalRef: RefObject<HTMLDivElement | null>
  /** Whether the left panel is currently open (triggers map resize) */
  leftPanelOpen: boolean
  setLeftPanelOpen: (open: boolean) => void
}

export const MapContext = createContext<MapContextValue | null>(null)

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMapContext must be used within MapContext.Provider')
  return ctx
}
