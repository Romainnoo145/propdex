/**
 * useMapLayerLifecycle — Centralized MapLibre layer lifecycle manager.
 *
 * Wraps all imperative MapLibre source/layer operations with:
 * 1. Style-readiness queuing — operations issued before style loads get queued
 *    and flushed on the `styledata` event.
 * 2. Idempotent add — `ensureSource`/`ensureLayer` check existence before adding.
 * 3. Safe remove — `removeLayer`/`removeSource` are no-ops if target doesn't exist.
 * 4. Visibility control that queues if the layer doesn't exist yet.
 * 5. GeoJSON source data updates that queue if the source doesn't exist yet.
 * 6. Automatic cleanup on unmount — all tracked sources/layers are removed.
 *
 * This hook manages the imperative MapLibre operations. It does NOT replace
 * `useMapLayerState`, which manages UI toggle state (booleans).
 */

import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type maplibregl from 'maplibre-gl'
// LayerOperation is exported from ./layers for external consumers.
// This hook uses its own internal QueuedOperation type.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Arguments for ensureSource — matches maplibre addSource signature. */
interface EnsureSourceArgs {
  id: string
  spec: maplibregl.SourceSpecification
}

/** Arguments for ensureLayer — matches maplibre addLayer signature. */
interface EnsureLayerArgs {
  layer: maplibregl.AddLayerObject
  beforeId?: string
}

/** Arguments for setVisibility. */
interface SetVisibilityArgs {
  layerId: string
  visible: boolean
}

/** Arguments for updateGeoJSONSource. */
interface UpdateGeoJSONSourceArgs {
  sourceId: string
  data: GeoJSON.GeoJSON
}

/** Arguments for removeLayer. */
interface RemoveLayerArgs {
  layerId: string
}

/** Arguments for removeSource. */
interface RemoveSourceArgs {
  sourceId: string
}

/** A queued operation — discriminated union over operation type. */
type QueuedOperation =
  | { type: 'ensureSource'; args: EnsureSourceArgs }
  | { type: 'ensureLayer'; args: EnsureLayerArgs }
  | { type: 'removeLayer'; args: RemoveLayerArgs }
  | { type: 'removeSource'; args: RemoveSourceArgs }
  | { type: 'setVisibility'; args: SetVisibilityArgs }
  | { type: 'updateGeoJSON'; args: UpdateGeoJSONSourceArgs }

// ---------------------------------------------------------------------------
// Internal helpers (pure functions, no React)
// ---------------------------------------------------------------------------

function isStyleReady(map: maplibregl.Map): boolean {
  try {
    return map.isStyleLoaded() === true
  } catch {
    // Map may be removed — treat as not ready
    return false
  }
}

function execEnsureSource(map: maplibregl.Map, args: EnsureSourceArgs): void {
  if (map.getSource(args.id)) return
  map.addSource(args.id, args.spec)
}

function execEnsureLayer(map: maplibregl.Map, args: EnsureLayerArgs): void {
  if (map.getLayer(args.layer.id)) return
  map.addLayer(args.layer, args.beforeId)
}

function execRemoveLayer(map: maplibregl.Map, args: RemoveLayerArgs): void {
  if (!map.getLayer(args.layerId)) return
  map.removeLayer(args.layerId)
}

function execRemoveSource(map: maplibregl.Map, args: RemoveSourceArgs): void {
  if (!map.getSource(args.sourceId)) return
  map.removeSource(args.sourceId)
}

function execSetVisibility(map: maplibregl.Map, args: SetVisibilityArgs): void {
  if (!map.getLayer(args.layerId)) return
  map.setLayoutProperty(args.layerId, 'visibility', args.visible ? 'visible' : 'none')
}

function execUpdateGeoJSON(map: maplibregl.Map, args: UpdateGeoJSONSourceArgs): void {
  const source = map.getSource(args.sourceId) as maplibregl.GeoJSONSource | undefined
  if (!source) return
  source.setData(args.data)
}

