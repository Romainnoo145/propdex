import { useEffect, useRef, useState } from 'react';
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

function isWebGlInitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('webgl') || message.includes('context')
  }

  if (typeof error === 'object' && error !== null) {
    const message = String((error as { message?: unknown }).message ?? '').toLowerCase()
    const type = String((error as { type?: unknown }).type ?? '').toLowerCase()
    return (
      message.includes('webgl') ||
      message.includes('context') ||
      type.includes('webgl')
    )
  }

  return false
}

export default function MapView({
  mapRef: externalMapRef,
  onMapReady,
  transformRequest,
}: MapViewProps) {
  const internalMapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: maplibregl.Map | null = null;

    try {
      setMapError(null);
      const createdMap = new maplibregl.Map({
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
              paint: {
                'raster-saturation': -0.85,
                'raster-brightness-min': 0.08,
                'raster-brightness-max': 0.92,
                'raster-contrast': -0.05,
              },
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
      map = createdMap;

      createdMap.addControl(new maplibregl.NavigationControl(), 'top-right');
      createdMap.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        'top-right'
      );

      internalMapRef.current = createdMap;
      if (externalMapRef) {
        externalMapRef.current = createdMap;
      }

      createdMap.on('load', () => {
        if (onMapReady) {
          onMapReady(createdMap);
        }
      });

      createdMap.on('error', (event) => {
        if (!isWebGlInitError(event?.error ?? event)) return;
        setMapError('Kaart kon geen WebGL-context starten. Controleer browser-GPU instellingen of herstart de browser.')
      });
    } catch (error) {
      const fallbackMessage = isWebGlInitError(error)
        ? 'Kaart kon geen WebGL-context starten. Controleer browser-GPU instellingen of herstart de browser.'
        : 'Kaart kon niet geladen worden.'
      setMapError(fallbackMessage)
    }

    return () => {
      map?.remove();
      internalMapRef.current = null;
      if (externalMapRef) {
        externalMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mapError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-grey-950 px-6">
        <div className="w-full max-w-xl rounded-2xl border border-overlay/[0.08] bg-overlay/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-grey-500">Kaart niet beschikbaar</p>
          <h2 className="mt-3 text-lg font-semibold text-grey-100">WebGL kon niet worden gestart</h2>
          <p className="mt-2 text-sm leading-6 text-grey-400">{mapError}</p>
          <p className="mt-4 text-xs leading-5 text-grey-500">
            Probeer Chrome volledig te herstarten, hardwareversnelling weer aan te zetten, of open Propdex opnieuw.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
