# Propdex — GSD State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for M048
Last activity: 2026-04-22 — Milestone M048 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** From grondpositie to first spade in one cockpit — no switching between 10 tabs
**Current focus:** M048 Score v4.0 Frontend Scaling

## Accumulated Context

### Architecture invariants
- Every SQLAlchemy model needs `organization_id` (NOT NULL, indexed) — multi-tenant
- Transactions: direct `db.add()/db.flush()/db.commit()` — NOT `async with db.begin()`
- Datetimes: `datetime.utcnow()` — NOT `datetime.now(timezone.utc)`
- JWT: PyJWT, explicit `algorithms=["HS256"]`
- ARQ worker: `python -m app.jobs.worker` (NOT `arq` CLI — broken on Python 3.14)

### Score engine (post-M047)
- FACTOR_REGISTRY in `backend/app/services/score_v3_factors.py`
- percentage_of_category: new field, sums to 100 per category
- potentie_risico_balance: org-config prop (NOT in flags), default 0.7
- SCHEMA_VERSION = 1 in `backend/app/ai/factor_extraction_schemas.py:114` → bump to 2 in M048/S01
- LLM: factor_extractor.py, cache-key (parcel_id, doc_version_hash, factor_id), temp=0

### Frontend (post-Aura v15.0)
- Design tokens: `frontend/src/styles/index.css` (Tailwind v4 @theme)
- Plus Jakarta Sans, single family
- Framer Motion + layoutId for active-state transitions
- Dynamic Split-Canvas: map shrinks alongside 620px parcel panel
- Intelligence Grid: Potentie (3×3 bento) + Risico (paginated) + Dossiers tabs
- Woonvisie popup approved design: `/tmp/m048-woonvisie-card.html`

### Testing baseline (M047 close)
- 275 tests green (104 unit + 171 integration)
- Test DB: propdex_test (auto-created in conftest.py)
- Rate limiter in tests: `limiter.enabled = False` on module-level limiter

### Open tech-debt (post-M047)
- S05 RCE API 403 blocker: `.planning/todos/pending/2026-04-20-s05-rce-api-403-access-blocker.md`
- KlimaatLayer gemeente-verdict bug: needs fix in M048