function execOperation(map: maplibregl.Map, op: QueuedOperation): void {
  switch (op.type) {
    case 'ensureSource':
      execEnsureSource(map, op.args)
      break
    case 'ensureLayer':
      execEnsureLayer(map, op.args)
      break
    case 'removeLayer':
      execRemoveLayer(map, op.args)
      break
    case 'removeSource':
      execRemoveSource(map, op.args)
      break
    case 'setVisibility':
      execSetVisibility(map, op.args)
      break
    case 'updateGeoJSON':
      execUpdateGeoJSON(map, op.args)
      break
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface MapLayerLifecycle {
  /**
   * Add a source if it doesn't already exist.
   * Queues the operation if the style isn't loaded yet.
   */
  ensureSource: (id: string, spec: maplibregl.SourceSpecification) => void

  /**
   * Add a layer if it doesn't already exist.
   * Queues the operation if the style isn't loaded yet.
   * @param layer — full layer spec (id, type, source, paint, etc.)
   * @param beforeId — optional layer ID to insert before (z-ordering)
   */
  ensureLayer: (layer: maplibregl.AddLayerObject, beforeId?: string) => void

  /**
   * Remove a layer. No-op if it doesn't exist.
   * Queues the operation if the style isn't loaded yet.
   */
  removeLayer: (layerId: string) => void

  /**
   * Remove a source. No-op if it doesn't exist.
   * Queues the operation if the style isn't loaded yet.
   */
  removeSource: (sourceId: string) => void

  /**
   * Set layer visibility. No-op if layer doesn't exist.
   * Queues if style isn't loaded yet.
   */
  setVisibility: (layerId: string, visible: boolean) => void

  /**
   * Update a GeoJSON source's data. No-op if source doesn't exist.
   * Queues if style isn't loaded yet.
   */
  updateGeoJSONSource: (sourceId: string, data: GeoJSON.GeoJSON) => void

  /**
   * Queue a raw operation. Flushes immediately if style is ready,
   * otherwise deferred until styledata fires.
   */
  queueOperation: (op: QueuedOperation) => void

  /**
   * Track a source ID for automatic cleanup on unmount.
   * (ensureSource auto-tracks, but this lets you register externally-created sources.)
   */
  trackSource: (sourceId: string) => void

  /**
   * Track a layer ID for automatic cleanup on unmount.
   * (ensureLayer auto-tracks, but this lets you register externally-created layers.)
   */
  trackLayer: (layerId: string) => void

  /**
   * Untrack a source so it won't be removed on unmount.
   * Useful when ownership transfers to another component.
   */
  untrackSource: (sourceId: string) => void

  /**
   * Untrack a layer so it won't be removed on unmount.
   */
  untrackLayer: (layerId: string) => void
}

export function useMapLayerLifecycle(
  mapRef: RefObject<maplibregl.Map | null>,
  mapReady: boolean,
): MapLayerLifecycle {
  // Pending operation queue — flushed when style becomes ready.
  const queueRef = useRef<QueuedOperation[]>([])

  // Track sources and layers we've added, for cleanup on unmount.
  const trackedSourcesRef = useRef<Set<string>>(new Set())
  const trackedLayersRef = useRef<Set<string>>(new Set())

  // Whether we've attached the styledata listener.
  const listenerAttachedRef = useRef(false)

  // Stable ref to the flush function so the styledata listener always
  // calls the latest version without re-attaching.
  const flushRef = useRef<() => void>(() => {})

  // -----------------------------------------------------------------------
  // Flush pending queue
  // -----------------------------------------------------------------------
  const flush = useCallback(() => {
    const map = mapRef.current
    if (!map || !isStyleReady(map)) return

    const pending = queueRef.current.splice(0)
    for (const op of pending) {
      try {
        execOperation(map, op)
      } catch (err) {
        // Defensive — don't let one failed op block the rest.
        console.warn('[useMapLayerLifecycle] operation failed:', op.type, err)
      }
    }
  }, [mapRef])

  // Keep flushRef current.
  flushRef.current = flush

  // -----------------------------------------------------------------------
  // Attach styledata listener once when map is available.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // If style is already loaded, flush immediately.
    if (isStyleReady(map)) {
      flush()
    }

    if (listenerAttachedRef.current) return
    listenerAttachedRef.current = true

    const onStyleData = () => {
      flushRef.current()
    }

    map.on('styledata', onStyleData)

    return () => {
      map.off('styledata', onStyleData)
      listenerAttachedRef.current = false
    }
  }, [mapRef, mapReady, flush])

  // -----------------------------------------------------------------------
  // Enqueue-or-execute helper
  // -----------------------------------------------------------------------
  const enqueue = useCallback(
    (op: QueuedOperation) => {
      const map = mapRef.current
      if (map && isStyleReady(map)) {
        try {
          execOperation(map, op)
        } catch (err) {
          console.warn('[useMapLayerLifecycle] operation failed:', op.type, err)
        }
      } else {
        queueRef.current.push(op)
      }
    },
    [mapRef],
  )

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  const ensureSource = useCallback(
    (id: string, spec: maplibregl.SourceSpecification) => {
      trackedSourcesRef.current.add(id)
      enqueue({ type: 'ensureSource', args: { id, spec } })
    },
    [enqueue],
  )

  const ensureLayer = useCallback(
    (layer: maplibregl.AddLayerObject, beforeId?: string) => {
      trackedLayersRef.current.add(layer.id)
      enqueue({ type: 'ensureLayer', args: { layer, beforeId } })
    },
    [enqueue],
  )

  const removeLayer = useCallback(
    (layerId: string) => {
      trackedLayersRef.current.delete(layerId)
      enqueue({ type: 'removeLayer', args: { layerId } })
    },
    [enqueue],
  )

  const removeSource = useCallback(
    (sourceId: string) => {
      trackedSourcesRef.current.delete(sourceId)
      enqueue({ type: 'removeSource', args: { sourceId } })
    },
    [enqueue],
  )

  const setVisibility = useCallback(
    (layerId: string, visible: boolean) => {
      enqueue({ type: 'setVisibility', args: { layerId, visible } })
    },
    [enqueue],
  )

  const updateGeoJSONSource = useCallback(
    (sourceId: string, data: GeoJSON.GeoJSON) => {
      enqueue({ type: 'updateGeoJSON', args: { sourceId, data } })
    },
    [enqueue],
  )

  const queueOperation = useCallback(
    (op: QueuedOperation) => {
      enqueue(op)
    },
    [enqueue],
  )

  const trackSource = useCallback((sourceId: string) => {
    trackedSourcesRef.current.add(sourceId)
  }, [])

  const trackLayer = useCallback((layerId: string) => {
    trackedLayersRef.current.add(layerId)
  }, [])

  const untrackSource = useCallback((sourceId: string) => {
    trackedSourcesRef.current.delete(sourceId)
  }, [])

  const untrackLayer = useCallback((layerId: string) => {
    trackedLayersRef.current.delete(layerId)
  }, [])

  // -----------------------------------------------------------------------
  // Cleanup on unmount — remove all tracked layers then sources.
  // -----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      const map = mapRef.current
      if (!map) return

      // Clear pending queue — no point executing after unmount.
      queueRef.current = []

      // Remove layers first (layers depend on sources).
      for (const layerId of trackedLayersRef.current) {
        try {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId)
          }
        } catch {
          // Map may already be removed.
        }
      }

      // Remove sources.
      for (const sourceId of trackedSourcesRef.current) {
        try {
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
          }
        } catch {
          // Map may already be removed.
        }
      }

      trackedLayersRef.current.clear()
      trackedSourcesRef.current.clear()
    }
    // Intentionally only on unmount — mapRef is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ensureSource,
    ensureLayer,
    removeLayer,
    removeSource,
    setVisibility,
    updateGeoJSONSource,
    queueOperation,
    trackSource,
    trackLayer,
    untrackSource,
    untrackLayer,
  }
}
