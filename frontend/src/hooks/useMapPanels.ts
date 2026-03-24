import { useState, useCallback } from 'react'
import type { Map as MaplibreMap } from 'maplibre-gl'
import type { ScanListItem } from '@/lib/types/scan'
import { calculateBboxFromGeometry } from '@/lib/geo-utils'
import { clearGemeenteSelection } from '@/components/map/GemeenteBoundariesLayer'
import { NL_CENTER, NL_ZOOM } from '@/lib/pdok'
import type { ScanResultItem } from '@/lib/types/scan'

export type ActivePanel =
  | { kind: 'gemeente'; code: string; naam: string; bbox: [number, number, number, number] }
  | { kind: 'wijk'; code: string; naam: string; gemeenteCode: string; gemeenteNaam: string; latestScan: ScanListItem | null }
  | { kind: 'parcel'; parcel: ScanResultItem; gemeenteNaam?: string | null; wijkNaam?: string | null }

interface ActiveGemeente {
  code: string
  naam: string
  bbox: [number, number, number, number]
}

interface UseMapPanelsParams {
  activeGemeenteRef: React.RefObject<ActiveGemeente | null>
  wijkGeojson: GeoJSON.FeatureCollection | null
  scanHistory: { scans: ScanListItem[] } | undefined
  mapRef: React.RefObject<MaplibreMap | null>
  setActiveGemeente: (g: ActiveGemeente | null) => void
  setWijkGeojson: (g: GeoJSON.FeatureCollection | null) => void
  setParcelGeometryHighlight: (h: {
    lng: number
    lat: number
    parcelCode: string | null
    areaM2: number | null
    geometry: GeoJSON.Geometry
  } | null) => void
  removeWijkBoundariesLayer: (map: MaplibreMap) => void
  removeScanAreaHighlight: (map: MaplibreMap) => void
  addScanAreaHighlight: (
    map: MaplibreMap,
    geom: GeoJSON.Polygon | GeoJSON.MultiPolygon
  ) => void
}

export function useMapPanels({
  activeGemeenteRef,
  wijkGeojson,
  scanHistory,
  mapRef,
  setActiveGemeente,
  setWijkGeojson,
  setParcelGeometryHighlight,
  removeWijkBoundariesLayer,
  removeScanAreaHighlight,
  addScanAreaHighlight,
}: UseMapPanelsParams) {
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)
  const inspectorParcel = activePanel?.kind === 'parcel' ? activePanel.parcel : null

  /** Transition from gemeente panel to wijk panel */
  const handleGemeentePanelSelectWijk = useCallback(
    (wijkCode: string, wijkNaam: string) => {
      const currentGemeente = activeGemeenteRef.current
      if (!currentGemeente) return

      // Find feature to get bbox and geometry for highlighting
      const feature = wijkGeojson?.features.find(
        (f) => (f.properties?.statcode as string) === wijkCode,
      )
      if (feature && mapRef.current) {
        const geom = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
        const bbox = calculateBboxFromGeometry(geom) as [number, number, number, number]
        removeScanAreaHighlight(mapRef.current)
        addScanAreaHighlight(mapRef.current, geom)
        const canvas = mapRef.current.getCanvas()
        const padX = Math.round(canvas.clientWidth * 0.08)
        const padY = Math.round(canvas.clientHeight * 0.08)
        mapRef.current.fitBounds(bbox, { padding: { top: padY, bottom: padY, left: padX, right: padX }, duration: 600, maxZoom: 15 })
      }

      const latestScan =
        scanHistory?.scans?.find(
          (s) =>
            s.gemeente_code === currentGemeente.code &&
            s.wijk_naam === wijkNaam &&
            s.status === 'completed',
        ) ?? null

      setActivePanel({
        kind: 'wijk',
        code: wijkCode,
        naam: wijkNaam,
        gemeenteCode: currentGemeente.code,
        gemeenteNaam: currentGemeente.naam,
        latestScan,
      })
    },
    [wijkGeojson, scanHistory?.scans, activeGemeenteRef, mapRef, removeScanAreaHighlight, addScanAreaHighlight],
  )

  /** Go back from wijk panel to gemeente panel */
  const handleWijkPanelBack = useCallback(() => {
    const currentGemeente = activeGemeenteRef.current
    if (!currentGemeente) {
      setActivePanel(null)
      return
    }
    setActivePanel({
      kind: 'gemeente',
      code: currentGemeente.code,
      naam: currentGemeente.naam,
      bbox: currentGemeente.bbox,
    })
    if (mapRef.current) {
      removeScanAreaHighlight(mapRef.current)
      // Zoom back to gemeente bounds
      const map = mapRef.current
      const canvas = map.getCanvas()
      const padX = Math.round(canvas.clientWidth * 0.08)
      const padY = Math.round(canvas.clientHeight * 0.08)
      map.fitBounds(
        currentGemeente.bbox,
        { padding: { top: padY, bottom: padY, left: padX, right: padX }, duration: 800, maxZoom: 12 }
      )
    }
  }, [activeGemeenteRef, mapRef, removeScanAreaHighlight])

  /** Close gemeente panel, reset map to NL overview */
  const handleCloseGemeentePanel = useCallback(() => {
    setActivePanel(null)
    setActiveGemeente(null)
    if (mapRef.current) {
      const map = mapRef.current
      clearGemeenteSelection(map)
      if (map.getSource('cbs-wijken')) {
        removeWijkBoundariesLayer(map)
        setWijkGeojson(null)
      }
      map.flyTo({ center: NL_CENTER, zoom: NL_ZOOM, duration: 1000 })
    }
  }, [mapRef, setActiveGemeente, setWijkGeojson, removeWijkBoundariesLayer])

  /** Close parcel panel, clear geometry highlight */
  const handleCloseParcelPanel = useCallback(() => {
    setActivePanel(null)
    setParcelGeometryHighlight(null)
  }, [setParcelGeometryHighlight])

  return {
    activePanel,
    setActivePanel,
    inspectorParcel,
    handleGemeentePanelSelectWijk,
    handleWijkPanelBack,
    handleCloseGemeentePanel,
    handleCloseParcelPanel,
  }
}
