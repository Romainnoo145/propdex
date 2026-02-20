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
 * Renders property polygon in blue and parcel polygons in amber
 */
export function updatePropertyGeometry(
  map: maplibregl.Map,
  data: PropertyReportResponse
): void {
  // Clear existing layers first
  clearPropertyGeometry(map);

  // Add property geometry if available
  if (data.map_data?.property_geometry) {
    map.addSource(PROPERTY_SOURCE, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: data.map_data.property_geometry as unknown as GeoJSON.Geometry,
        properties: {},
      },
    });

    // Fill layer
    map.addLayer({
      id: PROPERTY_FILL_LAYER,
      type: 'fill',
      source: PROPERTY_SOURCE,
      paint: {
        'fill-color': '#d97706',
        'fill-opacity': 0.15,
      },
    });

    // Line layer
    map.addLayer({
      id: PROPERTY_LINE_LAYER,
      type: 'line',
      source: PROPERTY_SOURCE,
      paint: {
        'line-color': '#d97706',
        'line-width': 2,
        'line-opacity': 0.8,
      },
    });
  }

  // Add parcel geometries if available
  if (data.cadastral_parcels && data.cadastral_parcels.length > 0) {
    const parcelFeatures = data.cadastral_parcels
      .filter((parcel) => parcel.geometry)
      .map((parcel) => ({
        type: 'Feature' as const,
        geometry: parcel.geometry as unknown as GeoJSON.Geometry,
        properties: {
          kadastrale_aanduiding: parcel.kadastrale_aanduiding ?? '',
        },
      }));

    if (parcelFeatures.length > 0) {
      map.addSource(PARCEL_SOURCE, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: parcelFeatures,
        },
      });

      // Fill layer for parcels
      map.addLayer({
        id: PARCEL_FILL_LAYER,
        type: 'fill',
        source: PARCEL_SOURCE,
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.08,
        },
      });

      // Dashed line layer for parcels
      map.addLayer({
        id: PARCEL_LINE_LAYER,
        type: 'line',
        source: PARCEL_SOURCE,
        paint: {
          'line-color': '#f59e0b',
          'line-width': 1.5,
          'line-dasharray': [4, 2],
        },
      });
    }
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
