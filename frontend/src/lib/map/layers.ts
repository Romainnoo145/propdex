// ---------------------------------------------------------------------------
// Layer lifecycle operation types (used by useMapLayerLifecycle)
// ---------------------------------------------------------------------------

/**
 * Discriminated union for all map layer operations that can be queued
 * through the lifecycle manager. Exported for consumers that need
 * to build operations programmatically (e.g. batch layer setup).
 */
export type LayerOperation =
  | { type: 'ensureSource'; id: string; spec: unknown }
  | { type: 'ensureLayer'; layer: unknown; beforeId?: string }
  | { type: 'removeLayer'; layerId: string }
  | { type: 'removeSource'; sourceId: string }
  | { type: 'setVisibility'; layerId: string; visible: boolean }
  | { type: 'updateGeoJSON'; sourceId: string; data: GeoJSON.GeoJSON }

// ---------------------------------------------------------------------------
// Layer state types
// ---------------------------------------------------------------------------

export type BaseMapLayerId = 'kaart' | 'aerial'

export type ParcelOverlayLayerId =
  | 'potential'
  | 'built_status'
  | 'report_coverage'
  | 'vacancy_signal'
  | 'build_capacity'
  | 'foundation_risk'
  | 'bestemmingsplan'

export interface PersistedMapLayerState {
  basemap: BaseMapLayerId
  showParcels: boolean
  showGemeenten: boolean
  showBestemmingsplan: boolean
  showBAGPanden: boolean
  showScannedScope: boolean
  activeParcelOverlay: ParcelOverlayLayerId | null
}

export const MAP_LAYER_CATALOG = {
  parcelOverlays: [
    {
      id: 'potential' as const,
      label: 'Potentie',
      description: 'Onderbenutting en kansscore per perceel',
    },
    {
      id: 'built_status' as const,
      label: 'Leegstand',
      description: 'Bebouwd versus onbebouwd perceel',
    },
    {
      id: 'report_coverage' as const,
      label: 'Opgeslagen',
      description: 'Percelen die je hebt opgeslagen',
    },
    {
      id: 'bestemmingsplan' as const,
      label: 'Bestemmingsplan',
      description: 'Bestemmingsvlakken en functieaanduidingen',
    },
  ],
  boundaryOverlays: [
    {
      id: 'scanned_scope' as const,
      label: 'Scangebied',
      description: 'Wijken met afgeronde scans',
    },
  ],
} as const

export const DEFAULT_MAP_LAYER_STATE: PersistedMapLayerState = {
  basemap: 'kaart',
  showParcels: false,
  showGemeenten: false,
  showBestemmingsplan: false,
  showBAGPanden: false,
  showScannedScope: false,
  activeParcelOverlay: null,
}

export function readPersistedMapLayerState(): PersistedMapLayerState {
  // Always start with a clean map — no localStorage persistence.
  return DEFAULT_MAP_LAYER_STATE
}

export function writePersistedMapLayerState(
  _state: PersistedMapLayerState
): void {
  // No-op — map always starts clean, no persistence.
}

export function updatePersistedMapLayerState(
  partial: Partial<PersistedMapLayerState>
): PersistedMapLayerState {
  const next = {
    ...readPersistedMapLayerState(),
    ...partial,
  }
  writePersistedMapLayerState(next)
  return next
}
