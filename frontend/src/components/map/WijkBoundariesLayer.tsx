import type maplibregl from 'maplibre-gl';
import { calculateBboxFromGeometry } from '@/lib/geo-utils';

const WIJK_SOURCE_ID = 'cbs-wijken';
const WIJK_FILL_LAYER = 'wijk-fill';
const WIJK_LINE_LAYER = 'wijk-line';
const WIJK_LABEL_LAYER = 'wijk-labels';

// Module-level cache for wijk GeoJSON (used for full geometry lookup on click)
let wijkGeoJSONData: GeoJSON.FeatureCollection | null = null;

// Track hovered wijk for feature-state management
let hoveredWijkId: string | null = null;

/**
 * Add CBS wijk boundary layer to the map with click, hover interaction, and labels.
 *
 * Creates three layers: fill layer with hover effect, line layer for borders,
 * and label layer for wijk names (visible at zoom 12+).
 * Layers are inserted before 'gemeente-fill' if it exists, ensuring wijken
 * render on top of gemeenten.
 *
 * Click handler extracts statcode, statnaam, bbox, and full geometry,
 * then invokes the provided callback.
 *
 * @param map - MapLibre GL JS map instance
 * @param geojson - CBS wijk GeoJSON FeatureCollection
 * @param onWijkClick - Callback invoked on wijk click with code, name, bbox, and geometry
 */
export function addWijkBoundariesLayer(
  map: maplibregl.Map,
  geojson: GeoJSON.FeatureCollection,
  onWijkClick: (
    wijkCode: string,
    wijkNaam: string,
    bbox: [number, number, number, number],
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  ) => void
): void {
  // Guard: source already exists
  if (map.getSource(WIJK_SOURCE_ID)) {
    return;
  }

  // Cache GeoJSON for full geometry lookup on click
  wijkGeoJSONData = geojson;

  // Add GeoJSON source with promoteId for feature-state
  map.addSource(WIJK_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
    promoteId: 'statcode', // Use statcode as feature ID for feature-state
  });

  // Determine insertion point (before gemeente layers if they exist)
  const beforeLayer = map.getLayer('gemeente-fill') ? 'gemeente-fill' : undefined;

  // Invisible fill layer for click/hover interaction (no visual fill —
  // parcel score colors must not be obscured by wijk fills).
  map.addLayer(
    {
      id: WIJK_FILL_LAYER,
      type: 'fill',
      source: WIJK_SOURCE_ID,
      paint: {
        'fill-color': '#10b981',
        'fill-opacity': 0,
      },
    },
    beforeLayer
  );

  // Add line layer for wijk borders (dashed — subordinate to parcel data)
  map.addLayer(
    {
      id: WIJK_LINE_LAYER,
      type: 'line',
      source: WIJK_SOURCE_ID,
      paint: {
        'line-color': '#10b981', // Emerald green
        'line-width': 1.5,
        'line-dasharray': [4, 3],
        'line-opacity': 0.6,
      },
    },
    beforeLayer
  );

  // Add label layer for wijk names (minzoom 12)
  map.addLayer(
    {
      id: WIJK_LABEL_LAYER,
      type: 'symbol',
      source: WIJK_SOURCE_ID,
      minzoom: 12,
      layout: {
        'text-field': ['get', 'statnaam'],
        'text-size': 12,
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#065f46', // Dark emerald
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    },
    beforeLayer
  );

  // Click handler - extract statcode, statnaam, bbox, and full geometry
  const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      if (!feature) return;

      const statcode = feature.properties?.statcode as string | undefined;
      const statnaam = feature.properties?.statnaam as string | undefined;

      if (!statcode || !statnaam) return;

      // Look up full geometry from cached GeoJSON — NOT from rendered feature,
      // because MapLibre clips rendered features to tile boundaries when zoomed in
      const fullFeature = wijkGeoJSONData?.features.find(
        (f) => f.properties?.statcode === statcode
      );
      const geometry = fullFeature?.geometry as
        | GeoJSON.Polygon
        | GeoJSON.MultiPolygon
        | undefined;

      if (
        geometry &&
        (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')
      ) {
        const bbox = calculateBboxFromGeometry(geometry);
        onWijkClick(statcode, statnaam, bbox, geometry);
      }
    }
  };

  // Mousemove handler - hover effect with feature-state
  const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      if (!feature) return;

      const currentId = feature.properties?.statcode as string | undefined;

      if (currentId && currentId !== hoveredWijkId) {
        // Clear previous hover state
        if (hoveredWijkId) {
          map.setFeatureState(
            { source: WIJK_SOURCE_ID, id: hoveredWijkId },
            { hover: false }
          );
        }

        // Set new hover state
        hoveredWijkId = currentId;
        map.setFeatureState(
          { source: WIJK_SOURCE_ID, id: hoveredWijkId },
          { hover: true }
        );
      }
    }
  };

  // Mouseleave handler - clear hover state
  const handleMouseLeave = () => {
    if (hoveredWijkId) {
      map.setFeatureState(
        { source: WIJK_SOURCE_ID, id: hoveredWijkId },
        { hover: false }
      );
      hoveredWijkId = null;
    }
    map.getCanvas().style.cursor = '';
  };

  // Mouseenter handler - change cursor
  const handleMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };

  // Attach event handlers to fill layer
  map.on('click', WIJK_FILL_LAYER, handleClick);
  map.on('mousemove', WIJK_FILL_LAYER, handleMouseMove);
  map.on('mouseleave', WIJK_FILL_LAYER, handleMouseLeave);
  map.on('mouseenter', WIJK_FILL_LAYER, handleMouseEnter);
}

/**
 * Remove CBS wijk boundary layer from the map.
 * Removes event handlers, layers, and source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeWijkBoundariesLayer(map: maplibregl.Map): void {
  // Clear hover state and reset cursor
  if (hoveredWijkId) {
    hoveredWijkId = null;
  }
  map.getCanvas().style.cursor = '';

  // Clear cached GeoJSON
  wijkGeoJSONData = null;

  // Remove layers (this also removes layer-specific event handlers)
  // Remove labels first, then line, then fill
  if (map.getLayer(WIJK_LABEL_LAYER)) {
    map.removeLayer(WIJK_LABEL_LAYER);
  }

  if (map.getLayer(WIJK_LINE_LAYER)) {
    map.removeLayer(WIJK_LINE_LAYER);
  }

  if (map.getLayer(WIJK_FILL_LAYER)) {
    map.removeLayer(WIJK_FILL_LAYER);
  }

  // Remove source
  if (map.getSource(WIJK_SOURCE_ID)) {
    map.removeSource(WIJK_SOURCE_ID);
  }
}

/**
 * Toggle visibility of wijk boundary layers (fill, line, and labels).
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layers should be visible
 */
export function setWijkBoundariesVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  if (!map.isStyleLoaded()) return;
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(WIJK_FILL_LAYER)) {
    map.setLayoutProperty(WIJK_FILL_LAYER, 'visibility', visibility);
  }

  if (map.getLayer(WIJK_LINE_LAYER)) {
    map.setLayoutProperty(WIJK_LINE_LAYER, 'visibility', visibility);
  }

  if (map.getLayer(WIJK_LABEL_LAYER)) {
    map.setLayoutProperty(WIJK_LABEL_LAYER, 'visibility', visibility);
  }
}
