# S09: Frontend Fysiek Risicoprofiel

**Goal:** Add a Fysiek Risicoprofiel section to ParcelDetailModal showing foundation risk, soil classification, asbestos exposure, and contamination data with amber confidence badges and indicatief disclaimers.
**Demo:** Add a Fysiek Risicoprofiel section to ParcelDetailModal showing foundation risk, soil classification, asbestos exposure, and contamination data with amber confidence badges and indicatief disclaimers.

## Must-Haves


## Tasks

- [x] **T01: 90-frontend-fysiek-risicoprofiel 01** `est:5min`
  - Add a Fysiek Risicoprofiel section to ParcelDetailModal showing foundation risk, soil classification, asbestos exposure, and contamination data with amber confidence badges and indicatief disclaimers.

Purpose: Let developers see hidden structural costs for any parcel directly from the scan results view, without needing to generate a full report first.
Output: Backend risk-profile endpoint, TypeScript types, FysiekRisicoProfiel section in ParcelDetailModal with 4 sub-cards.
- [x] **T02: 90-frontend-fysiek-risicoprofiel 02** `est:5min`
  - Add foundation risk level coloring to area scan map tiles so developers can visually identify parcels with potential foundation issues directly on the map.

Purpose: Enable spatial pattern recognition of foundation risk clusters across a gemeente, helping developers avoid areas with high structural risk or identify bulk acquisition opportunities.
Output: Backend tile_proxy exposes foundation_risk_level, frontend adds toggleable foundation risk overlay layer.

## Files Likely Touched

- `backend/app/scans/router.py`
- `backend/app/scans/schemas.py`
- `frontend/src/lib/types/property.ts`
- `frontend/src/lib/types/scan.ts`
- `frontend/src/hooks/useScans.ts`
- `frontend/src/components/results/ParcelDetailModal.tsx`
- `backend/app/services/tile_proxy.py`
- `frontend/src/components/map/ParcelScoreLayer.tsx`
- `frontend/src/lib/map/layers.ts`
- `frontend/src/lib/map/useMapLayerState.ts`
- `frontend/src/components/map/LayerToggle.tsx`
- `frontend/src/lib/api.ts`
