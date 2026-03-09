import { useState, useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import ResultsTable from './ResultsTable'
import ResultsFilterPanel from './ResultsFilterPanel'
import { ParcelDetailModal } from './ParcelDetailModal'
import { setupParcelScoreClickHandler, setParcelScoreSelection } from '@/components/map/ParcelScoreLayer'
import type { ScanResultItem, ScanResultsFilters } from '@/lib/types/scan'

interface ResultsLayoutProps {
  scanId: string | null
  collapsed: boolean
  mapRef: React.RefObject<maplibregl.Map | null>
  onClose?: () => void
}

/** Minimum score for the "Top kansen" default preset — matches QUALIFICATION_THRESHOLD */
const SCORE_CUTOFF = 40

export default function ResultsLayout({ scanId, collapsed, mapRef, onClose }: ResultsLayoutProps) {
  const [filters, setFilters] = useState<ScanResultsFilters>({})
  const [showOnlyTop, setShowOnlyTop] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalUnfiltered, setTotalUnfiltered] = useState(0)
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)
  const selectionSourceRef = useRef<'table' | 'map' | null>(null)
  const [modalParcel, setModalParcel] = useState<ScanResultItem | null>(null)
  const hoveredParcelRef = useRef<string | number | null>(null)

  // Handle table row hover — highlight corresponding parcel on map
  const handleRowHover = useCallback(
    (parcelId: string | null) => {
      if (!mapRef.current) return
      const map = mapRef.current

      // Clear previous hover
      if (hoveredParcelRef.current !== null) {
        map.setFeatureState(
          {
            source: 'parcel-scores',
            sourceLayer: 'parcel_scores',
            id: hoveredParcelRef.current,
          },
          { hover: false }
        )
        hoveredParcelRef.current = null
      }

      if (parcelId) {
        // Find the feature by parcel_id property to get its numeric MVT ID
        const features = map.querySourceFeatures('parcel-scores', {
          sourceLayer: 'parcel_scores',
          filter: ['==', ['get', 'parcel_id'], parcelId],
        })
        const feature = features[0]
        if (feature !== undefined && feature.id !== undefined) {
          map.setFeatureState(
            {
              source: 'parcel-scores',
              sourceLayer: 'parcel_scores',
              id: feature.id,
            },
            { hover: true }
          )
          hoveredParcelRef.current = feature.id
        }
      }
    },
    [mapRef]
  )

  // Clear hover state when overlay collapses
  useEffect(() => {
    return () => {
      if (mapRef.current && hoveredParcelRef.current !== null) {
        mapRef.current.setFeatureState(
          {
            source: 'parcel-scores',
            sourceLayer: 'parcel_scores',
            id: hoveredParcelRef.current,
          },
          { hover: false }
        )
        hoveredParcelRef.current = null
      }
    }
  }, [collapsed, mapRef])

  // Setup map click handler for parcel selection
  useEffect(() => {
    if (collapsed || !mapRef.current) return
    const map = mapRef.current

    // Only setup if score layer exists
    if (!map.getSource('parcel-scores')) return

    const cleanup = setupParcelScoreClickHandler(map, (parcelId, featureId) => {
      selectionSourceRef.current = 'map'
      setSelectedParcelId(parcelId)
      // Highlight on map
      setParcelScoreSelection(map, featureId ?? null, 'parcel_scores')
    })

    return cleanup
  }, [collapsed, mapRef])

  // When selectedParcelId changes FROM TABLE (not map), fly to parcel and highlight
  useEffect(() => {
    if (!selectedParcelId || selectionSourceRef.current !== 'table') return
    if (!mapRef.current) return

    const map = mapRef.current
    const features = map.querySourceFeatures('parcel-scores', {
      sourceLayer: 'parcel_scores',
      filter: ['==', ['get', 'parcel_id'], selectedParcelId],
    })

    if (features.length > 0 && features[0]?.geometry) {
      // Get centroid of the first feature
      const geom = features[0].geometry
      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        // Calculate simple centroid from first ring
        const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0]?.[0]
        if (coords && coords.length > 0) {
          const sumLng = coords.reduce((s, c) => s + (c[0] ?? 0), 0)
          const sumLat = coords.reduce((s, c) => s + (c[1] ?? 0), 0)
          map.flyTo({
            center: [sumLng / coords.length, sumLat / coords.length],
            zoom: Math.max(map.getZoom(), 16),
            duration: 800,
          })
        }
      }

      // Highlight on map
      setParcelScoreSelection(map, features[0].id ?? null, 'parcel_scores')
    }
  }, [selectedParcelId, mapRef])

  return (
    <>
      {/* Left overlay panel — slides in from left over the persistent map */}
      <div
        className={`absolute left-0 top-0 h-full w-[45%] max-w-2xl
                    bg-aura-glass-white/60 border-r border-neutral-200
                    flex flex-col overflow-hidden
                    transition-transform duration-300 ease-out
                    ${collapsed ? '-translate-x-full' : 'translate-x-0'}`}
        style={{ zIndex: 'var(--z-sidebar)' }}
      >
        {/* Sticky header with title and close button */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-aura-ink">Scanresultaten</h2>
          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-aura-ink transition-colors"
            aria-label="Resultaten sluiten"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter panel */}
        {scanId && (
          <ResultsFilterPanel
            filters={filters}
            onChange={setFilters}
            total={total}
            totalUnfiltered={totalUnfiltered}
            showOnlyTop={showOnlyTop}
            onShowOnlyTopChange={setShowOnlyTop}
          />
        )}

        {/* Table scrolls within remaining space */}
        <div className="flex-1 overflow-hidden">
          {scanId && (
            <ResultsTable
              scanId={scanId}
              filters={{
                ...filters,
                ...(showOnlyTop
                  ? { min_score: SCORE_CUTOFF, exclude_null_scores: true }
                  : {}),
              }}
              selectedParcelId={selectedParcelId}
              onRowClick={(parcel) => {
                selectionSourceRef.current = 'table'
                setSelectedParcelId(parcel.parcel_id)
                setModalParcel(parcel)
              }}
              onTotalChange={setTotal}
              onTotalUnfilteredChange={setTotalUnfiltered}
              onRowHover={handleRowHover}
            />
          )}
        </div>
      </div>

      {/* Parcel detail modal */}
      <ParcelDetailModal
        parcel={modalParcel}
        isOpen={!!modalParcel}
        onClose={() => setModalParcel(null)}
        onViewOnMap={undefined}
      />
    </>
  )
}
