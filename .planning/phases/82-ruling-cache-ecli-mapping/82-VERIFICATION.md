---
phase: 82-ruling-cache-ecli-mapping
verified: 2026-03-07T21:30:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 82: Ruling Cache + ECLI Court Mapping Verification Report

**Phase Goal:** Court rulings are persistently cached with correct geographic scoping so all downstream features operate on relevant, local data instead of garbage national results
**Verified:** 2026-03-07T21:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EcliRegistry maps any of 342 Dutch gemeenten to their rechtbank court code | VERIFIED | 346 gemeenten mapped to 11 rechtbanken (includes historical names). `get_court_codes_for_gemeente('Venlo')` returns `['RBLIM', 'RBMAA', 'RBROE']` |
| 2 | EcliRegistry includes 16 pre-2013 court codes that merged in the 2013 reorganization | VERIFIED | `OLD_COURT_CODES` dict has exactly 16 entries, all mapping old codes to current codes |
| 3 | ruling_cache table exists in PostgreSQL with ECLI as primary key and no organization_id | VERIFIED | Migration `bf6988ef58ae` creates table with `ecli` PK, 3 indexes (court_code, datum_uitspraak, gemeente_query). No organization_id column |
| 4 | RulingCache model uses TimestampMixin but NOT TenantMixin (public data) | VERIFIED | `class RulingCache(Base, TimestampMixin)` -- no TenantMixin. Columns confirmed: no organization_id |
| 5 | RechtspraakClient can search omgevingsrecht rulings filtered by court-code prefix (client-side ECLI filtering) | VERIFIED | `search_by_court()` method fetches broadly with `subject=omgevingsrecht`, then filters via `extract_court_code(r["ecli"]) in court_code_set` |
| 6 | RechtspraakClient supports date range filtering via the Rechtspraak API date parameter | VERIFIED | `search_by_court()` accepts `date_from`/`date_to`, uses list-of-tuples params for duplicate `date` keys |
| 7 | Background ARQ job populates ruling_cache for a gemeente's court region with 50+ results | VERIFIED | `ruling_ingestion_job` in `ruling_ingestion.py` searches with `max_results=100`, batch-fetches documents with `Semaphore(5)`, upserts into RulingCache. Registered in WorkerSettings |
| 8 | Repeated gemeente views load rulings from cache instantly within 7-day TTL window | VERIFIED | `GET /rulings/{gemeente_naam}` queries `ruling_cache` by `gemeente_query`, checks `fetched_at` age against `RULING_CACHE_TTL_SECONDS = 604800`. Returns `ingestion_status: "fresh"` when within TTL |
| 9 | Cache miss triggers background ingestion job automatically | VERIFIED | Endpoint enqueues `ruling_ingestion_job` via `arq_pool.enqueue_job` with dedup key `ruling_ingest:{gemeente}` when cache is empty (`pending`) or stale (`refreshing`) |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/government_apis/ecli_registry.py` | Gemeente-to-rechtbank mapping + ECLI court code utilities | VERIFIED | 482 lines, exports GEMEENTE_TO_RECHTBANK (346 entries), OLD_COURT_CODES (16 entries), get_court_codes_for_gemeente, extract_court_code, is_valid_court_code, GERECHTSHOVEN, RVS |
| `backend/app/models/ruling_cache.py` | RulingCache SQLAlchemy model | VERIFIED | 33 lines, org-agnostic model with ECLI PK, correct columns and indexes |
| `backend/app/models/__init__.py` | Model registry with RulingCache export | VERIFIED | `from app.models.ruling_cache import RulingCache` and `"RulingCache"` in `__all__` |
| `backend/alembic/versions/bf6988ef58ae_add_ruling_cache_table.py` | Alembic migration for ruling_cache | VERIFIED | Creates table with correct schema, 3 indexes, proper downgrade |
| `backend/app/government_apis/rechtspraak.py` | Extended RechtspraakClient with search_by_court | VERIFIED | 374 lines, `search_by_court()` + `_parse_search_results()` added, existing `search_jurisprudence()` preserved |
| `backend/app/jobs/ruling_ingestion.py` | ARQ background job for ruling cache population | VERIFIED | 174 lines, full implementation with court code lookup, batch fetch, upsert, error handling, engine disposal |
| `backend/app/jobs/worker.py` | Worker with ruling_ingestion_job registered | VERIFIED | `ruling_ingestion_job` in `WorkerSettings.functions` list |
| `backend/app/api/endpoints/jurisprudence.py` | Endpoint to trigger/serve cached rulings per gemeente | VERIFIED | `GET /rulings/{gemeente_naam}` with TTL check, auto-enqueue, date filtering, ingestion_status response |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `rechtspraak.py` | `ecli_registry.py` | `from app.government_apis.ecli_registry import extract_court_code` | WIRED | Line 21, used in `search_by_court()` for client-side filtering |
| `ruling_ingestion.py` | `ruling_cache.py` | `from app.models.ruling_cache import RulingCache` | WIRED | Line 21, used for select/upsert in ingestion logic |
| `ruling_ingestion.py` | `rechtspraak.py` | `rechtspraak_client.search_by_court` | WIRED | Line 72, calls search_by_court + get_jurisprudence_document |
| `jurisprudence.py` | `ruling_ingestion.py` | `enqueue_job("ruling_ingestion_job", ...)` | WIRED | Line 138-141, enqueues via ARQ with dedup key |
| `ruling_cache.py` | `base.py` | `class RulingCache(Base, TimestampMixin)` | WIRED | Line 15, inherits Base + TimestampMixin (no TenantMixin) |
| `jurisprudence.py` | `ecli_registry.py` | `from app.government_apis.ecli_registry import get_court_codes_for_gemeente` | WIRED | Line 22, used for gemeente validation on line 105 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| PIPE-01 | 82-01 | Dedicated `ruling_cache` PostgreSQL table (org-agnostic, ECLI as PK) | SATISFIED | Migration applied, model verified, no organization_id |
| PIPE-02 | 82-01 | EcliRegistry maps 342 gemeenten to 11 rechtbanken + 16 pre-2013 codes | SATISFIED | 346 gemeenten mapped, 16 old codes, all functions verified |
| PIPE-03 | 82-02 | RechtspraakClient uses ECLI court-code prefix filtering | SATISFIED | `search_by_court()` with client-side ECLI prefix filtering via extract_court_code |
| PIPE-04 | 82-02 | Date range filtering via API `date` parameter | SATISFIED | list-of-tuples params with duplicate `date` keys for range |
| PIPE-05 | 82-02 | Ruling ingestion ARQ job fetches 50+ results with batch retrieval | SATISFIED | `ruling_ingestion_job` with max_results=100, Semaphore(5) batch fetch |
| PIPE-06 | 82-02 | Per-gemeente caching with 7-day TTL | SATISFIED | `RULING_CACHE_TTL_SECONDS = 604800`, auto-refresh on stale/empty |

No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | All files clean. No TODOs, no stubs, no empty implementations |

### Human Verification Required

### 1. End-to-End Ruling Ingestion

**Test:** Navigate to a gemeente detail view (e.g., Venlo) in the frontend. Verify that rulings appear after the background job completes.
**Expected:** Initial load shows `ingestion_status: "pending"` with empty rulings. After ~30-60s, polling `/rulings/Venlo` should return cached rulings with `ingestion_status: "fresh"`.
**Why human:** Requires running ARQ worker + live Rechtspraak API + database. Cannot verify end-to-end flow programmatically.

### 2. Court-Code Filter Effectiveness

**Test:** Call `/rulings/Venlo` and verify all returned rulings have ECLI codes starting with `RBLIM` or `RBMAA`/`RBROE` (old Limburg codes).
**Expected:** Zero rulings from other arrondissementen (e.g., RBAMS, RBROT).
**Why human:** Requires live API call to verify actual filtering effectiveness against real Rechtspraak data.

### Gaps Summary

No gaps found. All 9 observable truths verified, all 8 artifacts pass three-level checks (exists, substantive, wired), all 6 key links confirmed, all 6 requirements satisfied, no anti-patterns detected. Phase goal is achieved: court rulings are persistently cached with correct geographic scoping via ECLI court-code prefix filtering.

---

_Verified: 2026-03-07T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
