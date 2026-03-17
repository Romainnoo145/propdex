# T02: 90-frontend-fysiek-risicoprofiel 02

**Slice:** S09 — **Milestone:** M001

## Description

Add foundation risk level coloring to area scan map tiles so developers can visually identify parcels with potential foundation issues directly on the map.

Purpose: Enable spatial pattern recognition of foundation risk clusters across a gemeente, helping developers avoid areas with high structural risk or identify bulk acquisition opportunities.
Output: Backend tile_proxy exposes foundation_risk_level, frontend adds toggleable foundation risk overlay layer.

## Must-Haves

- [ ] "Area scan map tiles color parcels by foundation risk level alongside existing opportunity score"
- [ ] "User can toggle the foundation risk overlay from the layer toggle menu"
- [ ] "Pre-1970 parcels show distinct coloring from post-1970 parcels"

## Files

- `backend/app/services/tile_proxy.py`
- `frontend/src/components/map/ParcelScoreLayer.tsx`
- `frontend/src/lib/map/layers.ts`
- `frontend/src/lib/map/useMapLayerState.ts`
- `frontend/src/components/map/LayerToggle.tsx`
- `frontend/src/lib/api.ts`
