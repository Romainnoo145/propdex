import type maplibregl from 'maplibre-gl';
import type { PropertyReportResponse } from '@/lib/types/property';

const PROPERTY_SOURCE = 'selected-property';
const PROPERTY_FILL_LAYER = 'selected-property-fill';
const PROPERTY_LINE_LAYER = 'selected-property-line';
const PARCEL_SOURCE = 'selected-parcels';
const PARCEL_FILL_LAYER = 'selected-parcels-fill';
const PARCEL_LINE_LAYER = 'selected-parcels-line';
const CENTER_MARKER_SOURCE = 'property-center-marker';
const CENTER_MARKER_LAYER = 'property-center-marker-circle';
const CENTER_MARKER_PULSE_LAYER = 'property-center-marker-pulse';

/**
 * Update property geometry on the map
 * Renders parcel polygons as primary highlight and (when available)
 * building/property geometry as a secondary overlay.
 */
export function updatePropertyGeometry(
  map: maplibregl.Map,
  data: PropertyReportResponse
): void {
  // Clear existing layers first
  clearPropertyGeometry(map);

  const parcelFeaturesFromCadastral = (data.cadastral_parcels ?? [])
    .filter((parcel) => parcel.geometry)
    .map((parcel) => ({
      type: 'Feature' as const,
      geometry: parcel.geometry as unknown as GeoJSON.Geometry,
      properties: {
        kadastrale_aanduiding: parcel.kadastrale_aanduiding ?? '',
      },
    }));

  const parcelFeaturesFromMapData = (data.map_data?.parcel_geometries ?? [])
    .filter((geometry) => !!geometry)
    .map((geometry, index) => ({
      type: 'Feature' as const,
      geometry: geometry as unknown as GeoJSON.Geometry,
      properties: {
        kadastrale_aanduiding: `perceel-${index + 1}`,
      },
    }));

  const parcelFeatures =
    parcelFeaturesFromCadastral.length > 0
      ? parcelFeaturesFromCadastral
      : parcelFeaturesFromMapData

  if (parcelFeatures.length > 0) {
    map.addSource(PARCEL_SOURCE, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: parcelFeatures,
      },
    });

    // Primary parcel fill + border (green — distinct from amber overlays).
    map.addLayer({
      id: PARCEL_FILL_LAYER,
      type: 'fill',
      source: PARCEL_SOURCE,
      paint: {
        'fill-color': '#22c55e',
        'fill-opacity': 0.18,
      },
    });

    map.addLayer({
      id: PARCEL_LINE_LAYER,
      type: 'line',
      source: PARCEL_SOURCE,
      paint: {
        'line-color': '#16a34a',
        'line-width': 2.5,
        'line-opacity': 0.95,
      },
    });
  }

  // Secondary building/property overlay (inside parcel when available).
  if (data.map_data?.property_geometry) {
    map.addSource(PROPERTY_SOURCE, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: data.map_data.property_geometry as unknown as GeoJSON.Geometry,
        properties: {},
      },
    });

    map.addLayer({
      id: PROPERTY_FILL_LAYER,
      type: 'fill',
      source: PROPERTY_SOURCE,
      paint: {
        'fill-color': '#a3e635',
        'fill-opacity': 0.08,
      },
    });

    map.addLayer({
      id: PROPERTY_LINE_LAYER,
      type: 'line',
      source: PROPERTY_SOURCE,
      paint: {
        'line-color': '#a3e635',
        'line-width': 1.6,
        'line-opacity': 0.9,
        'line-dasharray': [2, 2],
      },
    });
  }

  // Add amber center marker
  if (
    data.map_data?.center_wgs84 &&
    data.map_data.center_wgs84.length >= 2
  ) {
    const center: [number, number] = [
      data.map_data.center_wgs84[0] as number,
      data.map_data.center_wgs84[1] as number,
    ];

    map.addSource(CENTER_MARKER_SOURCE, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: center },
        properties: {},
      },
    });

    // Outer pulse ring
    map.addLayer({
      id: CENTER_MARKER_PULSE_LAYER,
      type: 'circle',
      source: CENTER_MARKER_SOURCE,
      paint: {
        'circle-radius': 14,
        'circle-color': '#f59e0b',
        'circle-opacity': 0.15,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#f59e0b',
        'circle-stroke-opacity': 0.3,
      },
    });

    // Inner solid marker
    map.addLayer({
      id: CENTER_MARKER_LAYER,
      type: 'circle',
      source: CENTER_MARKER_SOURCE,
      paint: {
        'circle-radius': 6,
        'circle-color': '#f59e0b',
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.8,
      },
    });

    // Fly to property center
    map.flyTo({
      center,
      zoom: 17,
      duration: 1000,
    });
  }
}

/**
 * Clear property and parcel geometry from the map
 */
export function clearPropertyGeometry(map: maplibregl.Map): void {
  // Remove layers (must be removed before sources)
  const layers = [
    CENTER_MARKER_LAYER,
    CENTER_MARKER_PULSE_LAYER,
    PROPERTY_LINE_LAYER,
    PROPERTY_FILL_LAYER,
    PARCEL_LINE_LAYER,
    PARCEL_FILL_LAYER,
  ];

  for (const layerId of layers) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }

  // Remove sources
  const sources = [CENTER_MARKER_SOURCE, PROPERTY_SOURCE, PARCEL_SOURCE];

  for (const sourceId of sources) {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }
}
