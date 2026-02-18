import type maplibregl from 'maplibre-gl';
import type { PropertyReportResponse } from '@/lib/types/property';

const PROPERTY_SOURCE = 'selected-property';
const PROPERTY_FILL_LAYER = 'selected-property-fill';
const PROPERTY_LINE_LAYER = 'selected-property-line';
const PARCEL_SOURCE = 'selected-parcels';
const PARCEL_FILL_LAYER = 'selected-parcels-fill';
const PARCEL_LINE_LAYER = 'selected-parcels-line';

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

  // Fly to property center
  if (
    data.map_data?.center_wgs84 &&
    data.map_data.center_wgs84.length >= 2
  ) {
    map.flyTo({
      center: [
        data.map_data.center_wgs84[0] as number,
        data.map_data.center_wgs84[1] as number,
      ],
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
  const sources = [PROPERTY_SOURCE, PARCEL_SOURCE];

  for (const sourceId of sources) {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }
}
