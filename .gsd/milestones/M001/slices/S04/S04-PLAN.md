# S04: Explorer Ui

**Goal:** Backend infrastructure for the Jurisprudentie Explorer: rechtsgronden AI classification, Alembic migration, faceted explorer endpoint with cross-filter counts, and offset pagination.
**Demo:** Backend infrastructure for the Jurisprudentie Explorer: rechtsgronden AI classification, Alembic migration, faceted explorer endpoint with cross-filter counts, and offset pagination.

## Must-Haves


## Tasks

- [x] **T01: 85-explorer-ui 01** `est:4min`
  - Backend infrastructure for the Jurisprudentie Explorer: rechtsgronden AI classification, Alembic migration, faceted explorer endpoint with cross-filter counts, and offset pagination.

Purpose: Enable the frontend explorer page to query, filter, and paginate court rulings across all gemeenten with live facet counts per filter dimension.
Output: Working explorer API endpoint, rechtsgronden column with GIN index, extended AI classifier, backfill capability.
- [x] **T02: 85-explorer-ui 02** `est:4min`
  - Frontend Jurisprudentie Explorer page: standalone `/jurisprudentie` route with filter sidebar, ruling cards, infinite scroll pagination, and broaden-search suggestions.

Purpose: Provide vastgoedontwikkelaars with a polished cross-gemeente court ruling search tool that demonstrates strategic value of the platform to investors.
Output: Working `/jurisprudentie` page accessible from side rail, with filtering, pagination, and empty-state handling.

## Files Likely Touched

- `backend/app/models/ruling_cache.py`
- `backend/alembic/versions/xxx_add_rechtsgronden_to_ruling_cache.py`
- `backend/app/ai/prompts.py`
- `backend/app/ai/schemas.py`
- `backend/app/ai/claude_client.py`
- `backend/app/api/endpoints/jurisprudence.py`
- `backend/app/jobs/jurisprudence_analysis.py`
- `frontend/src/routes/_authenticated/jurisprudentie.tsx`
- `frontend/src/hooks/useExplorer.ts`
- `frontend/src/components/jurisprudentie/ExplorerFilterSidebar.tsx`
- `frontend/src/components/jurisprudentie/RulingCard.tsx`
- `frontend/src/components/jurisprudentie/BroadenSuggestion.tsx`
- `frontend/src/components/layout/SideRailNav.tsx`
- `frontend/src/lib/api.ts`
