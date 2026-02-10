import type maplibregl from 'maplibre-gl';
import { CBS_GEMEENTEN_WFS } from '@/lib/pdok';

const GEMEENTE_SOURCE_ID = 'cbs-gemeenten';
const GEMEENTE_FILL_LAYER = 'gemeente-fill';
const GEMEENTE_LINE_LAYER = 'gemeente-line';

// Module-level cache for CBS gemeente GeoJSON
let gemeenteGeoJSONCache: GeoJSON.FeatureCollection | null = null;

// Track hovered gemeente for feature-state management
let hoveredGemeenteId: string | null = null;

/**
 * Fetch CBS gemeente boundaries from PDOK WFS.
 * Results are cached at module level to avoid redundant network requests.
 *
 * @returns Promise resolving to GeoJSON FeatureCollection with gemeente polygons
 */
export async function fetchGemeenteGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  if (gemeenteGeoJSONCache) {
    return gemeenteGeoJSONCache;
  }

  const response = await fetch(CBS_GEMEENTEN_WFS);

  if (!response.ok) {
    throw new Error(`Failed to fetch CBS gemeenten: ${response.statusText}`);
  }

  const geojson = (await response.json()) as GeoJSON.FeatureCollection;
  gemeenteGeoJSONCache = geojson;

  return geojson;
}

/**
 * Add CBS gemeente boundary layer to the map with click and hover interaction.
 *
 * Creates two layers: fill layer with hover effect and line layer for borders.
 * Layers are inserted before 'selected-property-fill' if it exists, ensuring
 * property click handlers take precedence.
 *
 * Click handler extracts statcode and statnaam from feature properties and
 * invokes the provided callback.
 *
 * @param map - MapLibre GL JS map instance
 * @param geojson - CBS gemeente GeoJSON FeatureCollection
 * @param onGemeenteClick - Callback invoked on gemeente click with code and name
 */
export function addGemeenteBoundariesLayer(
  map: maplibregl.Map,
  geojson: GeoJSON.FeatureCollection,
  onGemeenteClick: (gemeenteCode: string, gemeenteNaam: string) => void
): void {
  // Guard: source already exists
  if (map.getSource(GEMEENTE_SOURCE_ID)) {
    return;
  }

  // Add GeoJSON source with promoteId for feature-state
  map.addSource(GEMEENTE_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
    promoteId: 'statcode', // Use statcode as feature ID for feature-state
  });

  // Determine insertion point (before property layers if they exist)
  const beforeLayer = map.getLayer('selected-property-fill')
    ? 'selected-property-fill'
    : undefined;

  // Add fill layer with hover effect
  map.addLayer(
    {
      id: GEMEENTE_FILL_LAYER,
      type: 'fill',
      source: GEMEENTE_SOURCE_ID,
      paint: {
        'fill-color': 'var(--color-primary)',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.4, // Hover opacity
          0.15, // Default opacity
        ],
      },
    },
    beforeLayer
  );

  // Add line layer for gemeente borders
  map.addLayer(
    {
      id: GEMEENTE_LINE_LAYER,
      type: 'line',
      source: GEMEENTE_SOURCE_ID,
      paint: {
        'line-color': 'var(--color-primary)',
        'line-width': 1,
        'line-opacity': 0.5,
      },
    },
    beforeLayer
  );

  // Click handler - extract statcode and statnaam
  const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      if (!feature) return;

      const statcode = feature.properties?.statcode as string | undefined;
      const statnaam = feature.properties?.statnaam as string | undefined;

      if (statcode && statnaam) {
        onGemeenteClick(statcode, statnaam);
      }
    }
  };

  // Mousemove handler - hover effect with feature-state
  const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      if (!feature) return;

      const currentId = feature.properties?.statcode as string | undefined;

      if (currentId && currentId !== hoveredGemeenteId) {
        // Clear previous hover state
        if (hoveredGemeenteId) {
          map.setFeatureState(
            { source: GEMEENTE_SOURCE_ID, id: hoveredGemeenteId },
            { hover: false }
          );
        }

        // Set new hover state
        hoveredGemeenteId = currentId;
        map.setFeatureState(
          { source: GEMEENTE_SOURCE_ID, id: hoveredGemeenteId },
          { hover: true }
        );
      }
    }
  };

  // Mouseleave handler - clear hover state
  const handleMouseLeave = () => {
    if (hoveredGemeenteId) {
      map.setFeatureState(
        { source: GEMEENTE_SOURCE_ID, id: hoveredGemeenteId },
        { hover: false }
      );
      hoveredGemeenteId = null;
    }
    map.getCanvas().style.cursor = '';
  };

  // Mouseenter handler - change cursor
  const handleMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };

  // Attach event handlers to fill layer
  map.on('click', GEMEENTE_FILL_LAYER, handleClick);
  map.on('mousemove', GEMEENTE_FILL_LAYER, handleMouseMove);
  map.on('mouseleave', GEMEENTE_FILL_LAYER, handleMouseLeave);
  map.on('mouseenter', GEMEENTE_FILL_LAYER, handleMouseEnter);
}

/**
 * Remove CBS gemeente boundary layer from the map.
 * Removes event handlers, layers, and source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeGemeenteBoundariesLayer(map: maplibregl.Map): void {
  // Clear hover state and reset cursor
  if (hoveredGemeenteId) {
    hoveredGemeenteId = null;
  }
  map.getCanvas().style.cursor = '';

  // Remove layers (this also removes layer-specific event handlers)
  if (map.getLayer(GEMEENTE_LINE_LAYER)) {
    map.removeLayer(GEMEENTE_LINE_LAYER);
  }

  if (map.getLayer(GEMEENTE_FILL_LAYER)) {
    map.removeLayer(GEMEENTE_FILL_LAYER);
  }

  // Remove source
  if (map.getSource(GEMEENTE_SOURCE_ID)) {
    map.removeSource(GEMEENTE_SOURCE_ID);
  }
}

/**
 * Toggle visibility of gemeente boundary layers.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layers should be visible
 */
export function setGemeenteBoundariesVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(GEMEENTE_FILL_LAYER)) {
    map.setLayoutProperty(GEMEENTE_FILL_LAYER, 'visibility', visibility);
  }

  if (map.getLayer(GEMEENTE_LINE_LAYER)) {
    map.setLayoutProperty(GEMEENTE_LINE_LAYER, 'visibility', visibility);
  }
}
