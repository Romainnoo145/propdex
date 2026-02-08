import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  PDOK_AERIAL_TILES,
  CARTO_LIGHT_TILES,
  PDOK_AERIAL_ATTRIBUTION,
  CARTO_ATTRIBUTION,
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
            bounds: [3.2, 50.7, 7.3, 53.6],
          },
          'carto-light': {
            type: 'raster',
            tiles: [CARTO_LIGHT_TILES],
            tileSize: 512,
            attribution: CARTO_ATTRIBUTION,
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#1a1a2e' },
          },
          {
            id: 'carto-light-layer',
            type: 'raster',
            source: 'carto-light',
          },
          {
            id: 'pdok-aerial-layer',
            type: 'raster',
            source: 'pdok-aerial',
            minzoom: 7,
            paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 300 } },
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );

    internalMapRef.current = map;
    if (externalMapRef) {
      externalMapRef.current = map;
    }

    map.on('load', () => {
      if (onMapReady) {
        onMapReady(map);
      }
    });

    return () => {
      map.remove();
      internalMapRef.current = null;
      if (externalMapRef) {
        externalMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
