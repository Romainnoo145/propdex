# T01: 90-frontend-fysiek-risicoprofiel 01

**Slice:** S09 — **Milestone:** M001

## Description

Add a Fysiek Risicoprofiel section to ParcelDetailModal showing foundation risk, soil classification, asbestos exposure, and contamination data with amber confidence badges and indicatief disclaimers.

Purpose: Let developers see hidden structural costs for any parcel directly from the scan results view, without needing to generate a full report first.
Output: Backend risk-profile endpoint, TypeScript types, FysiekRisicoProfiel section in ParcelDetailModal with 4 sub-cards.

## Must-Haves

- [ ] "User sees Fysiek Risicoprofiel section in ParcelDetailModal with sub-cards for bodem, fundering, asbest, and verontreiniging"
- [ ] "All risk indicators display amber confidence badges with source attribution text"
- [ ] "Every risk sub-card shows an indicatief disclaimer"
- [ ] "Risk derivation is transparent -- user can see why a rating was assigned"
- [ ] "Risk data loads on-demand when modal opens (does not block initial modal render)"

## Files

- `backend/app/scans/router.py`
- `backend/app/scans/schemas.py`
- `frontend/src/lib/types/property.ts`
- `frontend/src/lib/types/scan.ts`
- `frontend/src/hooks/useScans.ts`
- `frontend/src/components/results/ParcelDetailModal.tsx`
