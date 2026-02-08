import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  PDOK_AERIAL_TILES,
  PDOK_TOPO_TILES,
  PDOK_AERIAL_ATTRIBUTION,
  PDOK_TOPO_ATTRIBUTION,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
} from '@/lib/pdok';

interface MapViewProps {
  mapRef?: React.MutableRefObject<maplibregl.Map | null>;
  onMapReady?: (map: maplibregl.Map) => void;
}

export default function MapView({ mapRef: externalMapRef, onMapReady }: MapViewProps) {
  const internalMapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map with PDOK aerial and topo sources
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'pdok-aerial': {
            type: 'raster',
            tiles: [PDOK_AERIAL_TILES],
            tileSize: 256,
            attribution: PDOK_AERIAL_ATTRIBUTION,
          },
          'pdok-topo': {
            type: 'raster',
            tiles: [PDOK_TOPO_TILES],
            tileSize: 256,
            attribution: PDOK_TOPO_ATTRIBUTION,
          },
        },
        layers: [
          {
            id: 'pdok-aerial-layer',
            type: 'raster',
            source: 'pdok-aerial',
            layout: { visibility: 'visible' },
          },
          {
            id: 'pdok-topo-layer',
            type: 'raster',
            source: 'pdok-topo',
            layout: { visibility: 'none' },
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    // Add navigation controls (zoom, compass, rotation)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add geolocation control
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      'top-right'
    );

    // Store map instance in refs
    internalMapRef.current = map;
    if (externalMapRef) {
      externalMapRef.current = map;
    }

    // Call onMapReady when map is loaded
    map.on('load', () => {
      if (onMapReady) {
        onMapReady(map);
      }
    });

    // Cleanup: remove map instance to prevent memory leaks
    return () => {
      map.remove();
      internalMapRef.current = null;
      if (externalMapRef) {
        externalMapRef.current = null;
      }
    };
    // externalMapRef and onMapReady are intentionally stable refs/callbacks from parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - initialize once on mount

  return <div ref={containerRef} className="w-full h-full" />;
}
