# T02: 82-ruling-cache-ecli-mapping 02

**Slice:** S01 — **Milestone:** M001

## Description

Extend RechtspraakClient with court-code-scoped search and date range filtering, create the ARQ ingestion job that populates ruling_cache, and wire the jurisprudence endpoint to serve cached rulings with automatic background re-ingestion on cache miss/expiry.

Purpose: This makes the jurisprudence feature actually useful -- results are scoped to the correct arrondissement instead of national free-text garbage, cached persistently, and auto-populated on first gemeente view.

Output: Refactored `rechtspraak.py`, new `ruling_ingestion.py` job, updated `worker.py` and `jurisprudence.py` endpoint

## Must-Haves

- [ ] "RechtspraakClient can search omgevingsrecht rulings filtered by court-code prefix (client-side ECLI filtering)"
- [ ] "RechtspraakClient supports date range filtering via the Rechtspraak API date parameter"
- [ ] "Background ARQ job populates ruling_cache for a gemeente's court region with 50+ results"
- [ ] "Repeated gemeente views load rulings from cache instantly within 7-day TTL window"
- [ ] "Cache miss triggers background ingestion job automatically"

## Files

- `backend/app/government_apis/rechtspraak.py`
- `backend/app/jobs/ruling_ingestion.py`
- `backend/app/jobs/worker.py`
- `backend/app/api/endpoints/jurisprudence.py`
