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
  showWijken: true,
  showScannedScope: true,
  activeParcelOverlay: 'potential',
}

const STORAGE_KEY = 'propdex.map.layers.v2'

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function coerceBasemap(value: unknown): BaseMapLayerId {
  return value === 'aerial' ? 'aerial' : 'kaart'
}

export function readPersistedMapLayerState(): PersistedMapLayerState {
  if (typeof window === 'undefined') return DEFAULT_MAP_LAYER_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_MAP_LAYER_STATE
    const parsed = JSON.parse(raw) as Partial<PersistedMapLayerState>

    return {
      basemap: coerceBasemap(parsed.basemap),
      // Do not auto-restore parcel mode on refresh/login.
      // Parcel overlays should only activate after an explicit user action.
      showParcels: DEFAULT_MAP_LAYER_STATE.showParcels,
      showGemeenten: coerceBoolean(parsed.showGemeenten, DEFAULT_MAP_LAYER_STATE.showGemeenten),
      showBestemmingsplan: coerceBoolean(
        parsed.showBestemmingsplan,
        DEFAULT_MAP_LAYER_STATE.showBestemmingsplan
      ),
      showWijken: coerceBoolean(parsed.showWijken, DEFAULT_MAP_LAYER_STATE.showWijken),
      showScannedScope: coerceBoolean(
        parsed.showScannedScope,
        DEFAULT_MAP_LAYER_STATE.showScannedScope
      ),
      activeParcelOverlay: DEFAULT_MAP_LAYER_STATE.activeParcelOverlay,
    }
  } catch {
    return DEFAULT_MAP_LAYER_STATE
  }
}

export function writePersistedMapLayerState(
  state: PersistedMapLayerState
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable
  }
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
