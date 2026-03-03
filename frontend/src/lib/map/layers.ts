export type BaseMapLayerId = 'kaart' | 'aerial'

export type ParcelOverlayLayerId =
  | 'potential'
  | 'built_status'
  | 'report_coverage'
  | 'vacancy_signal'
  | 'build_capacity'

export interface PersistedMapLayerState {
  basemap: BaseMapLayerId
  showParcels: boolean
  showGemeenten: boolean
  showBestemmingsplan: boolean
  showBAGPanden: boolean
  showWijken: boolean
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
      label: 'Bebouwd/Leeg',
      description: 'Pand aanwezig versus onbebouwd perceel',
    },
    {
      id: 'report_coverage' as const,
      label: 'Rapporten',
      description: 'Percelen met bestaand rapport',
    },
    {
      id: 'vacancy_signal' as const,
      label: 'Leegstand',
      description: 'Leeg perceel, leegstaand pand of in gebruik',
    },
    {
      id: 'build_capacity' as const,
      label: 'Planruimte',
      description: 'Planruimte op basis van FAR/TAR-indicatoren',
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
  showWijken: false,
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
