# T01: 85-explorer-ui 01

**Slice:** S04 — **Milestone:** M001

## Description

Backend infrastructure for the Jurisprudentie Explorer: rechtsgronden AI classification, Alembic migration, faceted explorer endpoint with cross-filter counts, and offset pagination.

Purpose: Enable the frontend explorer page to query, filter, and paginate court rulings across all gemeenten with live facet counts per filter dimension.
Output: Working explorer API endpoint, rechtsgronden column with GIN index, extended AI classifier, backfill capability.

## Must-Haves

- [ ] "GET /api/jurisprudence/explorer returns paginated rulings with faceted counts for all filter dimensions"
- [ ] "Facet counts for each dimension are computed with all OTHER active filters applied (cross-faceted)"
- [ ] "rechtsgronden JSONB column exists on ruling_cache and is populated by AI classifier"
- [ ] "Existing analyzed rulings get rechtsgrond classification via backfill without full re-analysis"

## Files

- `backend/app/models/ruling_cache.py`
- `backend/alembic/versions/xxx_add_rechtsgronden_to_ruling_cache.py`
- `backend/app/ai/prompts.py`
- `backend/app/ai/schemas.py`
- `backend/app/ai/claude_client.py`
- `backend/app/api/endpoints/jurisprudence.py`
- `backend/app/jobs/jurisprudence_analysis.py`
