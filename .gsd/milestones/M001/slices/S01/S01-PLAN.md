# S01: Ruling Cache Ecli Mapping

**Goal:** Create the data foundation for v13.
**Demo:** Create the data foundation for v13.

## Must-Haves


## Tasks

- [x] **T01: 82-ruling-cache-ecli-mapping 01** `est:4min`
  - Create the data foundation for v13.0 Juridisch Klimaat Intelligence: the EcliRegistry module mapping 342 Dutch gemeenten to 11 rechtbanken (plus 16 pre-2013 court codes), and the RulingCache PostgreSQL table for persistent, org-agnostic court ruling storage.

Purpose: All downstream v13.0 features (geo-extraction, AI analysis, feed, explorer) depend on knowing which court handles a gemeente and having a persistent ruling store. Without this, searches continue using garbage national free-text queries.

Output: `ecli_registry.py` module, `ruling_cache.py` model, Alembic migration
- [x] **T02: 82-ruling-cache-ecli-mapping 02** `est:3min`
  - Extend RechtspraakClient with court-code-scoped search and date range filtering, create the ARQ ingestion job that populates ruling_cache, and wire the jurisprudence endpoint to serve cached rulings with automatic background re-ingestion on cache miss/expiry.

Purpose: This makes the jurisprudence feature actually useful -- results are scoped to the correct arrondissement instead of national free-text garbage, cached persistently, and auto-populated on first gemeente view.

Output: Refactored `rechtspraak.py`, new `ruling_ingestion.py` job, updated `worker.py` and `jurisprudence.py` endpoint

## Files Likely Touched

- `backend/app/government_apis/ecli_registry.py`
- `backend/app/models/ruling_cache.py`
- `backend/app/models/__init__.py`
- `backend/alembic/versions/xxxx_add_ruling_cache_table.py`
- `backend/app/government_apis/rechtspraak.py`
- `backend/app/jobs/ruling_ingestion.py`
- `backend/app/jobs/worker.py`
- `backend/app/api/endpoints/jurisprudence.py`
