import { useState, useCallback, useEffect } from 'react'
import type { PersistedMapLayerState, BaseMapLayerId, ParcelOverlayLayerId } from './layers'
import { readPersistedMapLayerState, writePersistedMapLayerState } from './layers'

// MapLayerState is the full runtime state shape for the hook.
// It currently matches PersistedMapLayerState exactly, but non-persisted fields
// (e.g. mapReady) can be added here later without changing the persisted type.
export type MapLayerState = PersistedMapLayerState

export interface MapLayerActions {
  setBasemap: (v: BaseMapLayerId) => void
  toggleParcels: () => void
  setParcels: (v: boolean) => void
  toggleGemeenten: () => void
  setGemeenten: (v: boolean) => void
  toggleBestemmingsplan: () => void
  setBestemmingsplan: (v: boolean) => void
  setActiveParcelOverlay: (v: ParcelOverlayLayerId | null) => void
}

export function useMapLayerState() {
  const [state, setState] = useState<MapLayerState>(readPersistedMapLayerState)

  useEffect(() => {
    writePersistedMapLayerState(state)
  }, [state])

  const setBasemap = useCallback(
    (v: BaseMapLayerId) => setState((s) => ({ ...s, basemap: v })),
    []
  )

  const toggleParcels = useCallback(
    () => setState((s) => ({ ...s, showParcels: !s.showParcels })),
    []
  )

  const setParcels = useCallback(
    (v: boolean) => setState((s) => ({ ...s, showParcels: v })),
    []
  )

  const toggleGemeenten = useCallback(
    () => setState((s) => ({ ...s, showGemeenten: !s.showGemeenten })),
    []
  )

  const setGemeenten = useCallback(
    (v: boolean) => setState((s) => ({ ...s, showGemeenten: v })),
    []
  )

  const toggleBestemmingsplan = useCallback(
    () => setState((s) => ({ ...s, showBestemmingsplan: !s.showBestemmingsplan })),
    []
  )

  const setBestemmingsplan = useCallback(
    (v: boolean) => setState((s) => ({ ...s, showBestemmingsplan: v })),
    []
  )

  const setActiveParcelOverlay = useCallback(
    (v: ParcelOverlayLayerId | null) => setState((s) => ({ ...s, activeParcelOverlay: v })),
    []
  )

  const actions: MapLayerActions = {
    setBasemap,
    toggleParcels,
    setParcels,
    toggleGemeenten,
    setGemeenten,
    toggleBestemmingsplan,
    setBestemmingsplan,
    setActiveParcelOverlay,
  }

  return { state, actions } as const
}
