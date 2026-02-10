import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ESRI_SATELLITE_TILES,
  CARTO_LIGHT_TILES,
  ESRI_SATELLITE_ATTRIBUTION,
  CARTO_ATTRIBUTION,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
} from '@/lib/pdok';

interface MapViewProps {
  mapRef?: React.MutableRefObject<maplibregl.Map | null>;
  onMapReady?: (map: maplibregl.Map) => void;
  transformRequest?: maplibregl.RequestTransformFunction;
}

export default function MapView({
  mapRef: externalMapRef,
  onMapReady,
  transformRequest,
}: MapViewProps) {
  const internalMapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      transformRequest,
      style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [ESRI_SATELLITE_TILES],
            tileSize: 256,
            attribution: ESRI_SATELLITE_ATTRIBUTION,
            maxzoom: 19,
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
            id: 'esri-satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
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
