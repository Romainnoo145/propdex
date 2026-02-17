import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

interface MapContextValue {
  mapRef: RefObject<MapLibreMap | null>
  mapReady: boolean
}

export const MapContext = createContext<MapContextValue | null>(null)

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMapContext must be used within MapContext.Provider')
  return ctx
}
